"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createCompatibilityReport } = require("../src/shared/compatibility-report.js");
const {
  PROPOSAL_SCHEMA,
  createSyntheticFixtureProposal,
  validateSafeCompatibilityReport
} = require("../scripts/create-synthetic-fixture-proposal.js");

function report() {
  return createCompatibilityReport({
    detected: false,
    adapter: "generic",
    reason: "coupon_apply_button_not_found",
    input: { label: "creator-secret@example.test" },
    total: { amount: 132.95, currency: "USD" },
    hostname: "merchant.example",
    url: "https://merchant.example/checkout?affiliate_id=creator-secret",
    codes: ["PRIVATE20"]
  }, {
    extensionVersion: "0.7.0",
    generatedAt: "2026-08-15T00:00:00.000Z"
  });
}

test("fixture proposal copies only allowlisted coarse signals into invented placeholders", () => {
  const proposal = createSyntheticFixtureProposal(report(), { fixtureId: "generic-apply-missing" });
  assert.equal(proposal.schema, PROPOSAL_SCHEMA);
  assert.equal(proposal.sourceContract.compatibility.adapter, "generic");
  assert.equal(proposal.sourceContract.compatibility.reason, "coupon_apply_button_not_found");
  assert.equal(proposal.syntheticDraft.baseline, 100);
  assert.equal(proposal.syntheticDraft.proposalOnly, true);
  assert.equal(proposal.privacyBoundary.requiresIndependentMarkupAuthoring, true);
  const serialized = JSON.stringify(proposal);
  for (const secret of [
    "merchant.example",
    "132.95",
    "PRIVATE20",
    "creator-secret",
    "2026-08-15T00:00:00.000Z"
  ]) {
    assert.equal(serialized.includes(secret), false, `proposal leaked ${secret}`);
  }
});

test("fixture proposal rejects a hand-edited report with added checkout data", () => {
  const edited = report();
  edited.compatibility.selector = "#live-checkout-coupon";
  const errors = validateSafeCompatibilityReport(edited);
  assert.ok(errors.some((error) => error.includes("keys must be exactly")));
  assert.throws(
    () => createSyntheticFixtureProposal(edited, { fixtureId: "edited-report" }),
    /Safe compatibility report rejected/
  );
});

test("fixture proposal rejects weakened privacy or creator-attribution flags", () => {
  const weakened = report();
  weakened.privacy.includesCookiesOrCreatorTags = true;
  weakened.creatorAttribution.protected = false;
  const errors = validateSafeCompatibilityReport(weakened);
  assert.ok(errors.some((error) => error.includes("forbidden data")));
  assert.ok(errors.some((error) => error.includes("guarantee is missing")));
});

test("fixture proposal requires a bounded fixture ID", () => {
  assert.throws(
    () => createSyntheticFixtureProposal(report(), { fixtureId: "Merchant Example Checkout" }),
    /lowercase kebab-case/
  );
});

test("fixture proposal accepts the coarse Magento adapter enum", () => {
  const magentoReport = report();
  magentoReport.compatibility.adapter = "magento";
  const proposal = createSyntheticFixtureProposal(magentoReport, { fixtureId: "magento-luma-cart" });
  assert.equal(proposal.sourceContract.compatibility.adapter, "magento");
});
