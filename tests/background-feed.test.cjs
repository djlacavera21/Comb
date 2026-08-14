"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const CombFeed = require("../src/shared/feed-verifier.js");
const root = path.resolve(__dirname, "..");

async function signedFixture(sequence = 1, feedId = "background.test") {
  const pair = await globalThis.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicKeyJwk = await globalThis.crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateKeyJwk = await globalThis.crypto.subtle.exportKey("jwk", pair.privateKey);
  const trustKey = await CombFeed.createTrustKeyDescriptor("Background Test", publicKeyJwk);
  const now = Date.now();
  const payload = {
    schema: CombFeed.FEED_SCHEMA,
    feedId,
    name: "Background Test Feed",
    sequence,
    issuedAt: new Date(now - 60_000).toISOString(),
    expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    keyId: trustKey.keyId,
    entries: [
      {
        merchant: "shop.example",
        code: "SIGNED25",
        lastVerifiedAt: new Date(now - 120_000).toISOString(),
        successCount: 12,
        failureCount: 1
      }
    ]
  };
  const envelope = await CombFeed.signPayload(payload, privateKeyJwk, trustKey.keyId);
  return { trustKey, envelope, privateKeyJwk };
}

function createBackgroundHarness(options = {}) {
  const storage = {};
  const alarms = {};
  const grantedOrigins = new Set(options.grantedOrigins || []);
  const fetchCalls = [];
  let messageListener;
  let installedListener;
  let alarmListener;
  const optionsUrl = "chrome-extension://comb-test/src/options/options.html";
  const context = vm.createContext({
    console,
    crypto: webcrypto,
    TextEncoder,
    TextDecoder,
    URL,
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    setTimeout,
    clearTimeout,
    AbortController,
    fetch: async (...args) => {
      fetchCalls.push(args);
      if (!options.fetchImpl) throw new Error("Unexpected network request in background test.");
      return options.fetchImpl(...args);
    },
    chrome: {
      storage: {
        local: {
          async get(keys) {
            const requested = Array.isArray(keys) ? keys : [keys];
            return Object.fromEntries(requested.filter((key) => key in storage).map((key) => [key, storage[key]]));
          },
          async set(values) {
            Object.assign(storage, values);
          }
        }
      },
      runtime: {
        onInstalled: { addListener(listener) { installedListener = listener; } },
        onMessage: { addListener(listener) { messageListener = listener; } },
        getURL(relativePath) { return `chrome-extension://comb-test/${relativePath}`; },
        async sendMessage() { return undefined; }
      },
      permissions: {
        async contains(request) {
          return (request.origins || []).every((origin) => grantedOrigins.has(origin));
        },
        async remove(request) {
          let removed = false;
          for (const origin of request.origins || []) {
            removed = grantedOrigins.delete(origin) || removed;
          }
          return removed;
        }
      },
      alarms: {
        onAlarm: { addListener(listener) { alarmListener = listener; } },
        async get(name) { return alarms[name]; },
        async create(name, info) { alarms[name] = { name, ...info }; },
        async clear(name) {
          const existed = Boolean(alarms[name]);
          delete alarms[name];
          return existed;
        }
      },
      tabs: {},
      scripting: {}
    }
  });
  context.globalThis = context;
  context.importScripts = (...relativePaths) => {
    for (const relativePath of relativePaths) {
      const source = fs.readFileSync(path.join(root, "src", relativePath), "utf8");
      vm.runInContext(source, context, { filename: relativePath });
    }
  };

  const backgroundSource = fs.readFileSync(path.join(root, "src/background.js"), "utf8");
  vm.runInContext(backgroundSource, context, { filename: "background.js" });

  function intoContext(value) {
    const serialized = JSON.stringify(value);
    return vm.runInContext(`JSON.parse(${JSON.stringify(serialized)})`, context);
  }

  function send(rawMessage, rawSender = { url: optionsUrl }) {
    const message = intoContext(rawMessage);
    const sender = intoContext(rawSender);
    return new Promise((resolve) => {
      const keepAlive = messageListener(message, sender, resolve);
      assert.equal(keepAlive, true);
    });
  }

  return {
    storage,
    alarms,
    grantedOrigins,
    fetchCalls,
    send,
    async install() { await installedListener(); },
    async fireAlarm(name) { return alarmListener({ name }); },
    setFeedState(value) { storage.combFeedState = intoContext(value); }
  };
}

