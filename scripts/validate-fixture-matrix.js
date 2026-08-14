"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const matrixPath = path.join(root, "tests/fixtures/support-matrix.json");
const topLevelKeys = ["engineVersion", "fixtures", "schema", "sourcePolicy", "syntheticOnly"];
const fixtureKeys = [
  "adapter",
  "baseline",
  "contract",
  "currency",
  "expected",
  "file",
  "locale",
  "publicPlatform",
  "publicPlatformVersion",
  "publicThemeVersion"
];
const expectedKeys = [
  "applyClicks",
  "bestCandidateCode",
  "bestCode",
  "creatorAttributionPreserved",
  "detected",
  "reason",
  "removeClicks",
  "savings",
  "status",
  "tested",
  "zeroPurchaseClicks"
];
const adapters = new Set(["bigcommerce", "generic", "shopify", "woocommerce"]);
const contracts = new Set(["happy-path", "safe-stop"]);
const statuses = new Set(["blocked", "complete", "partial", "stopped"]);
const reasons = new Set([
  "checkout_total_changed_during_run",
  "coupon_apply_button_not_found",
  "coupon_removal_unverified",
  "existing_coupon_detected"
]);
const syntheticCodes = new Set(["BEST20", "SAVE10", "SHIPFREE"]);
const sourcePolicy =
  "Synthetic markup based only on public platform semantics or privacy-safe reports; no live checkout captures.";

function sortedKeys(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value).sort()
    : [];
}

function sameKeys(value, expected) {
  return JSON.stringify(sortedKeys(value)) === JSON.stringify([...expected].sort());
}

