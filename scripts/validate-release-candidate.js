"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  }).trim();
}

function optionValue(argv, name) {
  const indexes = argv
    .map((value, index) => value === name ? index : -1)
    .filter((index) => index >= 0);
  if (indexes.length !== 1 || indexes[0] === argv.length - 1) {
    throw new Error(`${name} must be supplied exactly once`);
  }
  return argv[indexes[0] + 1];
}

function validateReleaseCandidate(candidate) {
  const errors = [];
  const fail = (message) => errors.push(message);
  const version = candidate.version;
  const shortVersion = /^\d+\.\d+\.\d+$/.test(String(version || ""))
    ? version.split(".").slice(0, 2).join(".")
    : null;

  if (!/^\d+\.\d+\.\d+$/.test(String(version || ""))) {
    fail("version must use X.Y.Z with digits only");
  }
  if (!/^[0-9a-f]{40}$/.test(String(candidate.commitSha || ""))) {
    fail("commit SHA must be the full 40-character lowercase SHA-1");
  }
  if (candidate.headSha !== candidate.commitSha) fail("checked-out HEAD must equal the authorized commit SHA");
  if (candidate.mainSha !== candidate.commitSha) fail("authorized commit must be the current origin/main commit");
  if (!candidate.clean) fail("release worktree must be clean");
  if (candidate.localTagExists) fail(`local tag v${version} already exists`);

  for (const [label, actualVersion] of Object.entries(candidate.productVersions || {})) {
    if (actualVersion !== version) fail(`${label} version must equal ${version}`);
  }

  if (shortVersion) {
    const requiredText = [
      ["changelog", `## [${version}]`],
      ["release documentation", `dist/comb-${version}.zip`],
      ["release documentation", `v${version}`],
      ["submission checklist", `comb-${version}.zip`],
      ["release notes", `v${shortVersion}`],
      ["options version label", `Comb v${shortVersion}`],
      ["store screenshot source", `Comb v${shortVersion}`]
    ];
    for (const [label, phrase] of requiredText) {
      if (!String(candidate.textEvidence?.[label] || "").includes(phrase)) {
        fail(`${label} must include ${phrase}`);
      }
    }
  }

  return errors;
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function main() {
  const version = optionValue(process.argv.slice(2), "--version");
  const commitSha = optionValue(process.argv.slice(2), "--commit");
  const packageJson = JSON.parse(read("package.json"));
  const manifest = JSON.parse(read("manifest.json"));
  const listing = JSON.parse(read("store/listing.json"));
  const matrix = JSON.parse(read("tests/fixtures/support-matrix.json"));
  const engineSource = read("src/content/checkout-engine.js");
  const engineVersion = engineSource.match(/const VERSION = "([^"]+)";/)?.[1] || null;
  const tagCheck = spawnSync("git", ["show-ref", "--verify", "--quiet", `refs/tags/v${version}`], {
    cwd: root,
    stdio: "ignore"
  });
  if (![0, 1].includes(tagCheck.status)) throw new Error("could not inspect local release tags");

  const candidate = {
    version,
    commitSha,
    headSha: git(["rev-parse", "HEAD"]),
    mainSha: git(["rev-parse", "refs/remotes/origin/main"]),
    clean: git(["status", "--porcelain"]) === "",
    localTagExists: tagCheck.status === 0,
    productVersions: {
      package: packageJson.version,
      manifest: manifest.version,
      listing: listing.extensionVersion,
      matrix: matrix.engineVersion,
      engine: engineVersion
    },
    textEvidence: {
      changelog: read("CHANGELOG.md"),
      "release documentation": read("docs/RELEASE.md"),
      "submission checklist": read("store/SUBMISSION.md"),
      "release notes": read("store/release-notes.txt"),
      "options version label": read("src/options/options.html"),
      "store screenshot source": read("store/assets/comb-screenshot-01-1280x800.svg")
    }
  };
  const errors = validateReleaseCandidate(candidate);
  if (errors.length) {
    process.stderr.write(`Comb release candidate rejected:\n- ${errors.join("\n- ")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`Comb release candidate accepted: v${version} at ${commitSha}.\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Comb release candidate validation failed: ${error.message || error}\n`);
    process.exitCode = 1;
  }
}

module.exports = { validateReleaseCandidate };
