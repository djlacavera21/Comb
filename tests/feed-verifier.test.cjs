"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const feed = require("../src/shared/feed-verifier.js");

const NOW = Date.parse("2026-08-14T20:00:00.000Z");

async function keyFixture() {
  const pair = await globalThis.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicKeyJwk = await globalThis.crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateKeyJwk = await globalThis.crypto.subtle.exportKey("jwk", pair.privateKey);
  const trustKey = await feed.createTrustKeyDescriptor(
    "Comb Test Feed",
    publicKeyJwk,
    "2026-08-14T19:00:00.000Z"
  );
  return { trustKey, privateKeyJwk };
}

function payload(keyId, overrides = {}) {
  return {
    schema: feed.FEED_SCHEMA,
    feedId: "comb.test",
    name: "Comb Test Community",
    sequence: 7,
    issuedAt: "2026-08-14T19:30:00.000Z",
    expiresAt: "2026-08-28T19:30:00.000Z",
    keyId,
    entries: [
      {
        merchant: "shop.example",
        code: "SAVE20",
        lastVerifiedAt: "2026-08-14T19:00:00.000Z",
        successCount: 42,
        failureCount: 3
      }
    ],
    ...overrides
  };
}

test("canonicalize is stable across object key order", () => {
  assert.equal(
    feed.canonicalize({ z: 1, a: { y: true, x: [3, 2, 1] } }),
    feed.canonicalize({ a: { x: [3, 2, 1], y: true }, z: 1 })
  );
});

