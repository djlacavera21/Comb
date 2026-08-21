"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  expectedReleaseAssetNames,
  validatePublicationDocument,
  validatePublicationRecord
} = require("../scripts/validate-publication-record.js");

const root = path.resolve(__dirname, "..");
const record = JSON.parse(fs.readFileSync(path.join(root, "store/publication-record.json"), "utf8"));

test("publication record separates the unreleased build from the verified release", () => {
  assert.deepEqual(validatePublicationRecord(record, { developmentVersion: "0.8.0" }), []);
  const document = fs.readFileSync(path.join(root, "docs/PUBLICATION_STATUS.md"), "utf8");
  assert.deepEqual(validatePublicationDocument(record, document), []);
});

test("publication record rejects development version drift", () => {
  const errors = validatePublicationRecord(record, { developmentVersion: "0.8.1" });
  assert.ok(errors.some((error) => error.includes("development version must equal 0.8.1")));
});

test("publication record blocks old or submittable unreleased builds", () => {
  const unsafe = structuredClone(record);
  unsafe.development.version = "0.7.0";
  unsafe.development.browserStoreSubmissionAllowed = true;
  const errors = validatePublicationRecord(unsafe, { developmentVersion: "0.7.0" });
  assert.ok(errors.some((error) => error.includes("must not allow browser-store submission")));
  assert.ok(errors.some((error) => error.includes("must be newer than the latest released product")));
});

test("publication record permits submission only when the current build matches a release", () => {
  const releasedCurrentBuild = structuredClone(record);
  releasedCurrentBuild.development = {
    version: "0.7.0",
    status: "released",
    releaseTag: "v0.7.0",
    browserStoreSubmissionAllowed: true
  };
  assert.deepEqual(
    validatePublicationRecord(releasedCurrentBuild, { developmentVersion: "0.7.0" }),
    []
  );

  releasedCurrentBuild.development.releaseTag = "v0.8.0";
  const errors = validatePublicationRecord(releasedCurrentBuild, { developmentVersion: "0.7.0" });
  assert.ok(errors.some((error) => error.includes("tag must match the verified GitHub release")));
});

test("publication record rejects an availability claim before official publication", () => {
  const claimed = structuredClone(record);
  claimed.stores.chrome.publiclyAvailable = true;
  claimed.stores.chrome.listingUrl = "https://chromewebstore.google.com/detail/comb/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const errors = validatePublicationRecord(claimed, { developmentVersion: "0.8.0" });
  assert.ok(errors.some((error) => error.includes("availability claim")));
  assert.ok(errors.some((error) => error.includes("not-submitted field must be null")));
});

test("publication record maps Firefox availability only to the official AMO public state", () => {
  const awaitingReview = structuredClone(record);
  awaitingReview.stores.firefox = {
    status: "nominated",
    version: "0.7.0",
    itemId: "@comb-djlacavera21",
    submissionId: "amo-version-7001",
    submittedAt: "2026-08-15T01:00:00Z",
    reviewedAt: null,
    publishedAt: null,
    listingUrl: null,
    publiclyAvailable: false,
    reviewEvidenceUrls: []
  };
  assert.deepEqual(validatePublicationRecord(awaitingReview, { developmentVersion: "0.8.0" }), []);

  awaitingReview.stores.firefox.publiclyAvailable = true;
  assert.ok(
    validatePublicationRecord(awaitingReview, { developmentVersion: "0.8.0" })
      .some((error) => error.includes("Firefox availability claim"))
  );

  const published = structuredClone(record);
  published.stores.firefox = {
    status: "public",
    version: "0.7.0",
    itemId: "@comb-djlacavera21",
    submissionId: "amo-version-7001",
    submittedAt: "2026-08-15T01:00:00Z",
    reviewedAt: "2026-08-16T01:00:00Z",
    publishedAt: "2026-08-16T01:00:00Z",
    listingUrl: "https://addons.mozilla.org/en-US/firefox/addon/comb-private-coupon-tester/",
    publiclyAvailable: true,
    reviewEvidenceUrls: []
  };
  assert.deepEqual(validatePublicationRecord(published, { developmentVersion: "0.8.0" }), []);
});

test("publication record rejects a non-AMO Firefox listing URL", () => {
  const published = structuredClone(record);
  published.stores.firefox = {
    status: "public",
    version: "0.7.0",
    itemId: "@comb-djlacavera21",
    submissionId: "amo-version-7001",
    submittedAt: "2026-08-15T01:00:00Z",
    reviewedAt: "2026-08-16T01:00:00Z",
    publishedAt: "2026-08-16T01:00:00Z",
    listingUrl: "https://example.com/firefox/comb",
    publiclyAvailable: true,
    reviewEvidenceUrls: []
  };
  assert.ok(
    validatePublicationRecord(published, { developmentVersion: "0.8.0" })
      .some((error) => error.includes("Firefox listing URL must use the official store host"))
  );
});

