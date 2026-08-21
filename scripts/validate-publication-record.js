"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const SCHEMA = "comb.publication-record/v3";
const REPOSITORY = "djlacavera21/Comb";
const DEVELOPMENT_LABELS = Object.freeze({
  unreleased: "Unreleased",
  released: "Released"
});
const CHROME_STATES = new Set([
  "not_submitted",
  "draft",
  "pending_review",
  "staged",
  "published",
  "published_to_testers",
  "rejected",
  "cancelled",
  "taken_down"
]);
const EDGE_STATES = new Set([
  "not_submitted",
  "in_draft",
  "in_review",
  "waiting_to_publish",
  "in_store",
  "in_store_update_in_review",
  "review_failed",
  "unavailable_in_store",
  "unpublished_from_store",
  "removed_from_store",
  "blocked"
]);
const FIREFOX_STATES = new Set([
  "not_submitted",
  "incomplete",
  "nominated",
  "public",
  "rejected",
  "disabled",
  "deleted"
]);
const PUBLICATION_LABELS = Object.freeze({
  github: Object.freeze({
    not_released: "Not released",
    released: "Released"
  }),
  chrome: Object.freeze({
    not_submitted: "Not submitted",
    draft: "Draft",
    pending_review: "Pending review",
    staged: "Staged",
    published: "Published",
    published_to_testers: "Published to trusted testers",
    rejected: "Rejected",
    cancelled: "Cancelled",
    taken_down: "Taken down"
  }),
  edge: Object.freeze({
    not_submitted: "Not submitted",
    in_draft: "In draft",
    in_review: "In review",
    waiting_to_publish: "Waiting to publish",
    in_store: "In the store",
    in_store_update_in_review: "In the store. Update in review",
    review_failed: "Review failed",
    unavailable_in_store: "Unavailable in store",
    unpublished_from_store: "Unpublished from store",
    removed_from_store: "Removed from store",
    blocked: "Blocked"
  }),
  firefox: Object.freeze({
    not_submitted: "Not submitted",
    incomplete: "Incomplete",
    nominated: "Awaiting review",
    public: "Public",
    rejected: "Rejected",
    disabled: "Disabled by Mozilla",
    deleted: "Deleted"
  })
});
const STORE_KEYS = [
  "itemId",
  "listingUrl",
  "publishedAt",
  "publiclyAvailable",
  "reviewEvidenceUrls",
  "reviewedAt",
  "status",
  "submissionId",
  "submittedAt",
  "version"
];

function expectedReleaseAssetNames(version) {
  return [
    `comb-${version}-store-review-kit.zip`,
    `comb-${version}-store-review-kit.zip.sha256`,
    `comb-${version}.zip`,
    `comb-${version}.zip.sha256`
  ];
}

