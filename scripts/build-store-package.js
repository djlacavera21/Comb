"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createArchive, sha256, sourceDateEpoch } = require("./deterministic-zip.js");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const verifyReproducible = process.argv.includes("--verify");

function entry(name, relativePath) {
  const absolutePath = path.join(root, relativePath);
  const stats = fs.statSync(absolutePath);
  if (!stats.isFile()) throw new Error(`Store-kit input is not a file: ${relativePath}`);
  return { name, content: fs.readFileSync(absolutePath) };
}

function main() {
  execFileSync(process.execPath, ["scripts/validate-publication-record.js"], {
    cwd: root,
    stdio: "inherit"
  });
  execFileSync(process.execPath, ["scripts/validate-store.js"], {
    cwd: root,
    stdio: "inherit"
  });
  execFileSync(process.execPath, [
    "scripts/build-release.js",
    ...(verifyReproducible ? ["--verify"] : [])
  ], {
    cwd: root,
    stdio: "inherit"
  });

  const version = manifest.version;
  const runtimeName = `comb-${version}.zip`;
  const kitEntries = [
    entry("README.md", "store/SUBMISSION.md"),
    entry("CHANGELOG.md", "CHANGELOG.md"),
    entry("evidence/ATTRIBUTION.md", "docs/ATTRIBUTION.md"),
    entry("evidence/COMPATIBILITY.md", "docs/COMPATIBILITY.md"),
    entry("evidence/INDEPENDENT_REVIEW.md", "docs/INDEPENDENT_REVIEW.md"),
    entry("evidence/PUBLICATION_STATUS.md", "docs/PUBLICATION_STATUS.md"),
    entry("evidence/RELEASE.md", "docs/RELEASE.md"),
    entry("evidence/SECURITY_REVIEW.md", "docs/SECURITY_REVIEW.md"),
    entry("evidence/SUPPORT_TRIAGE.md", "docs/SUPPORT_TRIAGE.md"),
    entry("evidence/SYNTHETIC_FIXTURES.md", "docs/SYNTHETIC_FIXTURES.md"),
    entry("evidence/manifest.json", "manifest.json"),
    entry("evidence/publication-record.json", "store/publication-record.json"),
    entry("evidence/support-matrix.json", "tests/fixtures/support-matrix.json"),
    entry("evidence/release-workflow.yml", ".github/workflows/release.yml"),
    entry("evidence/validate-fixture-matrix.js", "scripts/validate-fixture-matrix.js"),
    entry("evidence/validate-publication-record.js", "scripts/validate-publication-record.js"),
    entry("evidence/validate-release-candidate.js", "scripts/validate-release-candidate.js"),
    entry("evidence/create-synthetic-fixture-proposal.js", "scripts/create-synthetic-fixture-proposal.js"),
    entry("evidence/verify-release-artifacts.js", "scripts/verify-release-artifacts.js"),
    entry("listing/assets/comb-128.png", "icons/comb-128.png"),
    entry("listing/assets/comb-screenshot-01-1280x800.png", "store/assets/comb-screenshot-01-1280x800.png"),
    entry("listing/assets/comb-screenshot-02-1280x800.png", "store/assets/comb-screenshot-02-1280x800.png"),
    entry("listing/assets/comb-screenshot-03-1280x800.png", "store/assets/comb-screenshot-03-1280x800.png"),
    entry("listing/assets/comb-screenshot-04-1280x800.png", "store/assets/comb-screenshot-04-1280x800.png"),
    entry("listing/assets/comb-screenshot-05-1280x800.png", "store/assets/comb-screenshot-05-1280x800.png"),
    entry("listing/assets/comb-small-promo-440x280.png", "store/assets/comb-small-promo-440x280.png"),
    entry("listing/assets/comb-store-logo-300.png", "store/assets/comb-store-logo-300.png"),
    entry("listing/chrome-description.txt", "store/chrome-description.txt"),
    entry("listing/edge-description.txt", "store/edge-description.txt"),
    entry("listing/listing.json", "store/listing.json"),
    entry("listing/release-notes.txt", "store/release-notes.txt"),
    entry("listing/review-response-playbook.md", "store/REVIEW_RESPONSE_PLAYBOOK.md"),
    entry("listing/review-notes.md", "store/review-notes.md"),
    entry("policies/PRIVACY.md", "docs/PRIVACY.md"),
    entry(`upload/${runtimeName}`, `dist/${runtimeName}`),
    entry(`upload/${runtimeName}.sha256`, `dist/${runtimeName}.sha256`)
  ];

  const epochSeconds = sourceDateEpoch(root);
  const archive = createArchive(kitEntries, epochSeconds);
  if (verifyReproducible) {
    const repeatedArchive = createArchive(kitEntries, epochSeconds);
    if (!archive.equals(repeatedArchive)) throw new Error("Repeated store-kit builds were not identical.");
  }

  const outputDirectory = path.join(root, "dist");
  const archiveName = `comb-${version}-store-review-kit.zip`;
  const archivePath = path.join(outputDirectory, archiveName);
  const checksum = sha256(archive);
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(archivePath, archive);
  fs.writeFileSync(`${archivePath}.sha256`, `${checksum}  ${archiveName}\n`, "utf8");

  process.stdout.write(`Store review kit: ${archivePath}\n`);
  process.stdout.write(`SHA-256: ${checksum}\n`);
  process.stdout.write(`Files: ${kitEntries.length}; timestamp: ${epochSeconds}\n`);
  if (verifyReproducible) process.stdout.write("Store-kit reproducibility check: identical repeated build\n");
}

try {
  main();
} catch (error) {
  process.stderr.write(`Comb store package build failed: ${error.message || error}\n`);
  process.exitCode = 1;
}
