"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { verifyReleaseArtifacts } = require("../scripts/verify-release-artifacts.js");

function writeArtifact(root, name, content) {
  const output = path.join(root, "dist");
  fs.mkdirSync(output, { recursive: true });
  const digest = crypto.createHash("sha256").update(content).digest("hex");
  fs.writeFileSync(path.join(output, name), content);
  fs.writeFileSync(path.join(output, `${name}.sha256`), `${digest}  ${name}\n`);
}

test("release artifact verifier requires both exact archives and sidecars", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "comb-release-artifacts-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeArtifact(directory, "comb-0.7.0.zip", Buffer.from("runtime"));
  writeArtifact(directory, "comb-0.7.0-store-review-kit.zip", Buffer.from("review-kit"));
  assert.deepEqual(verifyReleaseArtifacts("0.7.0", { rootDirectory: directory }), []);
});

test("release artifact verifier rejects a mismatched checksum", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "comb-release-artifacts-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeArtifact(directory, "comb-0.7.0.zip", Buffer.from("runtime"));
  writeArtifact(directory, "comb-0.7.0-store-review-kit.zip", Buffer.from("review-kit"));
  fs.appendFileSync(path.join(directory, "dist/comb-0.7.0.zip"), "changed");
  const errors = verifyReleaseArtifacts("0.7.0", { rootDirectory: directory });
  assert.ok(errors.some((error) => error.includes("checksum sidecar")));
});
