"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const fixtureMatrix = JSON.parse(
  fs.readFileSync(path.join(root, "tests/fixtures/support-matrix.json"), "utf8")
);
const fixturesByFile = new Map(fixtureMatrix.fixtures.map((fixture) => [fixture.file, fixture]));

function assertFixtureState(state, expected) {
  assert.equal(state.applyClicks, expected.applyClicks, "synthetic Apply click count changed");
  assert.equal(state.removeClicks, expected.removeClicks, "synthetic removal click count changed");
  if (expected.zeroPurchaseClicks) {
    assert.equal(state.dangerClicks, 0, "purchase controls must never be clicked");
  }
}

function assertSafeStopResult(result, specification) {
  const expected = specification.expected;
  assert.equal(result.status, expected.status, `${specification.file} status contract changed`);
  assert.equal(result.reason, expected.reason, `${specification.file} reason contract changed`);
  assert.equal(result.scan.adapter, specification.adapter, `${specification.file} adapter contract changed`);
  assert.equal(result.scan.detected, expected.detected, `${specification.file} detection contract changed`);
  assert.equal(result.scan.engineVersion, fixtureMatrix.engineVersion);
  assert.equal(result.scan.total.currency, specification.currency);
  assert.ok(Math.abs(result.scan.total.amount - specification.baseline) < 0.01);
  if (expected.tested === null) {
    assert.equal(result.results.length, 0, `${specification.file} must stop before a coupon attempt`);
  } else {
    assert.equal(result.tested, expected.tested, `${specification.file} attempt count changed`);
  }
  assert.equal(result.best?.code || null, expected.bestCode);
  assert.equal(result.bestCandidate?.code || null, expected.bestCandidateCode);
  if (expected.savings !== null) {
    const measured = result.best?.savings ?? result.bestCandidate?.savings;
    assert.ok(Math.abs(measured - expected.savings) < 0.01);
  }
}

function couponRunExpression(codes) {
  return `globalThis.CombCheckout.runCoupons(document, ${JSON.stringify(codes)}, {
    settle: { minimumMs: 250, maximumMs: 600, quietMs: 150 }
  })`;
}

async function verifyHappyFixture(controller, baseUrl, specification) {
  const { evaluate, openPage, write } = controller;
  const expected = specification.expected;
  const attributionQuery = expected.creatorAttributionPreserved
    ? "?affiliate_id=creator-42&utm_source=creator"
    : "";
  await openPage(`${baseUrl}/tests/fixtures/${specification.file}${attributionQuery}`);
  const attributionBefore = expected.creatorAttributionPreserved
    ? await evaluate(`(() => {
        document.cookie = "creator_attribution=creator-42; Path=/; SameSite=Lax";
        return { href: location.href, cookie: document.cookie };
      })()`)
    : null;
  const scan = await evaluate("globalThis.CombCheckout.scanCheckout(document)");
  assert.equal(scan.detected, expected.detected, `${specification.file} detection contract changed`);
  assert.equal(scan.adapter, specification.adapter);
  assert.equal(scan.engineVersion, fixtureMatrix.engineVersion);
  assert.equal(scan.total.currency, specification.currency);
  assert.ok(Math.abs(scan.total.amount - specification.baseline) < 0.01);
  assert.equal(scan.existingCouponCount, 0);

  const result = await evaluate(couponRunExpression(["SHIPFREE", "BEST20", "NOTREAL"]), 30_000);
  assert.equal(result.status, expected.status);
  assert.equal(result.reason, expected.reason);
  assert.equal(result.best.code, expected.bestCode);
  assert.equal(result.tested, expected.tested);
  assert.ok(Math.abs(result.finalTotal - (specification.baseline - expected.savings)) < 0.01);
  const state = await evaluate("globalThis.fixtureState");
  assertFixtureState(state, expected);
  assert.equal(state.appliedCode, expected.bestCode);
  if (expected.creatorAttributionPreserved) {
    const attributionAfter = await evaluate("({ href: location.href, cookie: document.cookie })");
    assert.deepEqual(attributionAfter, attributionBefore, "creator URL tags and attribution cookie must remain unchanged");
    write("✓ creator URL and cookie attribution preservation\n");
  }
}

