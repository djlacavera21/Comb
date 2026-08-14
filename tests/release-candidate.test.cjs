"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { validateReleaseCandidate } = require("../scripts/validate-release-candidate.js");

const sha = "0123456789abcdef0123456789abcdef01234567";

function validCandidate() {
  return {
    version: "0.7.0",
    commitSha: sha,
    headSha: sha,
    mainSha: sha,
    clean: true,
    localTagExists: false,
    productVersions: {
      package: "0.7.0",
      manifest: "0.7.0",
      listing: "0.7.0",
      matrix: "0.7.0",
      engine: "0.7.0"
    },
    textEvidence: {
      changelog: "## [0.7.0]",
      "release documentation": "dist/comb-0.7.0.zip and v0.7.0",
      "submission checklist": "comb-0.7.0.zip",
      "release notes": "v0.7 release",
      "options version label": "Comb v0.7",
      "store screenshot source": "Comb v0.7"
    }
  };
}

test("release candidate accepts one exact clean main commit", () => {
  assert.deepEqual(validateReleaseCandidate(validCandidate()), []);
});

test("release candidate rejects a branch name or non-main commit", () => {
  const candidate = validCandidate();
  candidate.commitSha = "main";
  candidate.mainSha = "fedcba9876543210fedcba9876543210fedcba98";
  const errors = validateReleaseCandidate(candidate);
  assert.ok(errors.some((error) => error.includes("full 40-character")));
  assert.ok(errors.some((error) => error.includes("current origin/main")));
});

test("release candidate rejects version drift and tag reuse", () => {
  const candidate = validCandidate();
  candidate.productVersions.matrix = "0.6.0";
  candidate.localTagExists = true;
  candidate.textEvidence["options version label"] = "Comb v0.6";
  const errors = validateReleaseCandidate(candidate);
  assert.ok(errors.some((error) => error.includes("matrix version")));
  assert.ok(errors.some((error) => error.includes("already exists")));
  assert.ok(errors.some((error) => error.includes("options version label")));
});