test("trust-key fingerprint is derived from public key material", async () => {
  const { trustKey } = await keyFixture();
  assert.match(trustKey.keyId, /^sha256-[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(await feed.validateTrustKey(trustKey), trustKey);
});

test("signed feed verifies and returns normalized metadata", async () => {
  const { trustKey, privateKeyJwk } = await keyFixture();
  const envelope = await feed.signPayload(payload(trustKey.keyId), privateKeyJwk, trustKey.keyId, { now: NOW });
  const verified = await feed.verifyEnvelope(envelope, trustKey, { now: NOW });

  assert.equal(verified.payload.feedId, "comb.test");
  assert.equal(verified.payload.sequence, 7);
  assert.equal(verified.payload.entries[0].code, "SAVE20");
  assert.match(verified.payloadHash, /^sha256-[A-Za-z0-9_-]{43}$/);
});

test("tampering with a signed coupon code fails verification", async () => {
  const { trustKey, privateKeyJwk } = await keyFixture();
  const envelope = await feed.signPayload(payload(trustKey.keyId), privateKeyJwk, trustKey.keyId, { now: NOW });
  envelope.payload.entries[0].code = "ATTACKER99";

  await assert.rejects(
    feed.verifyEnvelope(envelope, trustKey, { now: NOW }),
    (error) => error instanceof feed.FeedError && error.code === "signature_mismatch"
  );
});

test("feed schema rejects affiliate and referral metadata", async () => {
  const { trustKey, privateKeyJwk } = await keyFixture();
  const unsafePayload = payload(trustKey.keyId, { affiliateTag: "comb-last-click" });

  await assert.rejects(
    feed.signPayload(unsafePayload, privateKeyJwk, trustKey.keyId, { now: NOW }),
    (error) => error instanceof feed.FeedError && error.code === "unexpected_field"
  );
});

test("feed identifiers and coupon tokens must already be normalized", async () => {
  const { trustKey } = await keyFixture();
  assert.throws(
    () => feed.validateFeedPayload(payload(trustKey.keyId, { feedId: "Comb.Test" }), { now: NOW }),
    (error) => error instanceof feed.FeedError && error.code === "invalid_feed_id"
  );
  assert.throws(
    () => feed.validateFeedPayload(payload(trustKey.keyId, {
      entries: [{
        merchant: "shop.example",
        code: " SAVE20 ",
        lastVerifiedAt: "2026-08-14T19:00:00.000Z",
        successCount: 1,
        failureCount: 0
      }]
    }), { now: NOW }),
    (error) => error instanceof feed.FeedError && error.code === "invalid_code"
  );
});

test("expired feeds fail even when their signature is valid", async () => {
  const { trustKey, privateKeyJwk } = await keyFixture();
  const expiredAtSigning = payload(trustKey.keyId, {
    issuedAt: "2026-07-01T00:00:00.000Z",
    expiresAt: "2026-07-20T00:00:00.000Z",
    entries: [
      {
        merchant: "shop.example",
        code: "OLD10",
        lastVerifiedAt: "2026-07-01T00:00:00.000Z",
        successCount: 10,
        failureCount: 1
      }
    ]
  });
  const signingNow = Date.parse("2026-07-02T00:00:00.000Z");
  const envelope = await feed.signPayload(expiredAtSigning, privateKeyJwk, trustKey.keyId, { now: signingNow });

  await assert.rejects(
    feed.verifyEnvelope(envelope, trustKey, { now: NOW }),
    (error) => error instanceof feed.FeedError && error.code === "expired_feed"
  );
});

test("duplicate merchant/code pairs are rejected case-insensitively", async () => {
  const { trustKey } = await keyFixture();
  const duplicate = payload(trustKey.keyId, {
    entries: [
      {
        merchant: "shop.example",
        code: "SAVE20",
        lastVerifiedAt: "2026-08-14T19:00:00.000Z",
        successCount: 5,
        failureCount: 1
      },
      {
        merchant: "shop.example",
        code: "save20",
        lastVerifiedAt: "2026-08-14T19:00:00.000Z",
        successCount: 4,
        failureCount: 2
      }
    ]
  });

  assert.throws(
    () => feed.validateFeedPayload(duplicate, { now: NOW }),
    (error) => error instanceof feed.FeedError && error.code === "duplicate_entry"
  );
});

test("observations cannot postdate the feed they support", async () => {
  const { trustKey } = await keyFixture();
  const futureObservation = payload(trustKey.keyId, {
    entries: [
      {
        merchant: "shop.example",
        code: "TIME10",
        lastVerifiedAt: "2026-08-14T19:40:01.000Z",
        successCount: 1,
        failureCount: 0
      }
    ]
  });

  assert.throws(
    () => feed.validateFeedPayload(futureObservation, { now: NOW }),
    (error) => error instanceof feed.FeedError && error.code === "future_observation"
  );
});

test("merchant selection ranks fresh successful codes and deduplicates feeds", () => {
  const records = [
    {
      payload: {
        feedId: "community.one",
        name: "Community One",
        expiresAt: "2026-08-28T00:00:00.000Z",
        entries: [
          {
            merchant: "shop.example",
            code: "FRESH20",
            lastVerifiedAt: "2026-08-14T19:00:00.000Z",
            successCount: 80,
            failureCount: 2
          },
          {
            merchant: "shop.example",
            code: "WEAK5",
            lastVerifiedAt: "2026-07-01T00:00:00.000Z",
            successCount: 3,
            failureCount: 10
          }
        ]
      }
    },
    {
      payload: {
        feedId: "community.two",
        name: "Community Two",
        expiresAt: "2026-08-28T00:00:00.000Z",
        entries: [
          {
            merchant: "shop.example",
            code: "fresh20",
            lastVerifiedAt: "2026-08-10T00:00:00.000Z",
            successCount: 10,
            failureCount: 8
          }
        ]
      }
    }
  ];

  const selected = feed.selectCodesForMerchant(records, "www.shop.example", { now: NOW });
  assert.deepEqual(selected.map((entry) => entry.code), ["FRESH20", "WEAK5"]);
  assert.equal(selected[0].feedId, "community.one");
  assert.ok(selected[0].score > selected[1].score);
});

test("catalog search filters active verified coupons and keeps publisher provenance", () => {
  const keyId = `sha256-${"A".repeat(43)}`;
  const records = [
    {
      payload: {
        feedId: "community.one",
        name: "Community One",
        keyId,
        sequence: 4,
        expiresAt: "2026-08-28T00:00:00.000Z",
        entries: [
          {
            merchant: "shop.example",
            code: "FRESH20",
            lastVerifiedAt: "2026-08-14T19:00:00.000Z",
            successCount: 80,
            failureCount: 2
          },
          {
            merchant: "market.example",
            code: "MARKET10",
            lastVerifiedAt: "2026-08-13T19:00:00.000Z",
            successCount: 10,
            failureCount: 3
          }
        ]
      }
    },
    {
      payload: {
        feedId: "archive.old",
        name: "Archive Publisher",
        keyId,
        sequence: 2,
        expiresAt: "2026-08-01T00:00:00.000Z",
        entries: [{
          merchant: "shop.example",
          code: "OLD5",
          lastVerifiedAt: "2026-07-15T19:00:00.000Z",
          successCount: 3,
          failureCount: 1
        }]
      }
    }
  ];

  const active = feed.searchCatalog(records, { now: NOW, query: "shop fresh" });
  assert.equal(active.total, 1);
  assert.equal(active.items[0].code, "FRESH20");
  assert.equal(active.items[0].feedName, "Community One");
  assert.equal(active.items[0].keyId, keyId);
  assert.equal(active.items[0].expired, false);
  assert.deepEqual(active.stats, {
    feedCount: 2,
    uniqueCouponCount: 3,
    activeCouponCount: 2,
    expiredCouponCount: 1
  });

  const expired = feed.searchCatalog(records, { now: NOW, status: "expired", query: "archive" });
  assert.equal(expired.total, 1);
  assert.equal(expired.items[0].code, "OLD5");
  assert.equal(expired.items[0].expired, true);
});

test("catalog search deduplicates merchant codes, paginates, and prefers the strongest source", () => {
  const keyId = `sha256-${"B".repeat(43)}`;
  const records = [
    {
      payload: {
        feedId: "community.strong",
        name: "Strong Publisher",
        keyId,
        sequence: 9,
        expiresAt: "2026-08-28T00:00:00.000Z",
        entries: [
          {
            merchant: "shop.example",
            code: "SAVE20",
            lastVerifiedAt: "2026-08-14T19:00:00.000Z",
            successCount: 90,
            failureCount: 1
          },
          {
            merchant: "alpha.example",
            code: "ALPHA5",
            lastVerifiedAt: "2026-08-12T19:00:00.000Z",
            successCount: 8,
            failureCount: 2
          }
        ]
      }
    },
    {
      payload: {
        feedId: "community.weak",
        name: "Weak Publisher",
        keyId,
        sequence: 3,
        expiresAt: "2026-08-28T00:00:00.000Z",
        entries: [{
          merchant: "shop.example",
          code: "save20",
          lastVerifiedAt: "2026-07-01T00:00:00.000Z",
          successCount: 2,
          failureCount: 8
        }]
      }
    }
  ];

  const first = feed.searchCatalog(records, { now: NOW, status: "all", sort: "merchant", limit: 1 });
  assert.equal(first.total, 2);
  assert.equal(first.hasMore, true);
  assert.equal(first.items[0].merchant, "alpha.example");

  const second = feed.searchCatalog(records, {
    now: NOW,
    status: "all",
    sort: "merchant",
    offset: 1,
    limit: 1
  });
  assert.equal(second.items[0].code, "SAVE20");
  assert.equal(second.items[0].feedId, "community.strong");
  assert.equal(second.items[0].sourceCount, 2);

  const publisherMatch = feed.searchCatalog(records, {
    now: NOW,
    query: "Weak Publisher",
    status: "active"
  });
  assert.equal(publisherMatch.total, 1);
  assert.equal(publisherMatch.items[0].feedId, "community.weak");
  assert.equal(publisherMatch.items[0].sourceCount, 2);
});

test("catalog search bounds and normalizes caller-controlled options", () => {
  const result = feed.searchCatalog([], {
    now: NOW,
    query: `  ${"X".repeat(150)}  `,
    status: "unknown",
    sort: "unknown",
    offset: -50,
    limit: 1_000
  });

  assert.equal(result.query, "x".repeat(120));
  assert.equal(result.status, "active");
  assert.equal(result.sort, "recommended");
  assert.equal(result.offset, 0);
  assert.equal(result.limit, 100);
  assert.equal(result.total, 0);
});

test("feed updates reject rollback and same-sequence substitution", () => {
  const existing = {
    payload: { sequence: 9 },
    payloadHash: "sha256-existing"
  };

  assert.equal(
    feed.classifyFeedUpdate(existing, { payload: { sequence: 10 }, payloadHash: "sha256-new" }),
    "update"
  );
  assert.equal(
    feed.classifyFeedUpdate(existing, { payload: { sequence: 9 }, payloadHash: "sha256-existing" }),
    "identical"
  );
  assert.throws(
    () => feed.classifyFeedUpdate(existing, { payload: { sequence: 8 }, payloadHash: "sha256-old" }),
    (error) => error.code === "rollback_detected"
  );
  assert.throws(
    () => feed.classifyFeedUpdate(existing, { payload: { sequence: 9 }, payloadHash: "sha256-substitute" }),
    (error) => error.code === "sequence_conflict"
  );
});