test("publication record requires four exact immutable GitHub release assets", () => {
  const released = structuredClone(record);
  released.githubRelease = {
    status: "released",
    tag: "v0.7.0",
    targetCommit: record.product.candidateCommit,
    releaseUrl: "https://github.com/djlacavera21/Comb/releases/tag/v0.7.0",
    workflowRunUrl: "https://github.com/djlacavera21/Comb/actions/runs/40000000000",
    publishedAt: "2026-08-15T00:00:00Z",
    assets: expectedReleaseAssetNames("0.7.0").map((name) => ({
      name,
      sha256: "a".repeat(64),
      downloadUrl: `https://github.com/djlacavera21/Comb/releases/download/v0.7.0/${name}`
    }))
  };
  assert.deepEqual(validatePublicationRecord(released, { developmentVersion: "0.8.0" }), []);

  released.githubRelease.assets.pop();
  const errors = validatePublicationRecord(released, { developmentVersion: "0.8.0" });
  assert.ok(errors.some((error) => error.includes("four exact assets")));
});

test("publication record requires an official listing host for a public store state", () => {
  const published = structuredClone(record);
  published.stores.edge = {
    status: "in_store",
    version: "0.7.0",
    itemId: "edge-item-1",
    submissionId: "edge-submission-1",
    submittedAt: "2026-08-15T00:00:00Z",
    reviewedAt: "2026-08-16T00:00:00Z",
    publishedAt: "2026-08-16T01:00:00Z",
    listingUrl: "https://example.com/comb",
    publiclyAvailable: true,
    reviewEvidenceUrls: []
  };
  const errors = validatePublicationRecord(published, { developmentVersion: "0.8.0" });
  assert.ok(errors.some((error) => error.includes("official store host")));
});

test("publication document validation follows later release and store states", () => {
  const transitioned = structuredClone(record);
  transitioned.githubRelease = {
    status: "released",
    tag: "v0.7.0",
    targetCommit: record.product.candidateCommit,
    releaseUrl: "https://github.com/djlacavera21/Comb/releases/tag/v0.7.0",
    workflowRunUrl: "https://github.com/djlacavera21/Comb/actions/runs/40000000000",
    publishedAt: "2026-08-15T00:00:00Z",
    assets: expectedReleaseAssetNames("0.7.0").map((name, index) => ({
      name,
      sha256: String(index + 1).repeat(64),
      downloadUrl: `https://github.com/djlacavera21/Comb/releases/download/v0.7.0/${name}`
    }))
  };
  transitioned.stores.chrome = {
    status: "published",
    version: "0.7.0",
    itemId: "abcdefghijklmnopabcdefghijklmnop",
    submissionId: "chrome-submission-1",
    submittedAt: "2026-08-15T01:00:00Z",
    reviewedAt: "2026-08-16T01:00:00Z",
    publishedAt: "2026-08-16T02:00:00Z",
    listingUrl: "https://chromewebstore.google.com/detail/comb/abcdefghijklmnopabcdefghijklmnop",
    publiclyAvailable: true,
    reviewEvidenceUrls: []
  };
  assert.deepEqual(validatePublicationRecord(transitioned, { developmentVersion: "0.8.0" }), []);
  const transitionedDocument = [
    "Current development version: `0.8.0`",
    "Development status: **Unreleased**",
    "Development release tag: **None**",
    "Browser-store submission allowed: **No**",
    transitioned.product.candidateCommit,
    "Branch: `main`",
    "Verification conclusion: **Success**",
    transitioned.product.verificationRunUrl,
    transitioned.product.checksums.runtimeArchive,
    transitioned.product.checksums.storeReviewKitArchive,
    "The creator-tagging issue is fixed",
    "GitHub release: **Released**",
    "Chrome Web Store: **Published**",
    "Chrome submitted version: `0.7.0`",
    "Microsoft Edge Add-ons: **Not submitted**",
    "Firefox Add-ons (AMO): **Not submitted**",
    transitioned.githubRelease.tag,
    transitioned.githubRelease.releaseUrl,
    transitioned.githubRelease.workflowRunUrl,
    transitioned.stores.chrome.listingUrl,
    ...transitioned.githubRelease.assets.flatMap((asset) => [asset.name, asset.sha256, asset.downloadUrl])
  ].join("\n");
  assert.deepEqual(validatePublicationDocument(transitioned, transitionedDocument), []);
});