test("background imports a trusted key and signed feed without adding network permissions", async () => {
  const harness = createBackgroundHarness();
  const { trustKey, envelope } = await signedFixture();
  await harness.install();

  const keyResponse = await harness.send({ type: "COMB_IMPORT_TRUST_KEY", trustKey });
  assert.equal(keyResponse.ok, true);
  assert.equal(keyResponse.result.trustedKeys.length, 1);

  const feedResponse = await harness.send({ type: "COMB_IMPORT_SIGNED_FEED", envelope });
  assert.equal(feedResponse.ok, true);
  assert.equal(feedResponse.result.feeds.length, 1);
  assert.equal(feedResponse.result.feeds[0].entryCount, 1);
  assert.equal(feedResponse.result.feeds[0].sequence, 1);

  const stateResponse = await harness.send({ type: "COMB_GET_FEED_STATE" });
  assert.equal(stateResponse.ok, true);
  assert.equal(stateResponse.result.feeds[0].feedId, "background.test");
  assert.ok(harness.storage.combFeedState);
});

test("background refuses a feed whose signing key is not trusted", async () => {
  const harness = createBackgroundHarness();
  const { envelope } = await signedFixture();
  await harness.install();

  const response = await harness.send({ type: "COMB_IMPORT_SIGNED_FEED", envelope });
  assert.equal(response.ok, false);
  assert.match(response.error, /public trust key/i);
});

test("background accepts valid feed IDs that match object prototype names", async () => {
  const harness = createBackgroundHarness();
  const { trustKey, envelope } = await signedFixture(1, "constructor");
  await harness.install();
  await harness.send({ type: "COMB_IMPORT_TRUST_KEY", trustKey });

  const response = await harness.send({ type: "COMB_IMPORT_SIGNED_FEED", envelope });
  assert.equal(response.ok, true);
  assert.equal(response.result.feeds[0].feedId, "constructor");
});

test("background rejects cross-publisher replacement of an installed feed ID", async () => {
  const harness = createBackgroundHarness();
  const first = await signedFixture(1);
  const second = await signedFixture(2);
  await harness.install();

  await harness.send({ type: "COMB_IMPORT_TRUST_KEY", trustKey: first.trustKey });
  await harness.send({ type: "COMB_IMPORT_TRUST_KEY", trustKey: second.trustKey });
  assert.equal((await harness.send({ type: "COMB_IMPORT_SIGNED_FEED", envelope: first.envelope })).ok, true);

  const response = await harness.send({ type: "COMB_IMPORT_SIGNED_FEED", envelope: second.envelope });
  assert.equal(response.ok, false);
  assert.match(response.error, /another trusted publisher/i);
});

test("background quarantines a stored feed whose signed envelope was altered", async () => {
  const harness = createBackgroundHarness();
  const { trustKey, envelope } = await signedFixture();
  await harness.install();
  await harness.send({ type: "COMB_IMPORT_TRUST_KEY", trustKey });
  await harness.send({ type: "COMB_IMPORT_SIGNED_FEED", envelope });

  harness.storage.combFeedState.feeds["background.test"].envelope.payload.entries[0].code = "TAMPERED99";
  const stateResponse = await harness.send({ type: "COMB_GET_FEED_STATE" });

  assert.equal(stateResponse.ok, true);
  assert.equal(stateResponse.result.feeds.length, 0);
});

