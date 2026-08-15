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
if (!/^0\.7\./.test(manifest.version)) fail("manifest version must match the v0.7 milestone");
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
  fail("v0.7 must not declare permanent host permissions");
}

const optionalHosts = Array.isArray(manifest.optional_host_permissions)
  ? manifest.optional_host_permissions
  : [];
if (optionalHosts.length !== 1 || optionalHosts[0] !== "https://*/*") {
  fail("v0.7 must declare only runtime-approved HTTPS feed origins");
}

if (manifest.content_scripts) {
  fail("v0.7 must inject only after a user gesture, not through static content scripts");
}

const requiredFiles = [
  manifest.background && manifest.background.service_worker,
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
  ["cookie API", /chrome\s*\.\s*cookies\b/],
  ["cookie mutation", /document\s*\.\s*cookie\b/],
  ["request interception", /chrome\s*\.\s*webRequest\b/],
  ["declarative request rewriting", /chrome\s*\.\s*declarativeNetRequest\b/],
  ["new-window referral path", /\bwindow\s*\.\s*open\s*\(/],
  ["tab creation or navigation", /chrome\s*\.\s*tabs\s*\.\s*(?:create|update)\s*\(/],
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
  fail("only the service worker may retrieve a user-approved signed feed");
} else {
  const backgroundSource = fs.readFileSync(fetchUsers[0], "utf8");
  const fetchCount = (backgroundSource.match(/\bfetch\s*\(/g) || []).length;
  if (fetchCount !== 1) fail("service worker must contain exactly one bounded feed retrieval call");
  for (const requiredBoundary of [
    "CombSourcePolicy.normalizeSourceUrl",
    "chrome.permissions.contains",
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

for (const file of packageFiles) {
  const source = fs.readFileSync(file, "utf8");
  if (/\b(?:src|href)=["']https?:\/\//i.test(source)) {
    fail(`${path.relative(root, file)} loads a remote package resource`);
  }
}

if (packageJson.dependencies && Object.keys(packageJson.dependencies).length) {
  fail("v0.7 must remain dependency-free");
}

if (packageJson.devDependencies && Object.keys(packageJson.devDependencies).length) {
  fail("v0.7 must remain dependency-free");
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
  'id: "bigcommerce"',
  "wc-block-components-totals-coupon__form",
  "coupon_removal_unverified",
  "checkout_total_changed_during_run",
  "totalsMatch(restoredTotal, expectedTotal)"
]) {
  if (!checkoutEngineSource.includes(requiredAdapterBoundary)) {
    fail(`v0.7 checkout reliability boundary is missing: ${requiredAdapterBoundary}`);
  }
}

const popupHtml = fs.readFileSync(path.join(root, "src/popup/popup.html"), "utf8");
const optionsHtml = fs.readFileSync(path.join(root, "src/options/options.html"), "utf8");
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
  "scripts/run-browser-fixtures.js",
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
  "tests/compatibility-report.test.cjs",
  "tests/fixture-matrix.test.cjs",
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
  "docs/INDEPENDENT_REVIEW.md",
  "docs/PUBLICATION_STATUS.md",
  "docs/SYNTHETIC_FIXTURES.md",
  "docs/SUPPORT_TRIAGE.md",
  "store/REVIEW_RESPONSE_PLAYBOOK.md",
  "tests/fixtures/woocommerce-blocks.html",
  "tests/fixtures/woocommerce-classic-es.html",
  "tests/fixtures/shopify-swiss.html",
  "tests/fixtures/generic-rtl-aed.html",
  "tests/fixtures/bigcommerce.html",
  "tests/fixtures/removal-failure.html",
  "tests/fixtures/restoration-mismatch.html",
  "tests/fixtures/currency-drift.html",
  "tests/fixtures/support-matrix.json"
]) {
  if (!fs.existsSync(path.join(root, requiredTool))) fail(`v0.7 verification tool is missing: ${requiredTool}`);
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
  "package-manager-cache: false"
]) {
  if (!verifyWorkflowSource.includes(currentAction)) {
    fail(`required CI action boundary is missing: ${currentAction}`);
  }
}
if (verifyWorkflowSource.includes("contents: write")) {
  fail("push and pull-request verification must remain read-only");
}
const browserFixtureSource = fs.readFileSync(path.join(root, "scripts/run-browser-fixtures.js"), "utf8");
for (const requiredBrowserBoundary of [
  "creator_attribution=creator-42",
  "creator URL tags and attribution cookie must remain unchanged",
  "support-matrix.json",
  "fixtureMatrix.fixtures.filter",
  "assertFixtureState",
  "assertSafeStopResult",
  "privacy-safe compatibility report contract",
  "dangerClicks"
]) {
  if (!browserFixtureSource.includes(requiredBrowserBoundary)) {
    fail(`v0.7 browser safety boundary is missing: ${requiredBrowserBoundary}`);
  }
}
if (!packageJson.engines || packageJson.engines.node !== ">=22") {
  fail("v0.7 tooling requires the stable WebSocket API in Node 22 or newer");
}
if (packageJson.scripts?.["release:build"] !== "node scripts/build-store-package.js --verify") {
  fail("v0.7 release build must produce the validated store review kit");
}
if (packageJson.scripts?.lint !==
    "node scripts/validate-fixture-matrix.js && node scripts/validate-extension.js && node scripts/validate-store.js && node scripts/validate-publication-record.js") {
  fail("v0.7 lint must validate the matrix, runtime/workflow, store, and publication boundaries");
}
if (packageJson.scripts?.["fixture:proposal"] !== "node scripts/create-synthetic-fixture-proposal.js") {
  fail("fixture proposal command must use the privacy-safe offline scaffold");
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