function compareSemver(left, right) {
  const leftParts = String(left || "").match(/^(\d+)\.(\d+)\.(\d+)$/)?.slice(1).map(Number);
  const rightParts = String(right || "").match(/^(\d+)\.(\d+)\.(\d+)$/)?.slice(1).map(Number);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

function validatePublicationRecord(record, options = {}) {
  const errors = [];
  const fail = (message) => errors.push(message);
  const expectedDevelopmentVersion = options.developmentVersion;
  const repository = options.repository || REPOSITORY;

  function exactKeys(value, expected, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail(`${label} must be an object`);
      return false;
    }
    const actual = Object.keys(value).sort();
    const wanted = [...expected].sort();
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
      fail(`${label} keys must be exactly: ${wanted.join(", ")}`);
      return false;
    }
    return true;
  }

  function timestamp(value, label, required = false) {
    if (value == null) {
      if (required) fail(`${label} is required`);
      return false;
    }
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
        !Number.isFinite(new Date(value).getTime())) {
      fail(`${label} must be an ISO-8601 UTC timestamp`);
      return false;
    }
    return true;
  }

  function sha256(value, label) {
    if (!/^[0-9a-f]{64}$/.test(String(value || ""))) {
      fail(`${label} must be a lowercase SHA-256 value`);
    }
  }

  exactKeys(
    record,
    ["claimBoundary", "development", "githubRelease", "product", "schema", "stores"],
    "publication record"
  );
  if (record?.schema !== SCHEMA) fail(`publication schema must be ${SCHEMA}`);

  const development = record?.development || {};
  exactKeys(
    development,
    ["browserStoreSubmissionAllowed", "releaseTag", "status", "version"],
    "development"
  );
  if (!/^\d+\.\d+\.\d+$/.test(String(development.version || ""))) {
    fail("development version must use X.Y.Z");
  }
  if (expectedDevelopmentVersion && development.version !== expectedDevelopmentVersion) {
    fail(`development version must equal ${expectedDevelopmentVersion}`);
  }
  if (!Object.hasOwn(DEVELOPMENT_LABELS, development.status)) {
    fail("development status must be unreleased or released");
  }
  if (typeof development.browserStoreSubmissionAllowed !== "boolean") {
    fail("development browserStoreSubmissionAllowed must be boolean");
  }
  if (development.status === "unreleased") {
    if (development.releaseTag !== null) fail("unreleased development releaseTag must be null");
    if (development.browserStoreSubmissionAllowed !== false) {
      fail("unreleased development must not allow browser-store submission");
    }
  }

  const product = record?.product || {};
  exactKeys(product, [
    "branch",
    "candidateCommit",
    "checksums",
    "verificationConclusion",
    "verificationRunUrl",
    "verifiedAt",
    "version"
  ], "product");
  if (!/^\d+\.\d+\.\d+$/.test(String(product.version || ""))) fail("product version must use X.Y.Z");
  if (!/^[0-9a-f]{40}$/.test(String(product.candidateCommit || ""))) {
    fail("candidate commit must be a full lowercase 40-character SHA-1");
  }
  if (product.branch !== "main") fail("verified release candidate branch must be main");
  if (product.verificationConclusion !== "success") fail("candidate verification conclusion must be success");
  const escapedRepository = repository.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`^https://github\\.com/${escapedRepository}/actions/runs/[1-9][0-9]*$`).test(String(product.verificationRunUrl || ""))) {
    fail("verification run must be an exact Actions run URL for the public repository");
  }
  timestamp(product.verifiedAt, "verification timestamp", true);
  exactKeys(product.checksums || {}, ["runtimeArchive", "storeReviewKitArchive"], "product checksums");
  sha256(product.checksums?.runtimeArchive, "runtime archive checksum");
  sha256(product.checksums?.storeReviewKitArchive, "store review-kit checksum");

  const release = record?.githubRelease || {};
  exactKeys(release, [
    "assets",
    "publishedAt",
    "releaseUrl",
    "status",
    "tag",
    "targetCommit",
    "workflowRunUrl"
  ], "GitHub release");
  if (!["not_released", "released"].includes(release.status)) {
    fail("GitHub release status must be not_released or released");
  } else if (release.status === "not_released") {
    for (const field of ["tag", "targetCommit", "releaseUrl", "workflowRunUrl", "publishedAt"]) {
      if (release[field] !== null) fail(`unreleased GitHub field must be null: ${field}`);
    }
    if (!Array.isArray(release.assets) || release.assets.length !== 0) {
      fail("unreleased GitHub record must not claim release assets");
    }
  } else {
    if (release.tag !== `v${product.version}`) fail("release tag must match the product version");
    if (release.targetCommit !== product.candidateCommit) fail("release must target the verified candidate commit");
    const expectedReleaseUrl = `https://github.com/${repository}/releases/tag/v${product.version}`;
    if (release.releaseUrl !== expectedReleaseUrl) fail("release URL must match the immutable version tag");
    if (!new RegExp(`^https://github\\.com/${escapedRepository}/actions/runs/[1-9][0-9]*$`).test(String(release.workflowRunUrl || ""))) {
      fail("release workflow run must be an exact Actions run URL for the public repository");
    }
    timestamp(release.publishedAt, "GitHub release timestamp", true);
    if (!Array.isArray(release.assets) || release.assets.length !== 4) {
      fail("released GitHub record must contain four exact assets");
    } else {
      const names = release.assets.map((asset) => asset?.name).sort();
      if (JSON.stringify(names) !== JSON.stringify(expectedReleaseAssetNames(product.version))) {
        fail("GitHub release assets do not match the two archives and two sidecars");
      }
      for (const asset of release.assets) {
        exactKeys(asset, ["downloadUrl", "name", "sha256"], `release asset ${asset?.name || "unknown"}`);
        sha256(asset?.sha256, `release asset checksum ${asset?.name || "unknown"}`);
        const expectedDownload = `https://github.com/${repository}/releases/download/v${product.version}/${asset?.name}`;
        if (asset?.downloadUrl !== expectedDownload) fail(`release asset URL changed: ${asset?.name || "unknown"}`);
      }
    }
  }

  const developmentOrder = compareSemver(development.version, product.version);
  if (development.status === "unreleased" && release.status === "released" &&
      developmentOrder !== null && developmentOrder <= 0) {
    fail("unreleased development version must be newer than the latest released product");
  }
  if (development.status === "unreleased" && release.status === "not_released" &&
      developmentOrder !== null && developmentOrder < 0) {
    fail("unreleased development version must not be older than the verified product candidate");
  }
  if (development.status === "released") {
    if (development.version !== product.version) {
      fail("released development version must match the verified product version");
    }
    if (release.status !== "released" || development.releaseTag !== release.tag) {
      fail("released development tag must match the verified GitHub release");
    }
    if (development.browserStoreSubmissionAllowed !== true) {
      fail("released development must explicitly allow browser-store submission");
    }
  }

  exactKeys(record?.stores || {}, ["chrome", "edge", "firefox"], "stores");

  function validateStore(store, browser) {
    const label = browser === "chrome" ? "Chrome" : browser === "edge" ? "Edge" : "Firefox";
    const states = browser === "chrome"
      ? CHROME_STATES
      : browser === "edge"
        ? EDGE_STATES
        : FIREFOX_STATES;
    exactKeys(store, STORE_KEYS, `${label} publication record`);
    if (!states.has(store?.status)) fail(`${label} publication status is not allowlisted`);
    if (typeof store?.publiclyAvailable !== "boolean") fail(`${label} publiclyAvailable must be boolean`);
    if (!Array.isArray(store?.reviewEvidenceUrls)) {
      fail(`${label} reviewEvidenceUrls must be an array`);
    } else {
      for (const url of store.reviewEvidenceUrls) {
        if (!new RegExp(`^https://github\\.com/${escapedRepository}/(?:issues|pull|commit)/`).test(String(url))) {
          fail(`${label} review evidence must be a public repository issue, pull request, or commit URL`);
        }
      }
    }
    const publicStates = browser === "chrome"
      ? new Set(["published"])
      : browser === "edge"
        ? new Set(["in_store", "in_store_update_in_review"])
        : new Set(["public"]);
    const expectedAvailability = publicStates.has(store?.status);
    if (store?.publiclyAvailable !== expectedAvailability) {
      fail(`${label} availability claim does not match its official publication status`);
    }
    for (const field of ["itemId", "submissionId"]) {
      const identifierPattern = browser === "firefox"
        ? /^[A-Za-z0-9@{}._-]{3,128}$/
        : /^[A-Za-z0-9._-]{3,128}$/;
      if (store?.[field] !== null && !identifierPattern.test(String(store[field]))) {
        fail(`${label} ${field} must be null or a bounded dashboard identifier`);
      }
    }
    for (const field of ["submittedAt", "reviewedAt", "publishedAt"]) {
      timestamp(store?.[field], `${label} ${field}`);
    }
    if (store?.listingUrl !== null) {
      const pattern = browser === "chrome"
        ? /^https:\/\/(?:chromewebstore\.google\.com|chrome\.google\.com)\//
        : browser === "edge"
          ? /^https:\/\/microsoftedge\.microsoft\.com\/addons\//
          : /^https:\/\/addons\.mozilla\.org\/[^/]+\/firefox\/addon\//;
      if (!pattern.test(String(store.listingUrl))) fail(`${label} listing URL must use the official store host`);
    }
    if (store?.status === "not_submitted") {
      for (const field of ["version", "itemId", "submissionId", "submittedAt", "reviewedAt", "publishedAt", "listingUrl"]) {
        if (store[field] !== null) fail(`${label} not-submitted field must be null: ${field}`);
      }
      if (store.reviewEvidenceUrls?.length) fail(`${label} not-submitted record must not claim review evidence`);
    } else {
      if (store?.version !== product.version) fail(`${label} submitted version must match the verified product version`);
      if (!store?.itemId) fail(`${label} submitted or draft record requires an item ID`);
      const draftState = browser === "chrome"
        ? "draft"
        : browser === "edge"
          ? "in_draft"
          : "incomplete";
      if (store.status !== draftState) {
        if (!store?.submissionId) fail(`${label} non-draft record requires a submission ID`);
        timestamp(store?.submittedAt, `${label} submission timestamp`, true);
      } else {
        for (const field of ["submissionId", "submittedAt", "reviewedAt", "publishedAt"]) {
          if (store[field] !== null) fail(`${label} draft field must be null: ${field}`);
        }
      }
    }
    const reviewedStates = browser === "chrome"
      ? new Set(["staged", "published", "published_to_testers", "rejected", "taken_down"])
      : browser === "edge"
        ? new Set([
            "waiting_to_publish",
            "in_store",
            "in_store_update_in_review",
            "review_failed",
            "unavailable_in_store",
            "unpublished_from_store",
            "removed_from_store",
            "blocked"
          ])
        : new Set(["public", "rejected", "disabled"]);
    if (reviewedStates.has(store?.status)) timestamp(store?.reviewedAt, `${label} review timestamp`, true);
    const publishedHistoryStates = browser === "chrome"
      ? new Set(["published", "published_to_testers", "taken_down"])
      : browser === "edge"
        ? new Set([
            "in_store",
            "in_store_update_in_review",
            "unavailable_in_store",
            "unpublished_from_store",
            "removed_from_store",
            "blocked"
          ])
        : new Set(["public"]);
    if (publishedHistoryStates.has(store?.status)) {
      timestamp(store?.publishedAt, `${label} publication timestamp`, true);
    }
    if (expectedAvailability) {
      if (!store?.listingUrl) fail(`${label} public status requires an official listing URL`);
    }
  }

  validateStore(record?.stores?.chrome || {}, "chrome");
  validateStore(record?.stores?.edge || {}, "edge");
  validateStore(record?.stores?.firefox || {}, "firefox");

  const boundary = record?.claimBoundary || {};
  exactKeys(boundary, [
    "creatorAttributionEvidence",
    "githubReleaseIsStoreAvailability",
    "liveCheckoutEvidenceAllowed",
    "outcomeReporting",
    "storeAvailabilityRequiresPublishedStatus"
  ], "claim boundary");
  if (boundary.githubReleaseIsStoreAvailability !== false) fail("a GitHub release must never imply store availability");
  if (boundary.storeAvailabilityRequiresPublishedStatus !== true) fail("store availability must require a published state");
  if (boundary.liveCheckoutEvidenceAllowed !== false) fail("publication evidence must prohibit live checkout captures");
  if (boundary.creatorAttributionEvidence !== "synthetic-url-and-cookie-preservation") {
    fail("creator attribution must remain backed by the synthetic URL/cookie contract");
  }
  if (boundary.outcomeReporting !== "absent") fail("outcome reporting must remain absent");

  return errors;
}