function isNullableNumber(value) {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isNullableInteger(value) {
  return value === null || (Number.isInteger(value) && value >= 0);
}

function isNullableSyntheticCode(value) {
  return value === null || syntheticCodes.has(value);
}

function validateFixtureMatrix(matrix, options = {}) {
  const rootDirectory = options.rootDirectory || root;
  const errors = [];
  const fail = (message) => errors.push(message);
  const fixturesDirectory = path.join(rootDirectory, "tests/fixtures");

  if (!sameKeys(matrix, topLevelKeys)) {
    fail(`matrix keys must be exactly: ${topLevelKeys.join(", ")}`);
    return errors;
  }
  if (matrix.schema !== "comb.fixture-support-matrix/v1") fail("matrix schema must be v1");
  if (matrix.syntheticOnly !== true) fail("matrix must declare syntheticOnly: true");
  if (matrix.sourcePolicy !== sourcePolicy) fail("matrix source policy must reject live checkout captures");
  if (!/^\d+\.\d+\.\d+$/.test(String(matrix.engineVersion || ""))) {
    fail("matrix engineVersion must be semantic version X.Y.Z");
  }

  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDirectory, "package.json"), "utf8"));
  if (matrix.engineVersion !== packageJson.version) {
    fail("matrix engineVersion and package version must match");
  }

  if (!Array.isArray(matrix.fixtures) || !matrix.fixtures.length) {
    fail("matrix fixtures must be a non-empty array");
    return errors;
  }

  const seenFiles = new Set();
  let attributionFixtureCount = 0;

  matrix.fixtures.forEach((fixture, index) => {
    const label = fixture && fixture.file ? fixture.file : `fixture ${index + 1}`;
    if (!sameKeys(fixture, fixtureKeys)) {
      fail(`${label} keys must be exactly: ${fixtureKeys.join(", ")}`);
      return;
    }
    if (!/^[a-z0-9-]+\.html$/.test(fixture.file)) fail(`${label} must use a safe fixture basename`);
    if (seenFiles.has(fixture.file)) fail(`${label} appears more than once`);
    seenFiles.add(fixture.file);
    if (!contracts.has(fixture.contract)) fail(`${label} has an unknown contract`);
    if (!adapters.has(fixture.adapter)) fail(`${label} has an unknown adapter`);
    if (!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(fixture.locale)) fail(`${label} has an invalid locale`);
    if (!/^[A-Z]{3}$/.test(fixture.currency)) fail(`${label} has an invalid currency`);
    if (!(typeof fixture.baseline === "number" && Number.isFinite(fixture.baseline) && fixture.baseline > 0)) {
      fail(`${label} must declare a positive synthetic baseline`);
    }
    for (const field of ["publicPlatform", "publicPlatformVersion", "publicThemeVersion"]) {
      const value = String(fixture[field] || "");
      if (value.length < 3 || value.length > 80) fail(`${label} has an invalid ${field}`);
    }
    for (const field of ["publicPlatformVersion", "publicThemeVersion"]) {
      if (!/^[a-z0-9][a-z0-9.-]+$/.test(fixture[field])) fail(`${label} has an unsafe ${field}`);
    }

    const expected = fixture.expected;
    if (!sameKeys(expected, expectedKeys)) {
      fail(`${label} expected keys must be exactly: ${expectedKeys.join(", ")}`);
      return;
    }
    if (typeof expected.detected !== "boolean") fail(`${label} expected.detected must be boolean`);
    if (!statuses.has(expected.status)) fail(`${label} has an unknown expected status`);
    if (!(expected.reason === null || reasons.has(expected.reason))) fail(`${label} has an unknown safe-stop reason`);
    if (!isNullableSyntheticCode(expected.bestCode)) fail(`${label} has a non-synthetic best code`);
    if (!isNullableSyntheticCode(expected.bestCandidateCode)) fail(`${label} has a non-synthetic best candidate`);
    if (!isNullableNumber(expected.savings) || (expected.savings !== null && expected.savings <= 0)) {
      fail(`${label} has invalid expected savings`);
    }
    if (!isNullableInteger(expected.tested)) fail(`${label} has invalid expected tested`);
    for (const field of ["applyClicks", "removeClicks"]) {
      if (!(Number.isInteger(expected[field]) && expected[field] >= 0)) {
        fail(`${label} has invalid expected ${field}`);
      }
    }
    if (expected.zeroPurchaseClicks !== true) fail(`${label} must require zero purchase clicks`);
    if (typeof expected.creatorAttributionPreserved !== "boolean") {
      fail(`${label} creator-attribution expectation must be boolean`);
    }
    if (expected.creatorAttributionPreserved) {
      attributionFixtureCount += 1;
      if (fixture.file !== "generic.html" || fixture.contract !== "happy-path") {
        fail(`${label} may not own the creator-attribution preservation contract`);
      }
    }

    if (fixture.contract === "happy-path") {
      if (!expected.detected || expected.status !== "complete" || expected.reason !== null) {
        fail(`${label} happy-path contract must detect and complete without a reason`);
      }
      if (!expected.bestCode || expected.bestCandidateCode !== null || expected.savings === null) {
        fail(`${label} happy-path contract must declare a verified best code and savings`);
      }
      if (!Number.isInteger(expected.tested) || expected.tested < 1) {
        fail(`${label} happy-path contract must declare tested attempts`);
      }
    } else {
      if (expected.status === "complete" || expected.reason === null) {
        fail(`${label} safe-stop contract must stop with an allowlisted reason`);
      }
      if (expected.creatorAttributionPreserved) {
        fail(`${label} safe-stop contract cannot replace the creator-attribution fixture`);
      }
    }

    const fixturePath = path.join(fixturesDirectory, fixture.file);
    if (!fs.existsSync(fixturePath)) {
      fail(`${label} does not exist`);
    } else {
      const source = fs.readFileSync(fixturePath, "utf8");
      if (/<(?:script|link)\b[^>]+(?:src|href)=["']https?:\/\//i.test(source)) {
        fail(`${label} loads a remote fixture resource`);
      }
      if (/\bhttps?:\/\/|\bwww\.|\b[A-Za-z0-9-]+\.(?:com|net|org|shop|store)\b/i.test(source)) {
        fail(`${label} appears to contain a live host or URL`);
      }
    }
  });

  const attributionFixture = matrix.fixtures.find((fixture) => fixture.file === "generic.html");
  if (attributionFixtureCount !== 1 ||
      attributionFixture?.expected?.creatorAttributionPreserved !== true) {
    fail("exactly generic.html must own the creator-attribution preservation contract");
  }

  const htmlFiles = fs.readdirSync(fixturesDirectory)
    .filter((file) => file.endsWith(".html"))
    .sort();
  const matrixFiles = [...seenFiles].sort();
  if (JSON.stringify(htmlFiles) !== JSON.stringify(matrixFiles)) {
    fail("every fixture HTML file must appear exactly once in the support matrix");
  }

  const metadata = JSON.stringify({
    sourcePolicy: matrix.sourcePolicy,
    fixtures: matrix.fixtures.map(({ expected, ...fixture }) => ({
      ...fixture,
      expected: {
        status: expected.status,
        reason: expected.reason
      }
    }))
  });
  if (/\bhttps?:\/\/|\bwww\.|\b[A-Za-z0-9-]+\.(?:com|net|org|shop|store|io|co)\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|affiliate[_-]?id|creator-\d+|utm_/i.test(metadata)) {
    fail("fixture metadata must not contain live hosts/URLs, identities, or creator/affiliate identifiers");
  }

  return errors;
}

function main() {
  const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
  const errors = validateFixtureMatrix(matrix);
  if (errors.length) {
    process.stderr.write(`Comb fixture matrix validation failed:\n- ${errors.join("\n- ")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `Comb fixture matrix passed: ${matrix.fixtures.length} synthetic contracts, full HTML coverage, one creator-attribution owner.\n`
  );
}

if (require.main === module) main();

module.exports = { validateFixtureMatrix };
