"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const listingPath = path.join(root, "store/listing.json");
const listing = JSON.parse(fs.readFileSync(listingPath, "utf8"));
const errors = [];
const milestoneLabel = `v${manifest.version.split(".").slice(0, 2).join(".")}`;

function fail(message) {
  errors.push(message);
}

function read(relativePath) {
  const absolutePath = path.resolve(root, relativePath);
  if (!absolutePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(absolutePath)) {
    fail(`store file is missing or unsafe: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function pngDimensions(relativePath) {
  const absolutePath = path.resolve(root, relativePath);
  if (!absolutePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(absolutePath)) {
    fail(`store PNG is missing or unsafe: ${relativePath}`);
    return null;
  }
  const content = fs.readFileSync(absolutePath);
  const signature = "89504e470d0a1a0a";
  if (content.length < 24 || content.subarray(0, 8).toString("hex") !== signature ||
      content.subarray(12, 16).toString("ascii") !== "IHDR") {
    fail(`store asset is not a valid PNG: ${relativePath}`);
    return null;
  }
  return { width: content.readUInt32BE(16), height: content.readUInt32BE(20) };
}

function validateAsset(asset, label) {
  if (!asset || typeof asset.path !== "string") {
    fail(`${label} is missing from listing metadata`);
    return;
  }
  if (!Number.isInteger(asset.width) || !Number.isInteger(asset.height)) {
    fail(`${label} must declare integer dimensions`);
    return;
  }
  const actual = pngDimensions(asset.path);
  if (actual && (actual.width !== asset.width || actual.height !== asset.height)) {
    fail(`${label} is ${actual.width}x${actual.height}; expected ${asset.width}x${asset.height}`);
  }
}

if (listing.schemaVersion !== 1) fail("store listing schemaVersion must be 1");
if (listing.extensionVersion !== manifest.version) fail("store listing and manifest versions must match");
if (listing.lastReviewed !== "2026-08-21") fail("store listing review date must match the current official-policy review");
if (listing.shared?.name !== manifest.name) fail("store name must match the manifest");
if (listing.shared?.shortDescription !== manifest.description) {
  fail("store short description must match the manifest description");
}
if (String(listing.shared?.shortDescription || "").length > 132) {
  fail("store short description must not exceed 132 characters");
}
if (listing.shared?.category !== "Shopping") fail("store category must be Shopping");
if (listing.shared?.language !== "en") fail("store language must be en");
if (listing.shared?.homepageUrl !== manifest.homepage_url) fail("store homepage must match the manifest");
for (const field of ["homepageUrl", "supportUrl", "privacyPolicyUrl"]) {
  if (!/^https:\/\//.test(String(listing.shared?.[field] || ""))) fail(`${field} must be a public HTTPS URL`);
}
if (!String(listing.shared?.singlePurpose || "").includes("without changing creator affiliate attribution")) {
  fail("single-purpose disclosure must preserve creator attribution");
}

const expectedPermissionKeys = ["activeTab", "alarms", "optional_host_permissions", "scripting", "storage"];
const permissionKeys = Object.keys(listing.permissions || {}).sort();
if (JSON.stringify(permissionKeys) !== JSON.stringify(expectedPermissionKeys)) {
  fail(`store permission disclosures must be exactly: ${expectedPermissionKeys.join(", ")}`);
}
for (const [permission, explanation] of Object.entries(listing.permissions || {})) {
  if (String(explanation).length < 40) fail(`permission disclosure is too short: ${permission}`);
}

if (listing.privacy?.remoteCode?.usesRemoteCode !== false) fail("remote code must be declared false");
if (!String(listing.privacy?.remoteCode?.explanation || "").includes("packaged")) {
  fail("remote-code explanation must identify packaged code");
}
const expectedDataTypes = ["financial_and_payment_information", "web_history", "website_content"];
const dataTypes = [...(listing.privacy?.dashboardDataTypeSelections || [])].sort();
if (JSON.stringify(dataTypes) !== JSON.stringify(expectedDataTypes)) {
  fail(`store data-type selections must be exactly: ${expectedDataTypes.join(", ")}`);
}
const handling = listing.privacy?.dataHandling || [];
if (handling.length !== expectedDataTypes.length) fail("every selected data type needs one handling disclosure");
for (const dataType of expectedDataTypes) {
  const item = handling.find((candidate) => candidate.dashboardType === dataType);
  if (!item) {
    fail(`missing data-handling disclosure: ${dataType}`);
    continue;
  }
  if (item.developerReceives !== false || item.unrelatedThirdPartyReceives !== false) {
    fail(`${dataType} checkout data must not reach Comb or an unrelated third party`);
  }
  const recipients = item.recipients || [];
  if (!Array.isArray(recipients)) fail(`${dataType} recipients must be an array`);
  if (dataType === "website_content") {
    if (recipients.length !== 1 || !String(recipients[0]).includes("current merchant checkout")) {
      fail("website-content disclosure must name the current merchant as the coupon-token recipient");
    }
  } else if (recipients.length !== 0) {
    fail(`${dataType} must not declare a recipient`);
  }
  for (const field of ["scope", "purpose", "retention"]) {
    if (String(item[field] || "").length < 20) fail(`${dataType} needs a precise ${field} disclosure`);
  }
}
if (listing.privacy?.optionalFeedNetwork?.enabledByDefault !== false) {
  fail("optional network feeds must remain disabled by default");
}
const compatibilityReport = listing.privacy?.compatibilityReport || {};
if (compatibilityReport.userTriggeredOnly !== true || compatibilityReport.automaticUpload !== false ||
    compatibilityReport.extensionTransmitsToDeveloper !== false ||
    compatibilityReport.userMayShareSeparately !== true) {
  fail("compatibility reports must remain user-triggered, local, and never extension-transmitted");
}
for (const excludedField of ["URL/hostname", "coupon codes", "creator identifiers"]) {
  if (!String(compatibilityReport.excludedData || "").includes(excludedField)) {
    fail(`compatibility-report disclosure is missing: ${excludedField}`);
  }
}
for (const [certification, value] of Object.entries(listing.privacy?.limitedUseCertifications || {})) {
  if (value !== true) fail(`Limited Use certification must remain true: ${certification}`);
}
if (Object.keys(listing.privacy?.limitedUseCertifications || {}).length !== 5) {
  fail("all five Comb Limited Use commitments must be recorded");
}

if (listing.creatorAttribution?.zeroAffiliate !== true) fail("store listing must declare zero-affiliate mode");
const attributionMessage = String(listing.creatorAttribution?.publicMessage || "");
for (const phrase of [
  "creator-tagging issue is fixed",
  "affiliate tags",
  "cookies untouched",
  "proper attribution"
]) {
  if (!attributionMessage.includes(phrase)) fail(`creator-attribution store message is missing: ${phrase}`);
}
for (const evidencePath of listing.creatorAttribution?.verifiedBy || []) read(evidencePath);

const chromeDescription = read(listing.chrome?.detailedDescriptionFile);
const edgeDescription = read(listing.edge?.descriptionFile);
const firefoxDescription = read(listing.firefox?.descriptionFile);
const releaseNotes = read(listing.chrome?.releaseNotesFile);
const reviewNotes = read(listing.chrome?.reviewNotesFile);
const firefoxReviewNotes = read(listing.firefox?.reviewNotesFile);
for (const [label, description] of [
  ["Chrome", chromeDescription],
  ["Edge", edgeDescription],
  ["Firefox", firefoxDescription]
]) {
  if (description.length < 250 || description.length > 10_000) {
    fail(`${label} description must contain 250 to 10,000 characters`);
  }
  for (const phrase of ["creator-tagging issue is fixed", "attribution cookie", "developer does not receive"]) {
    if (!description.toLowerCase().includes(phrase)) fail(`${label} description is missing: ${phrase}`);
  }
  if (/v0\.4/.test(description)) fail(`${label} description contains stale v0.4 copy`);
}
if (!releaseNotes.includes(milestoneLabel) || !releaseNotes.includes("Magento") ||
    !releaseNotes.includes("community coupon catalog") || !releaseNotes.includes("attribution cookies") ||
    !releaseNotes.includes("safe compatibility report") ||
    !releaseNotes.includes("machine-readable synthetic fixture matrix") ||
    !releaseNotes.includes("publication workflow")) {
  fail(`${milestoneLabel} release notes must cover Magento, the catalog, the matrix, safe reporting, publication, and attribution`);
}
for (const phrase of [
  "affiliate_id=creator-42&utm_source=creator",
  "creator_attribution=creator-42",
  "Select **No, I am not using remote code**",
  "Financial and payment information",
  "Web history",
  "Website content"
]) {
  if (!reviewNotes.includes(phrase)) fail(`review notes are missing: ${phrase}`);
}
for (const phrase of [
  "creator-tagging issue is fixed",
  "affiliate_id=creator-42&utm_source=creator",
  "creator_attribution=creator-42",
  "data_collection_permissions.required",
  "run-firefox-fixtures.js --require-browser",
  "temporary-installs the exact runtime ZIP",
  "optional-origin prompt",
  "tampered envelope",
  "remove the newly approved optional origin",
  "Both observed GETs",
  "COMB_DELETE_FEED_SOURCE",
  "no private material is committed",
  "Only AMO state `public`"
]) {
  if (!firefoxReviewNotes.includes(phrase)) fail(`Firefox review notes are missing: ${phrase}`);
}

if (listing.firefox?.guid !== manifest.browser_specific_settings?.gecko?.id) {
  fail("Firefox listing GUID must match the manifest add-on ID");
}
if (!/^[a-z0-9-]{3,64}$/.test(String(listing.firefox?.slug || ""))) {
  fail("Firefox listing slug must be a bounded lowercase AMO slug");
}
if (listing.firefox?.defaultLocale !== "en-US") fail("Firefox default locale must be en-US");
if (listing.firefox?.summary !== listing.shared?.shortDescription) {
  fail("Firefox summary must match the shared manifest description");
}
if (String(listing.firefox?.summary || "").length > 250) {
  fail("Firefox summary must not exceed 250 characters");
}
if (JSON.stringify(listing.firefox?.categories) !== JSON.stringify({ firefox: ["shopping"] })) {
  fail("Firefox category must use the official shopping extension slug");
}
if (listing.firefox?.license?.kind !== "custom" ||
    listing.firefox?.license?.name !== "MIT License" ||
    listing.firefox?.license?.sourceFile !== "LICENSE") {
  fail("Firefox listing must bind the custom MIT license to LICENSE");
} else {
  const license = read(listing.firefox.license.sourceFile);
  if (!license.startsWith("MIT License\n")) fail("Firefox custom license source must contain the MIT license");
}
if (listing.firefox?.requiresPayment !== false) fail("Firefox listing must declare no required payment");
if (JSON.stringify(listing.firefox?.dataCollectionPermissions) !==
    JSON.stringify({ required: ["none"], optional: [] })) {
  fail("Firefox listing must declare no required or optional external data collection");
}
if (JSON.stringify(manifest.browser_specific_settings?.gecko?.data_collection_permissions) !==
    JSON.stringify({ required: ["none"] })) {
  fail("Firefox manifest data-collection declaration drifted from the listing");
}
if (listing.firefox?.releaseNotesFile !== listing.chrome?.releaseNotesFile) {
  fail("Firefox and Chrome release notes must use the same version evidence");
}

validateAsset(listing.chrome?.assets?.icon, "Chrome icon");
validateAsset(listing.chrome?.assets?.smallPromo, "Chrome small promo tile");
const marqueePromo = listing.chrome?.assets?.marqueePromo;
validateAsset(marqueePromo, "Chrome marquee promo tile");
if (marqueePromo?.width !== 1400 || marqueePromo?.height !== 560) {
  fail("Chrome marquee promo tile must declare 1400x560 dimensions");
}
const marqueeSource = read("store/assets/comb-marquee-promo-1400x560.svg");
for (const phrase of [
  "width=\"1400\"",
  "height=\"560\"",
  "Creator credit",
  "THE TAGGING ISSUE IS FIXED",
  "ATTRIBUTION",
  "UNCHANGED"
]) {
  if (!marqueeSource.includes(phrase)) fail(`marquee promo source is missing: ${phrase}`);
}
const chromeScreenshots = listing.chrome?.assets?.screenshots || [];
const expectedScreenshotPaths = [1, 2, 3, 4, 5]
  .map((number) => `store/assets/comb-screenshot-${String(number).padStart(2, "0")}-1280x800.png`);
const screenshotSources = expectedScreenshotPaths.map((assetPath, index) => {
  const source = read(assetPath.replace(/\.png$/, ".svg"));
  for (const phrase of ["width=\"1280\"", "height=\"800\"", `Comb ${milestoneLabel}`]) {
    if (!source.includes(phrase)) fail(`screenshot source ${index + 1} is missing: ${phrase}`);
  }
  return source;
});
for (const phrase of [
  "The tagging issue is fixed.",
  "affiliate_id=creator-42&amp;utm_source=creator",
  "creator_attribution=creator-42",
  "Proper attribution remains with the original creator."
]) {
  if (!screenshotSources[1].includes(phrase)) fail(`creator-attribution screenshot is missing: ${phrase}`);
}
function validateScreenshotSet(screenshots, label) {
  if (!Array.isArray(screenshots) || screenshots.length !== expectedScreenshotPaths.length) {
    fail(`${label} must declare the complete five-screenshot set`);
    return;
  }
  if (JSON.stringify(screenshots.map((asset) => asset.path)) !== JSON.stringify(expectedScreenshotPaths)) {
    fail(`${label} screenshots must use the numbered 01–05 store assets in order`);
  }
  if (new Set(screenshots.map((asset) => asset.caption)).size !== screenshots.length) {
    fail(`${label} screenshot captions must be unique`);
  }
  screenshots.forEach((asset, index) => {
    validateAsset(asset, `${label} screenshot ${index + 1}`);
    if (asset?.width !== 1280 || asset?.height !== 800) {
      fail(`${label} screenshot ${index + 1} must declare 1280x800 dimensions`);
    }
    if (String(asset?.caption || "").length < 60 || String(asset?.caption || "").length > 240) {
      fail(`${label} screenshot ${index + 1} needs a 60-to-240-character caption`);
    }
  });
}
validateScreenshotSet(chromeScreenshots, "Chrome");
validateAsset(listing.edge?.assets?.logo, "Edge logo");
validateAsset(listing.edge?.assets?.smallTile, "Edge small tile");
const edgeScreenshots = listing.edge?.assets?.screenshots || [];
validateScreenshotSet(edgeScreenshots, "Edge");
if (JSON.stringify(edgeScreenshots.map((asset) => asset.caption)) !==
    JSON.stringify(chromeScreenshots.map((asset) => asset.caption))) {
  fail("Chrome and Edge must use the same screenshot captions in the same order");
}
validateAsset(listing.firefox?.assets?.icon, "Firefox icon");
const firefoxScreenshots = listing.firefox?.assets?.screenshots || [];
validateScreenshotSet(firefoxScreenshots, "Firefox");
if (JSON.stringify(firefoxScreenshots.map((asset) => asset.caption)) !==
    JSON.stringify(chromeScreenshots.map((asset) => asset.caption))) {
  fail("Chrome and Firefox must use the same screenshot captions in the same order");
}

const searchTerms = listing.edge?.searchTerms || [];
if (searchTerms.length < 1 || searchTerms.length > 7) fail("Edge must have one to seven search terms");
if (new Set(searchTerms.map((term) => term.toLowerCase())).size !== searchTerms.length) {
  fail("Edge search terms must be unique");
}
if (searchTerms.some((term) => term.length > 30)) fail("each Edge search term must contain at most 30 characters");
if (searchTerms.join(" ").trim().split(/\s+/).length > 21) fail("Edge search terms must contain at most 21 words total");

const privacy = read("docs/PRIVACY.md");
const securityReview = read("docs/SECURITY_REVIEW.md");
const publicationStatus = read("docs/PUBLICATION_STATUS.md");
const syntheticFixtures = read("docs/SYNTHETIC_FIXTURES.md");
for (const phrase of ["on-device", "Limited Use commitments", "user-selected feed operator", "Financial and payment information"]) {
  if (!privacy.includes(phrase)) fail(`privacy policy is missing: ${phrase}`);
}
for (const phrase of ["not an external audit", "creator URL/cookie", "npm run release:build"]) {
  if (!securityReview.includes(phrase)) fail(`security review is missing: ${phrase}`);
}
for (const phrase of ["not publicly available", "The creator-tagging issue is fixed", "official publication status"]) {
  if (!publicationStatus.includes(phrase)) fail(`publication status is missing: ${phrase}`);
}
for (const phrase of ["independently written", "discards the report timestamp", "never generates or derives HTML"]) {
  if (!syntheticFixtures.includes(phrase)) fail(`synthetic fixture guide is missing: ${phrase}`);
}
read("store/SUBMISSION.md");
read("store/REVIEW_RESPONSE_PLAYBOOK.md");

if (errors.length) {
  process.stderr.write(`Comb store validation failed:\n- ${errors.join("\n- ")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Comb store validation passed: ${handling.length} local data disclosures, ${4 + chromeScreenshots.length} upload assets, three store profiles, and creator attribution review notes verified.\n`
  );
}
