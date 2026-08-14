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
  return { trustKey, envelope };
}

function createBackgroundHarness() {
  const storage = {};
  let messageListener;
  let installedListener;
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
        async sendMessage() { return undefined; }
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

  function send(rawMessage) {
    const message = intoContext(rawMessage);
    return new Promise((resolve) => {
      const keepAlive = messageListener(message, {}, resolve);
      assert.equal(keepAlive, true);
    });
  }

  return {
    storage,
    send,
    async install() { await installedListener(); }
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
