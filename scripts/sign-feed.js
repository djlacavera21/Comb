"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { webcrypto } = require("node:crypto");

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const CombFeed = require("../src/shared/feed-verifier.js");

function readJson(filePath, maximumBytes, label) {
  const resolved = path.resolve(filePath);
  const stats = fs.statSync(resolved);
  if (!stats.isFile() || stats.size > maximumBytes) throw new Error(`${label} is missing or too large.`);
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function validatePrivateDescriptor(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Private key file is invalid.");
  if (value.schema !== CombFeed.PRIVATE_KEY_SCHEMA) throw new Error("Unsupported private-key schema.");
  if (value.algorithm !== CombFeed.ALGORITHM) throw new Error("Unsupported private-key algorithm.");
  if (!value.privateKeyJwk || typeof value.privateKeyJwk.d !== "string") throw new Error("Private signing material is missing.");
  return value;
}

async function main() {
  const [payloadPath, privateKeyPath, outputPath] = process.argv.slice(2);
  if (!payloadPath || !privateKeyPath || !outputPath) {
    process.stderr.write("Usage: node scripts/sign-feed.js <payload.json> <private-key.json> <signed-output.json>\n");
    process.exitCode = 2;
    return;
  }

  const payload = readJson(payloadPath, 2 * 1024 * 1024, "Feed payload");
  const privateDescriptor = validatePrivateDescriptor(
    readJson(privateKeyPath, 64 * 1024, "Private key")
  );
  const resolvedOutput = path.resolve(outputPath);
  if (fs.existsSync(resolvedOutput)) throw new Error("Refusing to overwrite an existing signed feed.");

  payload.keyId = privateDescriptor.keyId;
  const envelope = await CombFeed.signPayload(
    payload,
    privateDescriptor.privateKeyJwk,
    privateDescriptor.keyId
  );
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  fs.writeFileSync(resolvedOutput, `${JSON.stringify(envelope, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o644
  });
  process.stdout.write(`Signed ${envelope.payload.entries.length} entries as ${envelope.payload.feedId} sequence ${envelope.payload.sequence}.\n`);
  process.stdout.write(`Output: ${resolvedOutput}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message || error}\n`);
  process.exitCode = 1;
});
