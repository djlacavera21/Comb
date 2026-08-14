"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const templatePath = path.join(root, "examples/community-feed.payload.example.json");

function main() {
  const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
  if (!outputPath) {
    process.stderr.write("Usage: node scripts/create-example-feed-payload.js <output.json>\n");
    process.exitCode = 2;
    return;
  }

  if (fs.existsSync(outputPath)) throw new Error("Refusing to overwrite an existing example payload.");

  const payload = JSON.parse(fs.readFileSync(templatePath, "utf8"));
  const now = Date.now();
  payload.issuedAt = new Date(now - 60_000).toISOString();
  payload.expiresAt = new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();
  payload.entries = payload.entries.map((entry) => ({
    ...entry,
    lastVerifiedAt: new Date(now - 120_000).toISOString()
  }));

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o644
  });
  process.stdout.write(`Fresh synthetic example payload: ${outputPath}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message || error}\n`);
  process.exitCode = 1;
}
