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

async function main() {
  const [signedFeedPath, trustKeyPath] = process.argv.slice(2);
  if (!signedFeedPath || !trustKeyPath) {
    process.stderr.write("Usage: node scripts/verify-feed.js <signed-feed.json> <public-trust-key.json>\n");
    process.exitCode = 2;
    return;
  }

  const envelope = readJson(signedFeedPath, 2 * 1024 * 1024, "Signed feed");
  const trustKey = readJson(trustKeyPath, 64 * 1024, "Public trust key");
  const verified = await CombFeed.verifyEnvelope(envelope, trustKey);
  process.stdout.write(`VALID: ${verified.payload.name}\n`);
  process.stdout.write(`Feed ID: ${verified.payload.feedId}\n`);
  process.stdout.write(`Sequence: ${verified.payload.sequence}\n`);
  process.stdout.write(`Entries: ${verified.payload.entries.length}\n`);
  process.stdout.write(`Expires: ${verified.payload.expiresAt}\n`);
  process.stdout.write(`Payload hash: ${verified.payloadHash}\n`);
}

main().catch((error) => {
  process.stderr.write(`INVALID: ${error.message || error}\n`);
  process.exitCode = 1;
});