test("background retrieves a signed feed only from an explicitly approved HTTPS origin", async () => {
  const sourceUrl = "https://feeds.comb.community/releases/community.signed.json";
  const originPattern = "https://feeds.comb.community/*";
  const { trustKey, envelope } = await signedFixture();
  const harness = createBackgroundHarness({
    grantedOrigins: [originPattern],
    fetchImpl: async () => new Response(JSON.stringify(envelope), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  });
  await harness.install();
  await harness.send({ type: "COMB_IMPORT_TRUST_KEY", trustKey });

  const response = await harness.send({ type: "COMB_ADD_FEED_SOURCE", url: sourceUrl });
  assert.equal(response.ok, true);
  assert.equal(response.result.sources.length, 1);
  assert.equal(response.result.sources[0].url, sourceUrl);
  assert.equal(response.result.feeds[0].feedId, "background.test");
  assert.ok(harness.alarms["comb-signed-feed-refresh"]);
  assert.equal(harness.fetchCalls.length, 1);
  assert.equal(harness.fetchCalls[0][0], sourceUrl);
  assert.equal(harness.fetchCalls[0][1].credentials, "omit");
  assert.equal(harness.fetchCalls[0][1].redirect, "error");
  assert.equal(harness.fetchCalls[0][1].referrerPolicy, "no-referrer");
});

test("background refuses network source messages from checkout content", async () => {
  const harness = createBackgroundHarness({
    grantedOrigins: ["https://feeds.comb.community/*"],
    fetchImpl: async () => { throw new Error("must not fetch"); }
  });
  await harness.install();

  const response = await harness.send(
    { type: "COMB_ADD_FEED_SOURCE", url: "https://feeds.comb.community/feed.json" },
    { url: "https://shop.example/checkout", tab: { id: 7 } }
  );
  assert.equal(response.ok, false);
  assert.match(response.error, /only from Comb settings/i);
  assert.equal(harness.fetchCalls.length, 0);
});

test("background refuses an HTTPS source whose origin permission is absent", async () => {
  const { trustKey } = await signedFixture();
  const harness = createBackgroundHarness();
  await harness.install();
  await harness.send({ type: "COMB_IMPORT_TRUST_KEY", trustKey });

  const response = await harness.send({
    type: "COMB_ADD_FEED_SOURCE",
    url: "https://feeds.comb.community/feed.json"
  });
  assert.equal(response.ok, false);
  assert.match(response.error, /no longer approved/i);
  assert.equal(harness.fetchCalls.length, 0);
});

test("background pins an approved source to its original feed ID and signer", async () => {
  const sourceUrl = "https://feeds.comb.community/feed.json";
  const { trustKey, envelope, privateKeyJwk } = await signedFixture();
  let servedEnvelope = envelope;
  const harness = createBackgroundHarness({
    grantedOrigins: ["https://feeds.comb.community/*"],
    fetchImpl: async () => new Response(JSON.stringify(servedEnvelope), { status: 200 })
  });
  await harness.install();
  await harness.send({ type: "COMB_IMPORT_TRUST_KEY", trustKey });
  await harness.send({ type: "COMB_ADD_FEED_SOURCE", url: sourceUrl });

  const changedIdentity = {
    ...envelope.payload,
    feedId: "different.feed",
    sequence: 2,
    issuedAt: new Date(Date.now() - 30_000).toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
  servedEnvelope = await CombFeed.signPayload(changedIdentity, privateKeyJwk, trustKey.keyId);
  const response = await harness.send({ type: "COMB_REFRESH_FEED_SOURCE", feedId: "background.test" });

  assert.equal(response.ok, false);
  assert.match(response.error, /changed its feed ID/i);
  const state = await harness.send({ type: "COMB_GET_FEED_STATE" });
  assert.equal(state.result.sources[0].status, "error");
  assert.equal(state.result.feeds[0].feedId, "background.test");
});

test("scheduled source refresh installs only a valid higher signed sequence", async () => {
  const sourceUrl = "https://feeds.comb.community/feed.json";
  const { trustKey, envelope, privateKeyJwk } = await signedFixture(1);
  let servedEnvelope = envelope;
  const harness = createBackgroundHarness({
    grantedOrigins: ["https://feeds.comb.community/*"],
    fetchImpl: async () => new Response(JSON.stringify(servedEnvelope), { status: 200 })
  });
  await harness.install();
  await harness.send({ type: "COMB_IMPORT_TRUST_KEY", trustKey });
  await harness.send({ type: "COMB_ADD_FEED_SOURCE", url: sourceUrl });

  servedEnvelope = await CombFeed.signPayload({
    ...envelope.payload,
    sequence: 2,
    issuedAt: new Date(Date.now() - 30_000).toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  }, privateKeyJwk, trustKey.keyId);
  await harness.fireAlarm("comb-signed-feed-refresh");

  const state = await harness.send({ type: "COMB_GET_FEED_STATE" });
  assert.equal(state.result.feeds[0].sequence, 2);
  assert.equal(state.result.sources[0].status, "ok");
  assert.equal(harness.fetchCalls.length, 2);
});

test("removing the final approved source clears its scheduler and reports the origin grant", async () => {
  const sourceUrl = "https://feeds.comb.community/feed.json";
  const { trustKey, envelope } = await signedFixture();
  const harness = createBackgroundHarness({
    grantedOrigins: ["https://feeds.comb.community/*"],
    fetchImpl: async () => new Response(JSON.stringify(envelope), { status: 200 })
  });
  await harness.install();
  await harness.send({ type: "COMB_IMPORT_TRUST_KEY", trustKey });
  await harness.send({ type: "COMB_ADD_FEED_SOURCE", url: sourceUrl });

  const response = await harness.send({ type: "COMB_DELETE_FEED_SOURCE", feedId: "background.test" });
  assert.equal(response.ok, true);
  assert.equal(response.result.removedOriginPattern, "https://feeds.comb.community/*");
  assert.equal(response.result.originStillUsed, false);
  assert.equal(response.result.permissionRemoved, true);
  assert.equal(response.result.state.sources.length, 0);
  assert.equal(response.result.state.feeds.length, 1, "last verified feed stays installed");
  assert.equal(harness.alarms["comb-signed-feed-refresh"], undefined);
  assert.equal(harness.grantedOrigins.has("https://feeds.comb.community/*"), false);
});

test("removing a trust key cascades its feeds, sources, alarm, and optional origin grant", async () => {
  const { trustKey, envelope } = await signedFixture();
  const harness = createBackgroundHarness({
    grantedOrigins: ["https://feeds.comb.community/*"],
    fetchImpl: async () => new Response(JSON.stringify(envelope), { status: 200 })
  });
  await harness.install();
  await harness.send({ type: "COMB_IMPORT_TRUST_KEY", trustKey });
  await harness.send({
    type: "COMB_ADD_FEED_SOURCE",
    url: "https://feeds.comb.community/feed.json"
  });

  const response = await harness.send({ type: "COMB_DELETE_TRUST_KEY", keyId: trustKey.keyId });
  assert.equal(response.ok, true);
  assert.equal(response.result.state.trustedKeys.length, 0);
  assert.equal(response.result.state.feeds.length, 0);
  assert.equal(response.result.state.sources.length, 0);
  assert.deepEqual(Array.from(response.result.removedOriginPatterns), ["https://feeds.comb.community/*"]);
  assert.equal(harness.grantedOrigins.size, 0);
  assert.equal(harness.alarms["comb-signed-feed-refresh"], undefined);
});

test("source deletion waits behind an in-flight refresh and cannot be undone by stale state", async () => {
  const { trustKey, envelope } = await signedFixture();
  let fetchCount = 0;
  let releaseRefresh;
  const refreshGate = new Promise((resolve) => { releaseRefresh = resolve; });
  const harness = createBackgroundHarness({
    grantedOrigins: ["https://feeds.comb.community/*"],
    fetchImpl: async () => {
      fetchCount += 1;
      if (fetchCount > 1) await refreshGate;
      return new Response(JSON.stringify(envelope), { status: 200 });
    }
  });
  await harness.install();
  await harness.send({ type: "COMB_IMPORT_TRUST_KEY", trustKey });
  await harness.send({
    type: "COMB_ADD_FEED_SOURCE",
    url: "https://feeds.comb.community/feed.json"
  });

  const refresh = harness.send({ type: "COMB_REFRESH_FEED_SOURCE", feedId: "background.test" });
  const remove = harness.send({ type: "COMB_DELETE_FEED_SOURCE", feedId: "background.test" });
  releaseRefresh();
  assert.equal((await refresh).ok, true);
  assert.equal((await remove).ok, true);

  const state = await harness.send({ type: "COMB_GET_FEED_STATE" });
  assert.equal(state.result.sources.length, 0);
  assert.equal(harness.grantedOrigins.size, 0);
});

test("background rejects a declared oversized feed response before reading it", async () => {
  const { trustKey, envelope } = await signedFixture();
  const harness = createBackgroundHarness({
    grantedOrigins: ["https://feeds.comb.community/*"],
    fetchImpl: async () => new Response(JSON.stringify(envelope), {
      status: 200,
      headers: { "content-length": String(2 * 1024 * 1024 + 1) }
    })
  });
  await harness.install();
  await harness.send({ type: "COMB_IMPORT_TRUST_KEY", trustKey });

  const response = await harness.send({
    type: "COMB_ADD_FEED_SOURCE",
    url: "https://feeds.comb.community/feed.json"
  });
  assert.equal(response.ok, false);
  assert.match(response.error, /2 MiB limit/i);
});

test("expired signed feeds retain sequence history for rollback protection", async () => {
  const harness = createBackgroundHarness();
  const { trustKey, envelope, privateKeyJwk } = await signedFixture(5);
  const now = Date.now();
  const expiredPayload = {
    ...envelope.payload,
    issuedAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    entries: envelope.payload.entries.map((entry) => ({
      ...entry,
      lastVerifiedAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString()
    }))
  };
  const historicalNow = now - 2.5 * 24 * 60 * 60 * 1000;
  const expiredEnvelope = await CombFeed.signPayload(
    expiredPayload,
    privateKeyJwk,
    trustKey.keyId,
    { now: historicalNow }
  );
  const historicalVerification = await CombFeed.verifyEnvelope(
    expiredEnvelope,
    trustKey,
    { now: historicalNow }
  );
  harness.setFeedState({
    version: 2,
    trustedKeys: { [trustKey.keyId]: trustKey },
    feeds: {
      "background.test": {
        envelope: expiredEnvelope,
        payload: historicalVerification.payload,
        payloadHash: historicalVerification.payloadHash,
        keyId: trustKey.keyId,
        verifiedAt: historicalVerification.verifiedAt
      }
    },
    sources: {}
  });

  const state = await harness.send({ type: "COMB_GET_FEED_STATE" });
  assert.equal(state.ok, true);
  assert.equal(state.result.feeds.length, 1);
  assert.equal(state.result.feeds[0].expired, true);

  const rollbackPayload = {
    ...envelope.payload,
    sequence: 4,
    issuedAt: new Date(now - 60_000).toISOString(),
    expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
  const rollbackEnvelope = await CombFeed.signPayload(rollbackPayload, privateKeyJwk, trustKey.keyId);
  const rollback = await harness.send({ type: "COMB_IMPORT_SIGNED_FEED", envelope: rollbackEnvelope });
  assert.equal(rollback.ok, false);
  assert.match(rollback.error, /older than installed sequence 5/i);
});
