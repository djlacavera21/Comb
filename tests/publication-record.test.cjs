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

test("publication record accepts the verified released and unsubmitted build", () => {
  assert.deepEqual(validatePublicationRecord(record, { version: "0.7.0" }), []);
  const document = fs.readFileSync(path.join(root, "docs/PUBLICATION_STATUS.md"), "utf8");
  assert.deepEqual(validatePublicationDocument(record, document), []);
});

test("publication record rejects an availability claim before official publication", () => {
  const claimed = structuredClone(record);
  claimed.stores.chrome.publiclyAvailable = true;
  claimed.stores.chrome.listingUrl = "https://chromewebstore.google.com/detail/comb/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const errors = validatePublicationRecord(claimed, { version: "0.7.0" });
  assert.ok(errors.some((error) => error.includes("availability claim")));
  assert.ok(errors.some((error) => error.includes("not-submitted field must be null")));
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
  assert.deepEqual(validatePublicationRecord(released, { version: "0.7.0" }), []);

  released.githubRelease.assets.pop();
  const errors = validatePublicationRecord(released, { version: "0.7.0" });
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
  const errors = validatePublicationRecord(published, { version: "0.7.0" });
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
  assert.deepEqual(validatePublicationRecord(transitioned, { version: "0.7.0" }), []);
  const transitionedDocument = [
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
    transitioned.githubRelease.tag,
    transitioned.githubRelease.releaseUrl,
    transitioned.githubRelease.workflowRunUrl,
    transitioned.stores.chrome.listingUrl,
    ...transitioned.githubRelease.assets.flatMap((asset) => [asset.name, asset.sha256, asset.downloadUrl])
  ].join("\n");
  assert.deepEqual(validatePublicationDocument(transitioned, transitionedDocument), []);
});
