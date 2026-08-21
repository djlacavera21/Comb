"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const errors = [];

function fail(message) {
  errors.push(message);
}

function walk(directory) {
  const output = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && [".git", "node_modules", "dist"].includes(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walk(absolutePath));
    else output.push(absolutePath);
  }

  return output;
}

if (manifest.manifest_version !== 3) fail("manifest_version must be 3");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (manifest.version !== packageJson.version) fail("manifest and package versions must match");
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) fail("manifest version must use X.Y.Z");
const milestoneLabel = `v${manifest.version.split(".").slice(0, 2).join(".")}`;
const expectedBackgroundScripts = [
  "src/shared/feed-verifier.js",
  "src/shared/source-policy.js",
  "src/background.js"
];
if (manifest.background?.service_worker !== "src/background.js" ||
    JSON.stringify(manifest.background?.scripts) !== JSON.stringify(expectedBackgroundScripts)) {
  fail("cross-browser background must declare the exact Chrome worker and ordered Firefox scripts");
}
if (manifest.minimum_chrome_version !== "121") {
  fail("dual Manifest V3 background fallback requires minimum Chrome 121");
}
const gecko = manifest.browser_specific_settings?.gecko || {};
if (gecko.id !== "@comb-djlacavera21" || gecko.strict_min_version !== "128.0") {
  fail("Firefox packaging must pin the Comb add-on ID and Firefox 128 minimum");
}
if (JSON.stringify(gecko.data_collection_permissions) !== JSON.stringify({ required: ["none"] })) {
  fail("Firefox packaging must declare that Comb collects and transmits no user data");
}
if (manifest.homepage_url !== "https://github.com/djlacavera21/Comb") {
  fail("manifest homepage must identify the public source repository");
}

const expectedPermissions = ["activeTab", "alarms", "scripting", "storage"];
const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];

for (const permission of expectedPermissions) {
  if (!permissions.includes(permission)) fail(`missing required permission: ${permission}`);
}

for (const permission of permissions) {
  if (!expectedPermissions.includes(permission)) fail(`unexpected permission: ${permission}`);
}

if (Array.isArray(manifest.host_permissions) && manifest.host_permissions.length) {
  fail(`${milestoneLabel} must not declare permanent host permissions`);
}

const optionalHosts = Array.isArray(manifest.optional_host_permissions)
  ? manifest.optional_host_permissions
  : [];
if (optionalHosts.length !== 1 || optionalHosts[0] !== "https://*/*") {
  fail(`${milestoneLabel} must declare only runtime-approved HTTPS feed origins`);
}

if (manifest.content_scripts) {
  fail(`${milestoneLabel} must inject only after a user gesture, not through static content scripts`);
}

const requiredFiles = [
  manifest.background && manifest.background.service_worker,
  ...(Array.isArray(manifest.background?.scripts) ? manifest.background.scripts : []),
  manifest.action && manifest.action.default_popup,
  manifest.options_page,
  ...Object.values((manifest.action && manifest.action.default_icon) || {}),
  ...Object.values(manifest.icons || {})
].filter(Boolean);

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) fail(`manifest file is missing: ${relativePath}`);
}