function validatePublicationDocument(record, source) {
  const errors = [];
  const required = [
    `Current development version: \`${record.development.version}\``,
    `Development status: **${DEVELOPMENT_LABELS[record.development.status]}**`,
    `Development release tag: **${record.development.releaseTag || "None"}**`,
    `Browser-store submission allowed: **${record.development.browserStoreSubmissionAllowed ? "Yes" : "No"}**`,
    record.product.candidateCommit,
    `Branch: \`${record.product.branch}\``,
    `Verification conclusion: **${record.product.verificationConclusion === "success" ? "Success" : record.product.verificationConclusion}**`,
    record.product.verificationRunUrl,
    record.product.checksums.runtimeArchive,
    record.product.checksums.storeReviewKitArchive,
    "The creator-tagging issue is fixed",
    `GitHub release: **${PUBLICATION_LABELS.github[record.githubRelease.status]}**`,
    `Chrome Web Store: **${PUBLICATION_LABELS.chrome[record.stores.chrome.status]}**`,
    `Microsoft Edge Add-ons: **${PUBLICATION_LABELS.edge[record.stores.edge.status]}**`,
    `Firefox Add-ons (AMO): **${PUBLICATION_LABELS.firefox[record.stores.firefox.status]}**`
  ];
  if (record.githubRelease.status === "released") {
    required.push(record.githubRelease.tag, record.githubRelease.releaseUrl, record.githubRelease.workflowRunUrl);
    for (const asset of record.githubRelease.assets) required.push(asset.name, asset.sha256, asset.downloadUrl);
  }
  const publicStores = [record.stores.chrome, record.stores.edge, record.stores.firefox]
    .filter((store) => store.publiclyAvailable);
  if (publicStores.length === 0) required.push("Comb is not publicly available from any browser store yet.");
  else for (const store of publicStores) required.push(store.listingUrl);
  for (const [label, store] of [
    ["Chrome", record.stores.chrome],
    ["Microsoft Edge", record.stores.edge],
    ["Firefox", record.stores.firefox]
  ]) {
    if (store.status !== "not_submitted") required.push(`${label} submitted version: \`${store.version}\``);
  }
  for (const phrase of required) {
    if (!source.includes(phrase)) errors.push(`publication status document is missing: ${phrase}`);
  }
  return errors;
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const record = JSON.parse(fs.readFileSync(path.join(root, "store/publication-record.json"), "utf8"));
  const statusDocument = fs.readFileSync(path.join(root, "docs/PUBLICATION_STATUS.md"), "utf8");
  const errors = [
    ...validatePublicationRecord(record, { developmentVersion: manifest.version }),
    ...validatePublicationDocument(record, statusDocument)
  ];
  if (errors.length) {
    process.stderr.write(`Comb publication record failed:\n- ${errors.join("\n- ")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `Comb publication record passed: development v${record.development.version} ` +
      `${DEVELOPMENT_LABELS[record.development.status]}; latest verified v${record.product.version}; ` +
      `GitHub ${PUBLICATION_LABELS.github[record.githubRelease.status]}; ` +
      `Chrome ${PUBLICATION_LABELS.chrome[record.stores.chrome.status]}; ` +
      `Edge ${PUBLICATION_LABELS.edge[record.stores.edge.status]}; ` +
      `Firefox ${PUBLICATION_LABELS.firefox[record.stores.firefox.status]}.\n`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Comb publication record failed: ${error.message || error}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  CHROME_STATES,
  DEVELOPMENT_LABELS,
  EDGE_STATES,
  FIREFOX_STATES,
  PUBLICATION_LABELS,
  SCHEMA,
  expectedReleaseAssetNames,
  validatePublicationDocument,
  validatePublicationRecord
};
