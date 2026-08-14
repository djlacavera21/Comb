"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0 || index === argv.length - 1 || argv.indexOf(name, index + 1) >= 0) {
    throw new Error(`${name} must be supplied exactly once`);
  }
  return argv[index + 1];
}

function verifyReleaseArtifacts(version, options = {}) {
  const rootDirectory = options.rootDirectory || root;
  const errors = [];
  if (!/^\d+\.\d+\.\d+$/.test(String(version || ""))) {
    return ["version must use X.Y.Z with digits only"];
  }

  const archiveNames = [
    `comb-${version}.zip`,
    `comb-${version}-store-review-kit.zip`
  ];
  for (const archiveName of archiveNames) {
    const archivePath = path.join(rootDirectory, "dist", archiveName);
    const sidecarPath = `${archivePath}.sha256`;
    if (!fs.existsSync(archivePath)) {
      errors.push(`missing release archive: ${archiveName}`);
      continue;
    }
    if (!fs.existsSync(sidecarPath)) {
      errors.push(`missing release checksum: ${archiveName}.sha256`);
      continue;
    }
    const actual = crypto.createHash("sha256").update(fs.readFileSync(archivePath)).digest("hex");
    const sidecar = fs.readFileSync(sidecarPath, "utf8");
    const expected = `${actual}  ${archiveName}\n`;
    if (sidecar !== expected) errors.push(`checksum sidecar does not exactly match ${archiveName}`);
  }
  return errors;
}

function main() {
  const version = optionValue(process.argv.slice(2), "--version");
  const errors = verifyReleaseArtifacts(version);
  if (errors.length) {
    process.stderr.write(`Comb release artifact verification failed:\n- ${errors.join("\n- ")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`Comb release artifacts verified: four exact v${version} files and matching SHA-256 values.\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Comb release artifact verification failed: ${error.message || error}\n`);
    process.exitCode = 1;
  }
}

module.exports = { verifyReleaseArtifacts };