const sourceFiles = walk(path.join(root, "src"));
const executableFiles = sourceFiles.filter((file) => file.endsWith(".js"));
const packageFiles = sourceFiles.filter((file) => /\.(?:html|css|js)$/.test(file));
const forbiddenRuntimePatterns = [
  ["cookie API", /(?:chrome|browser|extensionApi)\s*\.\s*cookies\b/],
  ["cookie mutation", /document\s*\.\s*cookie\b/],
  ["request interception", /(?:chrome|browser|extensionApi)\s*\.\s*webRequest\b/],
  ["declarative request rewriting", /(?:chrome|browser|extensionApi)\s*\.\s*declarativeNetRequest\b/],
  ["new-window referral path", /\bwindow\s*\.\s*open\s*\(/],
  ["tab creation or navigation", /(?:chrome|browser|extensionApi)\s*\.\s*tabs\s*\.\s*(?:create|update)\s*\(/],
  ["page navigation", /\blocation\s*\.\s*(?:assign|replace)\s*\(/],
  ["page URL assignment", /\blocation\s*\.\s*(?:href|search)\s*=/],
  ["history rewrite", /\bhistory\s*\.\s*(?:pushState|replaceState)\s*\(/],
  ["XML HTTP client", /\bXMLHttpRequest\b/],
  ["web socket client", /\bWebSocket\b/],
  ["dynamic code evaluation", /\beval\s*\(|\bnew\s+Function\s*\(|\bimport\s*\(/],
  ["HTML injection", /\.innerHTML\s*=/]
];

for (const file of executableFiles) {
  const source = fs.readFileSync(file, "utf8");
  const relativePath = path.relative(root, file);

  for (const [label, pattern] of forbiddenRuntimePatterns) {
    if (pattern.test(source)) fail(`${relativePath} contains forbidden ${label} behavior`);
  }

  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    fail(`${relativePath} has invalid JavaScript: ${String(error.stderr || error.message).trim()}`);
  }
}

const fetchUsers = executableFiles.filter((file) => /\bfetch\s*\(/.test(fs.readFileSync(file, "utf8")));
if (fetchUsers.length !== 1 || path.relative(root, fetchUsers[0]) !== "src/background.js") {
  fail("only the background runtime may retrieve a user-approved signed feed");
} else {
  const backgroundSource = fs.readFileSync(fetchUsers[0], "utf8");
  const fetchCount = (backgroundSource.match(/\bfetch\s*\(/g) || []).length;
  if (fetchCount !== 1) fail("background runtime must contain exactly one bounded feed retrieval call");
  for (const requiredBoundary of [
    "CombSourcePolicy.normalizeSourceUrl",
    "extensionApi.permissions.contains",
    'credentials: "omit"',
    'redirect: "error"',
    'referrerPolicy: "no-referrer"',
    "verifyAndInstallEnvelope",
    "assertOptionsSender"
  ]) {
    if (!backgroundSource.includes(requiredBoundary)) {
      fail(`approved-source boundary is missing: ${requiredBoundary}`);
    }
  }
}
const backgroundRuntimeSource = fs.readFileSync(path.join(root, "src/background.js"), "utf8");
for (const compatibilityBoundary of [
  'typeof importScripts === "function"',
  "globalThis.browser || globalThis.chrome",
  "extensionApi.scripting.executeScript"
]) {
  if (!backgroundRuntimeSource.includes(compatibilityBoundary)) {
    fail(`cross-browser worker boundary is missing: ${compatibilityBoundary}`);
  }
}
for (const catalogBoundary of [
  'case "COMB_SEARCH_CATALOG"',
  "assertOptionsSender(sender)",
  "CombFeed.searchCatalog",
  "query: message.query",
  "status: message.status",
  "sort: message.sort"
]) {
  if (!backgroundRuntimeSource.includes(catalogBoundary)) {
    fail(`local catalog worker boundary is missing: ${catalogBoundary}`);
  }
}

for (const file of packageFiles) {
  const source = fs.readFileSync(file, "utf8");
  if (/\b(?:src|href)=["']https?:\/\//i.test(source)) {
    fail(`${path.relative(root, file)} loads a remote package resource`);
  }
}

if (packageJson.dependencies && Object.keys(packageJson.dependencies).length) {
  fail(`${milestoneLabel} must remain dependency-free`);
}

if (packageJson.devDependencies && Object.keys(packageJson.devDependencies).length) {
  fail(`${milestoneLabel} must remain dependency-free`);
}

if (!fs.existsSync(path.join(root, "src/shared/feed-verifier.js"))) {
  fail("signed-feed verifier is missing");
}
if (!fs.existsSync(path.join(root, "src/shared/source-policy.js"))) {
  fail("approved-source policy is missing");
}

const checkoutEngineSource = fs.readFileSync(path.join(root, "src/content/checkout-engine.js"), "utf8");
const checkoutEngineVersion = checkoutEngineSource.match(/const VERSION = "([^"]+)";/);
if (!checkoutEngineVersion || checkoutEngineVersion[1] !== manifest.version) {
  fail("checkout engine and manifest versions must match");
}

for (const requiredAdapterBoundary of [
  'id: "magento"',
  "form#discount-coupon-form",
  'id: "bigcommerce"',
  "wc-block-components-totals-coupon__form",
  "coupon_removal_unverified",
  "checkout_total_changed_during_run",
  "totalsMatch(restoredTotal, expectedTotal)"
]) {
  if (!checkoutEngineSource.includes(requiredAdapterBoundary)) {
    fail(`${milestoneLabel} checkout reliability boundary is missing: ${requiredAdapterBoundary}`);
  }
}

const popupHtml = fs.readFileSync(path.join(root, "src/popup/popup.html"), "utf8");
const optionsHtml = fs.readFileSync(path.join(root, "src/options/options.html"), "utf8");
const popupSource = fs.readFileSync(path.join(root, "src/popup/popup.js"), "utf8");
const optionsSource = fs.readFileSync(path.join(root, "src/options/options.js"), "utf8");
const runnerSource = fs.readFileSync(path.join(root, "src/content/runner.js"), "utf8");
for (const [label, source, boundary] of [
  ["popup", popupSource, "globalThis.browser || globalThis.chrome"],
  ["settings", optionsSource, "globalThis.browser || globalThis.chrome"],
  ["content runner", runnerSource, "root.browser || root.chrome"]
]) {
  if (!source.includes(boundary)) fail(`${label} cross-browser API boundary is missing`);
}
if (!popupHtml.includes('role="progressbar"') || !popupHtml.includes('aria-describedby="inputHelp"')) {
  fail("popup keyboard and progress accessibility contract is missing");
}
for (const reportBoundary of [
  "Save safe report",
  "no URL, totals, codes, page text, cookies, or creator tags",
  "../shared/compatibility-report.js"
]) {
  if (!popupHtml.includes(reportBoundary)) fail(`popup compatibility-report boundary is missing: ${reportBoundary}`);
}
const compatibilityReportSource = fs.readFileSync(path.join(root, "src/shared/compatibility-report.js"), "utf8");
for (const reportBoundary of [
  "comb.compatibility-report/v1",
  "automaticUpload: false",
  "sharingRequiresSeparateUserAction: true",
  "includesMerchantUrlOrHostname: false",
  "includesPageContentOrSelectors: false",
  "includesCouponCodes: false",
  "includesTotalsOrCurrencyValues: false",
  "includesCookiesOrCreatorTags: false",
  "Existing creator affiliate tags, referral parameters, and cookies remain untouched."
]) {
  if (!compatibilityReportSource.includes(reportBoundary)) {
    fail(`compatibility-report privacy boundary is missing: ${reportBoundary}`);
  }
}
for (const requiredImportButton of ["trustKeyButton", "signedFeedButton", "importButton"]) {
  if (!optionsHtml.includes(`id="${requiredImportButton}"`)) {
    fail(`settings keyboard import control is missing: ${requiredImportButton}`);
  }
}
for (const catalogControl of [
  'id="catalogHeading"',
  'id="catalogSearchInput"',
  'id="catalogStatusSelect"',
  'id="catalogSortSelect"',
  'id="catalogList"',
  "Catalog search runs inside Comb",
  "../shared/feed-verifier.js"
]) {
  if (!optionsHtml.includes(catalogControl)) {
    fail(`settings catalog contract is missing: ${catalogControl}`);
  }
}
const feedVerifierSource = fs.readFileSync(path.join(root, "src/shared/feed-verifier.js"), "utf8");
for (const catalogBoundary of [
  "function searchCatalog",
  'status = ["active", "expired", "all"]',
  'sort = ["recommended", "recent", "merchant"]',
  "sourceCount: group.feedIds.size",
  "queryTokens.every",
  "searchCatalog,"
]) {
  if (!feedVerifierSource.includes(catalogBoundary)) {
    fail(`verified catalog search boundary is missing: ${catalogBoundary}`);
  }
}
for (const privacyDisclosure of [
  'id="privacyHeading"',
  "The Comb developer receives none of that checkout data",
  "current merchant receives only the coupon token",
  "docs/PRIVACY.md"
]) {
  if (!optionsHtml.includes(privacyDisclosure)) {
    fail(`settings privacy summary is missing: ${privacyDisclosure}`);
  }
}

for (const requiredTool of [
  "scripts/browser-checkout-contracts.js",
  "scripts/run-browser-fixtures.js",
  "scripts/run-firefox-fixtures.js",
  "scripts/build-release.js",
  "scripts/build-store-package.js",
  "scripts/deterministic-zip.js",
  "scripts/validate-release-candidate.js",
  "scripts/validate-publication-record.js",
  "scripts/validate-store.js",
  "scripts/validate-fixture-matrix.js",
  "scripts/create-synthetic-fixture-proposal.js",
  "scripts/verify-release-artifacts.js",
  "tests/deterministic-zip.test.cjs",
  "tests/browser-compatibility.test.cjs",
  "tests/compatibility-report.test.cjs",
  "tests/fixture-matrix.test.cjs",
  "tests/firefox-webdriver.test.cjs",
  "tests/release-artifacts.test.cjs",
  "tests/release-candidate.test.cjs",
  "tests/publication-record.test.cjs",
  "tests/synthetic-fixture-proposal.test.cjs",
  "CHANGELOG.md",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/ISSUE_TEMPLATE/compatibility.yml",
  ".github/ISSUE_TEMPLATE/independent-review.yml",
  ".github/ISSUE_TEMPLATE/synthetic-fixture.yml",
  ".github/workflows/release.yml",
  ".github/workflows/verify.yml",
  "docs/COMPATIBILITY.md",
  "docs/FIREFOX.md",
  "docs/INDEPENDENT_REVIEW.md",
  "docs/PUBLICATION_STATUS.md",
  "docs/SYNTHETIC_FIXTURES.md",
  "docs/SUPPORT_TRIAGE.md",
  "store/firefox-description.txt",
  "store/firefox-review-notes.md",
  "store/REVIEW_RESPONSE_PLAYBOOK.md",
  "tests/fixtures/woocommerce-blocks.html",
  "tests/fixtures/woocommerce-classic-es.html",
  "tests/fixtures/shopify-swiss.html",
  "tests/fixtures/generic-rtl-aed.html",
  "tests/fixtures/bigcommerce.html",
  "tests/fixtures/magento-luma.html",
  "tests/fixtures/magento-checkout.html",
  "tests/fixtures/removal-failure.html",
  "tests/fixtures/restoration-mismatch.html",
  "tests/fixtures/currency-drift.html",
  "tests/fixtures/support-matrix.json"
]) {
  if (!fs.existsSync(path.join(root, requiredTool))) {
    fail(`${milestoneLabel} verification tool is missing: ${requiredTool}`);
  }
}
const issueConfigSource = fs.readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/config.yml"), "utf8");
if (!issueConfigSource.includes("https://github.com/djlacavera21/Comb/security/policy") ||
    issueConfigSource.includes("security/advisories/new")) {
  fail("issue intake must not link to private vulnerability reporting while it is disabled");
}
const compatibilityFormSource = fs.readFileSync(
  path.join(root, ".github/ISSUE_TEMPLATE/compatibility.yml"),
  "utf8"
);
for (const intakeBoundary of [
  "Save safe report",
  "Do not include a checkout URL",
  "Paste only JSON created by the popup",
  "contains no live URL, hostname, page source, screenshot, cookie, coupon code, total",
  "stops on unknown or ambiguous markup"
]) {
  if (!compatibilityFormSource.includes(intakeBoundary)) {
    fail(`compatibility issue form is missing: ${intakeBoundary}`);
  }
}
if (/type:\s*upload\b/.test(compatibilityFormSource)) {
  fail("compatibility issue form must not invite live checkout file uploads");
}
const syntheticFixtureFormSource = fs.readFileSync(
  path.join(root, ".github/ISSUE_TEMPLATE/synthetic-fixture.yml"),
  "utf8"
);
for (const fixtureBoundary of [
  "not a live checkout capture",
  "generic official platform documentation",
  "independently authored this proposal",
  "no live checkout data",
  "preserve creator attribution"
]) {
  if (!syntheticFixtureFormSource.includes(fixtureBoundary)) {
    fail(`synthetic-fixture issue form is missing: ${fixtureBoundary}`);
  }
}
if (/type:\s*upload\b/.test(syntheticFixtureFormSource)) {
  fail("synthetic-fixture issue form must not invite evidence uploads");
}
const syntheticProposalSource = fs.readFileSync(
  path.join(root, "scripts/create-synthetic-fixture-proposal.js"),
  "utf8"
);
for (const proposalBoundary of [
  "allowlisted-enums-and-booleans-only",
  "generatedAtCopied: false",
  "liveMarkupAllowed: false",
  "creatorIdentifiersAllowed: false",
  "requiresIndependentMarkupAuthoring: true",
  "preserve-existing-url-parameters-and-cookies"
]) {
  if (!syntheticProposalSource.includes(proposalBoundary)) {
    fail(`synthetic fixture proposal boundary is missing: ${proposalBoundary}`);
  }
}
const independentReviewFormSource = fs.readFileSync(
  path.join(root, ".github/ISSUE_TEMPLATE/independent-review.yml"),
  "utf8"
);
for (const reviewBoundary of [
  "public repository evidence only",
  "full 40-character commit SHA",
  "Creator attribution and zero-affiliate behavior",
  "Do not publish a security-sensitive finding here",
  "does not claim every live merchant or theme is supported"
]) {
  if (!independentReviewFormSource.includes(reviewBoundary)) {
    fail(`independent-review issue form is missing: ${reviewBoundary}`);
  }
}
if (/type:\s*upload\b/.test(independentReviewFormSource)) {
  fail("independent-review issue form must not invite evidence uploads");
}
const releaseWorkflowSource = fs.readFileSync(path.join(root, ".github/workflows/release.yml"), "utf8");
if (/^  (?:push|pull_request|pull_request_target|schedule|workflow_run):/m.test(releaseWorkflowSource)) {
  fail("release workflow must be manually dispatched only");
}
if ((releaseWorkflowSource.match(/contents:\s*write/g) || []).length !== 1) {
  fail("release workflow must declare exactly one contents: write permission");
}
for (const releaseBoundary of [
  "workflow_dispatch:",
  "confirm_creator_attribution:",
  "CONFIRM_CREATOR_ATTRIBUTION",
  "ref: ${{ inputs.commit_sha }}",
  "persist-credentials: false",
  "git fetch --no-tags origin main:refs/remotes/origin/main",
  "validate-release-candidate.js",
  "git ls-remote --exit-code --tags",
  "npm run lint",
  "node --test tests/*.test.cjs",
  "run-browser-fixtures.js --require-browser",
  "browser-actions/setup-firefox@v1",
  "browser-actions/setup-geckodriver@latest",
  "openssl version",
  "run-firefox-fixtures.js --require-browser",
  "npm run release:build",
  "verify-release-artifacts.js",
  "gh release create",
  '--target "$EXPECTED_SHA"',
  "comb-${EXPECTED_VERSION}-store-review-kit.zip.sha256",
  "git rev-list -n 1",
  "gh release view"
]) {
  if (!releaseWorkflowSource.includes(releaseBoundary)) {
    fail(`release workflow boundary is missing: ${releaseBoundary}`);
  }
}
const verifyWorkflowSource = fs.readFileSync(path.join(root, ".github/workflows/verify.yml"), "utf8");
for (const currentAction of [
  "actions/checkout@v7",
  "actions/setup-node@v7",
  "actions/upload-artifact@v7",
  "browser-actions/setup-firefox@v1",
  "browser-actions/setup-geckodriver@latest",
  "openssl version",
  "run-firefox-fixtures.js --require-browser",
  "package-manager-cache: false"
]) {
  if (!verifyWorkflowSource.includes(currentAction)) {
    fail(`required CI action boundary is missing: ${currentAction}`);
  }
}
if (verifyWorkflowSource.includes("contents: write")) {
  fail("push and pull-request verification must remain read-only");
}
const checkoutContractSource = fs.readFileSync(
  path.join(root, "scripts/browser-checkout-contracts.js"),
  "utf8"
);
for (const requiredBrowserBoundary of [
  "creator_attribution=creator-42",
  "creator URL tags and attribution cookie must remain unchanged",
  "support-matrix.json",
  "fixtureMatrix.fixtures.filter",
  "assertFixtureState",
  "assertSafeStopResult",
  "dangerClicks"
]) {
  if (!checkoutContractSource.includes(requiredBrowserBoundary)) {
    fail(`${milestoneLabel} shared browser safety boundary is missing: ${requiredBrowserBoundary}`);
  }
}
const browserFixtureSource = fs.readFileSync(path.join(root, "scripts/run-browser-fixtures.js"), "utf8");
for (const requiredBrowserBoundary of [
  "runCheckoutFixtureSuite",
  "privacy-safe compatibility report contract",
  "settings catalog, keyboard, and file-import contract",
  "catalogStatusSelect",
  "globalThis.browser ="
]) {
  if (!browserFixtureSource.includes(requiredBrowserBoundary)) {
    fail(`${milestoneLabel} browser safety boundary is missing: ${requiredBrowserBoundary}`);
  }
}
const firefoxFixtureSource = fs.readFileSync(path.join(root, "scripts/run-firefox-fixtures.js"), "utf8");
for (const requiredFirefoxBoundary of [
  "class WebDriverClient",
  'browserName: "firefox"',
  'args: ["-headless"]',
  'AbortSignal.timeout(500)',
  '["--allow-system-access", "--host", "127.0.0.1", "--port", String(port)]',
  '/moz/addon/install',
  "temporary: true",
  '/moz/context',
  '"addon-webext-permissions"',
  "browser.permissions.contains",
  "Comb Synthetic Test Only",
  "acceptInsecureCerts: true",
  '"network.proxy.ssl": "127.0.0.1"',
  'type: "COMB_DELETE_FEED_SOURCE"',
  'type: "COMB_DELETE_TRUST_KEY"',
  'tamperedEnvelope.payload.entries[0].code = "TAMPERED10"',
  "feedService.setEnvelope(tamperedEnvelope)",
  "source connection failed: feed signature verification failed",
  "feedRequest.headers.cookie",
  "feedRequest.headers.referer",
  'const FEED_REFRESH_ALARM = "comb-signed-feed-refresh"',
  "packaged Firefox invalid-feed origin rollback",
  "packaged Firefox signed-feed acceptance and bounded request",
  "packaged Firefox production alarm, source, and origin cleanup",
  "Comb packaged Firefox extension suite passed",
  "runCheckoutFixtureSuite",
  "Comb real-Firefox checkout suite passed",
  "Firefox fixtures did not run"
]) {
  if (!firefoxFixtureSource.includes(requiredFirefoxBoundary)) {
    fail(`${milestoneLabel} Firefox browser boundary is missing: ${requiredFirefoxBoundary}`);
  }
}
const storePackageSource = fs.readFileSync(path.join(root, "scripts/build-store-package.js"), "utf8");
for (const requiredReviewKitEvidence of [
  'entry("evidence/verify-workflow.yml", ".github/workflows/verify.yml")',
  'entry("evidence/browser-checkout-contracts.js", "scripts/browser-checkout-contracts.js")',
  'entry("evidence/run-browser-fixtures.js", "scripts/run-browser-fixtures.js")',
  'entry("evidence/run-firefox-fixtures.js", "scripts/run-firefox-fixtures.js")',
  'entry("evidence/firefox-webdriver.test.cjs", "tests/firefox-webdriver.test.cjs")',
  'entry("listing/firefox-description.txt", "store/firefox-description.txt")',
  'entry("listing/firefox-review-notes.md", "store/firefox-review-notes.md")',
  'entry("listing/LICENSE", "LICENSE")'
]) {
  if (!storePackageSource.includes(requiredReviewKitEvidence)) {
    fail(`${milestoneLabel} reviewer kit evidence is missing: ${requiredReviewKitEvidence}`);
  }
}
if (!packageJson.engines || packageJson.engines.node !== ">=22") {
  fail(`${milestoneLabel} tooling requires the stable WebSocket API in Node 22 or newer`);
}
if (packageJson.scripts?.["release:build"] !== "node scripts/build-store-package.js --verify") {
  fail(`${milestoneLabel} release build must produce the validated store review kit`);
}
if (packageJson.scripts?.lint !==
    "node scripts/validate-fixture-matrix.js && node scripts/validate-extension.js && node scripts/validate-store.js && node scripts/validate-publication-record.js") {
  fail(`${milestoneLabel} lint must validate the matrix, runtime/workflow, store, and publication boundaries`);
}
if (packageJson.scripts?.["fixture:proposal"] !== "node scripts/create-synthetic-fixture-proposal.js") {
  fail("fixture proposal command must use the privacy-safe offline scaffold");
}
if (packageJson.scripts?.["test:firefox"] !== "node scripts/run-firefox-fixtures.js") {
  fail("Firefox fixture command must use the dependency-free WebDriver runner");
}

for (const file of walk(root).filter((entry) => entry.endsWith(".json") && !entry.includes(`${path.sep}.git${path.sep}`))) {
  const source = fs.readFileSync(file, "utf8");
  if (/"d"\s*:\s*"[A-Za-z0-9_-]{20,}"/.test(source)) {
    fail(`${path.relative(root, file)} appears to contain an ECDSA private signing key`);
  }
}

if (errors.length) {
  process.stderr.write(`Comb validation failed:\n- ${errors.join("\n- ")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Comb validation passed: ${executableFiles.length} scripts checked; permissions and creator attribution are protected.\n`
  );
}
