"use strict";

(function initializeCompatibilityReport(root, factory) {
  const api = factory();

  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root) root.CombCompatibilityReport = api;
})(typeof globalThis === "object" ? globalThis : this, () => {
  const SCHEMA = "comb.compatibility-report/v1";
  const ADAPTERS = new Set(["woocommerce", "bigcommerce", "shopify", "generic"]);
  const REASONS = new Set([
    "coupon_input_not_found",
    "coupon_apply_button_not_found",
    "payable_total_not_found",
    "existing_coupon_detected",
    "coupon_removal_unverified",
    "checkout_total_changed_during_run",
    "best_coupon_could_not_be_restored",
    "stopped_to_preserve_checkout_state"
  ]);

  function safeVersion(value) {
    const candidate = String(value == null ? "" : value).trim();
    return /^\d+\.\d+\.\d+(?:\.\d+)?$/.test(candidate) ? candidate : "unknown";
  }

  function safeTimestamp(value) {
    const candidate = value == null ? new Date() : new Date(value);
    return Number.isFinite(candidate.getTime()) ? candidate.toISOString() : new Date().toISOString();
  }

  function createCompatibilityReport(scan, options = {}) {
    const source = scan && typeof scan === "object" ? scan : {};
    const detected = source.detected === true;
    const adapter = ADAPTERS.has(source.adapter) ? source.adapter : "unknown";
    const reason = source.reason == null
      ? (detected ? null : "unknown_markup")
      : (REASONS.has(source.reason) ? source.reason : "unknown_markup");

    return {
      schema: SCHEMA,
      extensionVersion: safeVersion(options.extensionVersion),
      generatedAt: safeTimestamp(options.generatedAt),
      compatibility: {
        detected,
        adapter,
        reason,
        couponInputDetected: Boolean(source.input),
        couponApplyControlDetected: Boolean(source.applyButton),
        payableTotalDetected: Boolean(source.total && Number.isFinite(source.total.amount)),
        existingCouponDetected: Number(source.existingCouponCount) > 0
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
    };
  }

  function stringifyCompatibilityReport(scan, options = {}) {
    return `${JSON.stringify(createCompatibilityReport(scan, options), null, 2)}\n`;
  }

  return Object.freeze({
    SCHEMA,
    createCompatibilityReport,
    stringifyCompatibilityReport
  });
});
