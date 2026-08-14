"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  SCHEMA,
  createCompatibilityReport,
  stringifyCompatibilityReport
} = require("../src/shared/compatibility-report.js");

test("compatibility report keeps only coarse allowlisted checkout signals", () => {
  const scan = {
    engineVersion: "0.6.0",
    detected: false,
    adapter: "generic",
    reason: "coupon_apply_button_not_found",
    input: {
      id: "coupon-creator-42",
      label: "Coupon for alex@example.test"
    },
    applyButton: null,
    total: { amount: 132.95, currency: "USD", text: "$132.95" },
    existingCouponCount: 0,
    attribution: { protected: true, affiliateId: "creator-secret" },
    hostname: "merchant.example",
    url: "https://merchant.example/checkout?affiliate_id=creator-secret",
    codes: ["SAVE-PRIVATE-20"]
  };

  assert.deepEqual(createCompatibilityReport(scan, {
    extensionVersion: "0.6.0",
    generatedAt: "2026-08-14T12:00:00.000Z"
  }), {
    schema: SCHEMA,
    extensionVersion: "0.6.0",
    generatedAt: "2026-08-14T12:00:00.000Z",
    compatibility: {
      detected: false,
      adapter: "generic",
      reason: "coupon_apply_button_not_found",
      couponInputDetected: true,
      couponApplyControlDetected: false,
      payableTotalDetected: true,
      existingCouponDetected: false
    },
    creatorAttribution: {
      protected: true,
      mode: "zero-affiliate",
      message: "Existing creator affiliate tags, referral parameters, and cookies remain untouched."
    },
    privacy: {
      automaticUpload: false,
      sharingRequiresSeparateUserAction: true,
      includesMerchantUrlOrHostname: false,
      includesPageContentOrSelectors: false,
      includesCouponCodes: false,
      includesTotalsOrCurrencyValues: false,
      includesCookiesOrCreatorTags: false
    }
  });

  const serialized = stringifyCompatibilityReport(scan, {
    extensionVersion: "0.6.0",
    generatedAt: "2026-08-14T12:00:00.000Z"
  });
  for (const secret of [
    "merchant.example",
    "132.95",
    "USD",
    "SAVE-PRIVATE-20",
    "creator-secret",
    "alex@example.test",
    "coupon-creator-42"
  ]) {
    assert.equal(serialized.includes(secret), false, `report leaked ${secret}`);
  }
});

test("compatibility report collapses untrusted adapter and reason strings", () => {
  const report = createCompatibilityReport({
    detected: false,
    adapter: "merchant-account-9382",
    reason: "private checkout text",
    existingCouponCount: 7
  }, {
    extensionVersion: "not-a-version",
    generatedAt: "2026-08-14T12:00:00Z"
  });

  assert.equal(report.extensionVersion, "unknown");
  assert.equal(report.compatibility.adapter, "unknown");
  assert.equal(report.compatibility.reason, "unknown_markup");
  assert.equal(report.compatibility.existingCouponDetected, true);
});