async function runCheckoutFixtureSuite(options) {
  const controller = {
    evaluate: options.evaluate,
    openPage: options.openPage,
    write: options.write || ((message) => process.stdout.write(message))
  };
  if (typeof controller.evaluate !== "function" || typeof controller.openPage !== "function") {
    throw new TypeError("checkout fixture controller requires evaluate and openPage functions");
  }
  const { baseUrl } = options;
  if (!/^http:\/\/127\.0\.0\.1:[1-9][0-9]*$/.test(String(baseUrl || ""))) {
    throw new TypeError("checkout fixture server must use a loopback HTTP origin");
  }

  const happyFixtures = fixtureMatrix.fixtures.filter((fixture) => fixture.contract === "happy-path");
  const expectedSafeStopFiles = [
    "ambiguous.html",
    "currency-drift.html",
    "existing-coupon.html",
    "removal-failure.html",
    "restoration-mismatch.html"
  ];
  assert.deepEqual(
    fixtureMatrix.fixtures
      .filter((fixture) => fixture.contract === "safe-stop")
      .map((fixture) => fixture.file)
      .sort(),
    expectedSafeStopFiles,
    "every matrix safe-stop contract must have an executed specialized assertion"
  );

  for (const specification of happyFixtures) {
    await verifyHappyFixture(controller, baseUrl, specification);
    controller.write(`✓ ${specification.adapter} browser contract\n`);
  }

  const ambiguous = fixturesByFile.get("ambiguous.html");
  await controller.openPage(`${baseUrl}/tests/fixtures/${ambiguous.file}`);
  const ambiguousScan = await controller.evaluate("globalThis.CombCheckout.scanCheckout(document)");
  assert.equal(ambiguousScan.detected, ambiguous.expected.detected);
  assert.equal(ambiguousScan.reason, ambiguous.expected.reason);
  const ambiguousRun = await controller.evaluate(couponRunExpression(["SAVE10"]), 30_000);
  assertSafeStopResult(ambiguousRun, ambiguous);
  assertFixtureState(await controller.evaluate("globalThis.fixtureState"), ambiguous.expected);
  controller.write("✓ ambiguous purchase control refusal\n");

  const existing = fixturesByFile.get("existing-coupon.html");
  await controller.openPage(`${baseUrl}/tests/fixtures/${existing.file}`);
  const existingRun = await controller.evaluate(couponRunExpression(["SAVE10"]), 30_000);
  assertSafeStopResult(existingRun, existing);
  assertFixtureState(await controller.evaluate("globalThis.fixtureState"), existing.expected);
  controller.write("✓ existing-coupon safety gate\n");

  const removalFailure = fixturesByFile.get("removal-failure.html");
  await controller.openPage(`${baseUrl}/tests/fixtures/${removalFailure.file}`);
  const failedRemoval = await controller.evaluate(couponRunExpression(["SAVE10", "BEST20"]), 30_000);
  assertSafeStopResult(failedRemoval, removalFailure);
  const failureState = await controller.evaluate("globalThis.fixtureState");
  assertFixtureState(failureState, removalFailure.expected);
  assert.equal(failureState.appliedCode, removalFailure.expected.bestCode);
  controller.write("✓ failed-removal stop and no stacking\n");

  const restorationMismatch = fixturesByFile.get("restoration-mismatch.html");
  await controller.openPage(`${baseUrl}/tests/fixtures/${restorationMismatch.file}`);
  const incompleteRestoration = await controller.evaluate(
    couponRunExpression(["SAVE10", "BEST20"]),
    30_000
  );
  assertSafeStopResult(incompleteRestoration, restorationMismatch);
  assert.equal(incompleteRestoration.best, null, "an unverified partial removal must not be reported as applied");
  assert.equal(incompleteRestoration.bestCandidate.code, restorationMismatch.expected.bestCandidateCode);
  const incompleteState = await controller.evaluate("globalThis.fixtureState");
  assertFixtureState(incompleteState, restorationMismatch.expected);
  assert.equal(incompleteState.appliedCode, null);
  controller.write("✓ marker removal without baseline restoration stops safely\n");

  const currencyDriftFixture = fixturesByFile.get("currency-drift.html");
  await controller.openPage(`${baseUrl}/tests/fixtures/${currencyDriftFixture.file}`);
  const currencyDrift = await controller.evaluate(couponRunExpression(["NOTREAL", "BEST20"]), 30_000);
  assertSafeStopResult(currencyDrift, currencyDriftFixture);
  const driftState = await controller.evaluate("globalThis.fixtureState");
  assertFixtureState(driftState, currencyDriftFixture.expected);
  controller.write("✓ checkout currency drift stop\n");
}

module.exports = {
  couponRunExpression,
  fixtureMatrix,
  runCheckoutFixtureSuite
};
