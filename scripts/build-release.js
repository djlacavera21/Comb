"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const verifyReproducible = process.argv.includes("--verify");
const releaseFiles = Object.freeze([
  "manifest.json",
  "icons/comb-16.png",
  "icons/comb-32.png",
  "icons/comb-48.png",
  "icons/comb-128.png",
  "src/background.js",
  "src/content/checkout-engine.js",
  "src/content/runner.js",
  "src/options/options.css",
  "src/options/options.html",
  "src/options/options.js",
  "src/popup/popup.css",
  "src/popup/popup.html",
  "src/popup/popup.js",
  "src/shared/feed-verifier.js",
  "src/shared/source-policy.js",
  "src/shared/theme.css"
].sort());

function sourceDateEpoch() {
  const configured = process.env.SOURCE_DATE_EPOCH;
  if (configured != null) {
    if (!/^\d{9,12}$/.test(configured)) {
      throw new Error("SOURCE_DATE_EPOCH must be Unix seconds.");
    }
    return Number(configured);
  }

  try {
    return Number(execFileSync("git", ["log", "-1", "--format=%ct"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim());
  } catch (_error) {
    throw new Error("Set SOURCE_DATE_EPOCH when building outside a Git checkout.");
  }
}

function dosDateTime(epochSeconds) {
  const date = new Date(Math.max(315532800, epochSeconds) * 1000);
  const year = Math.max(1980, Math.min(2107, date.getUTCFullYear()));
  const dosDate = ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  const dosTime = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) |
    Math.floor(date.getUTCSeconds() / 2);
  return { dosDate, dosTime };
}

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
}

const crcTable = createCrcTable();

function crc32(content) {
  let crc = 0xffffffff;
  for (const byte of content) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function localHeader(name, content, timestamp) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(timestamp.dosTime, 10);
  header.writeUInt16LE(timestamp.dosDate, 12);
  header.writeUInt32LE(crc32(content), 14);
  header.writeUInt32LE(content.length, 18);
  header.writeUInt32LE(content.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function centralHeader(name, content, timestamp, localOffset) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE((3 << 8) | 20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(timestamp.dosTime, 12);
  header.writeUInt16LE(timestamp.dosDate, 14);
  header.writeUInt32LE(crc32(content), 16);
  header.writeUInt32LE(content.length, 20);
  header.writeUInt32LE(content.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE((0o100644 << 16) >>> 0, 38);
  header.writeUInt32LE(localOffset, 42);
  return header;
}

function endOfCentralDirectory(entryCount, centralSize, centralOffset) {
  const record = Buffer.alloc(22);
  record.writeUInt32LE(0x06054b50, 0);
  record.writeUInt16LE(0, 4);
  record.writeUInt16LE(0, 6);
  record.writeUInt16LE(entryCount, 8);
  record.writeUInt16LE(entryCount, 10);
  record.writeUInt32LE(centralSize, 12);
  record.writeUInt32LE(centralOffset, 16);
  record.writeUInt16LE(0, 20);
  return record;
}

function createArchive(epochSeconds) {
  const timestamp = dosDateTime(epochSeconds);
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const relativePath of releaseFiles) {
    const absolutePath = path.join(root, relativePath);
    const stats = fs.statSync(absolutePath);
    if (!stats.isFile()) throw new Error(`Release input is not a file: ${relativePath}`);
    const content = fs.readFileSync(absolutePath);
    const name = Buffer.from(relativePath.replaceAll(path.sep, "/"), "utf8");
    const local = localHeader(name, content, timestamp);
    const central = centralHeader(name, content, timestamp, localOffset);
    localParts.push(local, name, content);
    centralParts.push(central, name);
    localOffset += local.length + name.length + content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  return Buffer.concat([
    ...localParts,
    centralDirectory,
    endOfCentralDirectory(releaseFiles.length, centralDirectory.length, localOffset)
  ]);
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function main() {
  execFileSync(process.execPath, ["scripts/validate-extension.js"], {
    cwd: root,
    stdio: "inherit"
  });

  const epochSeconds = sourceDateEpoch();
  const archive = createArchive(epochSeconds);
  if (verifyReproducible) {
    const secondArchive = createArchive(epochSeconds);
    if (!archive.equals(secondArchive)) throw new Error("Repeated release builds were not identical.");
  }

  const outputDirectory = path.join(root, "dist");
  const archiveName = `comb-${manifest.version}.zip`;
  const archivePath = path.join(outputDirectory, archiveName);
  const checksum = sha256(archive);
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(archivePath, archive);
  fs.writeFileSync(`${archivePath}.sha256`, `${checksum}  ${archiveName}\n`, "utf8");

  process.stdout.write(`Release archive: ${archivePath}\n`);
  process.stdout.write(`SHA-256: ${checksum}\n`);
  process.stdout.write(`Files: ${releaseFiles.length}; timestamp: ${epochSeconds}\n`);
  if (verifyReproducible) process.stdout.write("Reproducibility check: identical repeated build\n");
}

try {
  main();
} catch (error) {
  process.stderr.write(`Comb release build failed: ${error.message || error}\n`);
  process.exitCode = 1;
}
