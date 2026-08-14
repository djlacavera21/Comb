"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateFixtureMatrix } = require("../scripts/validate-fixture-matrix.js");

const root = path.resolve(__dirname, "..");
const matrix = JSON.parse(
  fs.readFileSync(path.join(root, "tests/fixtures/support-matrix.json"), "utf8")
);

test("the checked-in support matrix covers every synthetic fixture", () => {
  assert.deepEqual(validateFixtureMatrix(matrix, { rootDirectory: root }), []);
});

test("the support matrix rejects live URLs and creator identifiers", () => {
  const unsafe = structuredClone(matrix);
  unsafe.fixtures[0].publicThemeVersion = "https://merchant.example/creator-42";
  unsafe.fixtures[0].publicPlatform = "merchant.example.com";
  const errors = validateFixtureMatrix(unsafe, { rootDirectory: root });
  assert.ok(errors.some((error) => error.includes("unsafe publicThemeVersion")));
  assert.ok(errors.some((error) => error.includes("creator/affiliate identifiers")));
});

test("only the creator-tagged fixture can own attribution preservation", () => {
  const ambiguous = structuredClone(matrix);
  ambiguous.fixtures.find((fixture) => fixture.file === "generic.html")
    .expected.creatorAttributionPreserved = false;
  ambiguous.fixtures.find((fixture) => fixture.file === "shopify-style.html")
    .expected.creatorAttributionPreserved = true;
  const errors = validateFixtureMatrix(ambiguous, { rootDirectory: root });
  assert.ok(errors.some((error) => error.includes("may not own")));
  assert.ok(errors.some((error) => error.includes("exactly generic.html")));
});
