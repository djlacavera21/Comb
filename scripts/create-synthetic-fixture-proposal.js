"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPORT_SCHEMA = "comb.compatibility-report/v1";
const PROPOSAL_SCHEMA = "comb.synthetic-fixture-proposal/v1";
const ADAPTERS = new Set(["magento", "woocommerce", "bigcommerce", "shopify", "generic", "unknown"]);
const REASONS = new Set([
  null,
  "unknown_markup",
  "coupon_input_not_found",
  "coupon_apply_button_not_found",
  "payable_total_not_found",
  "existing_coupon_detected",
  "coupon_removal_unverified",
  "checkout_total_changed_during_run",
  "best_coupon_could_not_be_restored",
  "stopped_to_preserve_checkout_state"
]);

function validateSafeCompatibilityReport(report) {
  const errors = [];
  const fail = (message) => errors.push(message);

  function exactKeys(value, expected, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail(`${label} must be an object`);
      return;
    }
    const actual = Object.keys(value).sort();
    const wanted = [...expected].sort();
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
      fail(`${label} keys must be exactly: ${wanted.join(", ")}`);
    }
  }

  exactKeys(report, [
    "compatibility",
    "creatorAttribution",
    "extensionVersion",
    "generatedAt",
    "privacy",
    "schema"
  ], "safe report");
  if (report?.schema !== REPORT_SCHEMA) fail(`safe report schema must be ${REPORT_SCHEMA}`);
  if (!/^(?:unknown|\d+\.\d+\.\d+(?:\.\d+)?)$/.test(String(report?.extensionVersion || ""))) {
    fail("safe report extension version is invalid");
  }
  if (typeof report?.generatedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(report.generatedAt) ||
      !Number.isFinite(new Date(report.generatedAt).getTime())) {
    fail("safe report timestamp is invalid");
  }

  const compatibility = report?.compatibility || {};
  exactKeys(compatibility, [
    "adapter",
    "couponApplyControlDetected",
    "couponInputDetected",
    "detected",
    "existingCouponDetected",
    "payableTotalDetected",
    "reason"
  ], "compatibility signals");
  if (!ADAPTERS.has(compatibility.adapter)) fail("compatibility adapter is not allowlisted");
  if (!REASONS.has(compatibility.reason)) fail("compatibility reason is not allowlisted");
  for (const field of [
    "detected",
    "couponInputDetected",
    "couponApplyControlDetected",
    "payableTotalDetected",
    "existingCouponDetected"
  ]) {
    if (typeof compatibility[field] !== "boolean") fail(`compatibility signal must be boolean: ${field}`);
  }

  const attribution = report?.creatorAttribution || {};
  exactKeys(attribution, ["message", "mode", "protected"], "creator attribution");
  if (attribution.protected !== true || attribution.mode !== "zero-affiliate" ||
      attribution.message !== "Existing creator affiliate tags, referral parameters, and cookies remain untouched.") {
    fail("creator-attribution guarantee is missing or changed");
  }

  const privacy = report?.privacy || {};
  exactKeys(privacy, [
    "automaticUpload",
    "includesCookiesOrCreatorTags",
    "includesCouponCodes",
    "includesMerchantUrlOrHostname",
    "includesPageContentOrSelectors",
    "includesTotalsOrCurrencyValues",
    "sharingRequiresSeparateUserAction"
  ], "privacy boundary");
  if (privacy.automaticUpload !== false || privacy.sharingRequiresSeparateUserAction !== true) {
    fail("safe report must remain local and separately user-shared");
  }
  for (const field of [
    "includesMerchantUrlOrHostname",
    "includesPageContentOrSelectors",
    "includesCouponCodes",
    "includesTotalsOrCurrencyValues",
    "includesCookiesOrCreatorTags"
  ]) {
    if (privacy[field] !== false) fail(`safe report includes forbidden data: ${field}`);
  }

  return errors;
}

function createSyntheticFixtureProposal(report, options = {}) {
  const errors = validateSafeCompatibilityReport(report);
  const fixtureId = String(options.fixtureId || "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fixtureId) || fixtureId.length > 64) {
    errors.push("fixture ID must be a lowercase kebab-case identifier of at most 64 characters");
  }
  if (errors.length) throw new Error(`Safe compatibility report rejected:\n- ${errors.join("\n- ")}`);

  const compatibility = report.compatibility;
  return {
    schema: PROPOSAL_SCHEMA,
    sourceContract: {
      reportSchema: report.schema,
      extensionVersion: report.extensionVersion,
      compatibility: {
        detected: compatibility.detected,
        adapter: compatibility.adapter,
        reason: compatibility.reason,
        couponInputDetected: compatibility.couponInputDetected,
        couponApplyControlDetected: compatibility.couponApplyControlDetected,
        payableTotalDetected: compatibility.payableTotalDetected,
        existingCouponDetected: compatibility.existingCouponDetected
      }
    },
    privacyBoundary: {
      copiedFromReport: "allowlisted-enums-and-booleans-only",
      generatedAtCopied: false,
      liveMarkupAllowed: false,
      liveCheckoutDataAllowed: false,
      creatorIdentifiersAllowed: false,
      requiresIndependentMarkupAuthoring: true,
      creatorAttributionInvariant: "preserve-existing-url-parameters-and-cookies"
    },
    syntheticDraft: {
      fixtureId,
      proposalOnly: true,
      publicPlatformSnapshot: "public-contract-pending",
      syntheticThemeVersion: `${fixtureId}-synthetic-v1`,
      locale: "en-US",
      currency: "USD",
      baseline: 100,
      shipping: 5,
      inventedCouponCodes: ["SAVE10", "BEST20", "SHIPFREE"],
      authoringInstruction: "Write new HTML from public platform documentation and invented labels; never copy a live checkout."
    }
  };
}

function optionValue(argv, name) {
  const indexes = argv.map((value, index) => value === name ? index : -1).filter((index) => index >= 0);
  if (indexes.length !== 1 || indexes[0] === argv.length - 1) {
    throw new Error(`${name} must be supplied exactly once`);
  }
  return argv[indexes[0] + 1];
}

function main() {
  const argv = process.argv.slice(2);
  const reportPath = path.resolve(optionValue(argv, "--report"));
  const outputPath = path.resolve(optionValue(argv, "--output"));
  const fixtureId = optionValue(argv, "--fixture-id");
  if (path.extname(reportPath).toLowerCase() !== ".json" || path.extname(outputPath).toLowerCase() !== ".json") {
    throw new Error("report and output paths must use the .json extension");
  }
  if (reportPath === outputPath) throw new Error("proposal output must not overwrite the source report");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const proposal = createSyntheticFixtureProposal(report, { fixtureId });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(proposal, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`Synthetic fixture proposal written: ${outputPath}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Comb synthetic fixture proposal failed: ${error.message || error}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  PROPOSAL_SCHEMA,
  createSyntheticFixtureProposal,
  validateSafeCompatibilityReport
};
