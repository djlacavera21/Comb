"use strict";

importScripts("shared/feed-verifier.js");

const CONTENT_FILES = [
  "src/content/checkout-engine.js",
  "src/content/runner.js"
];
const LIBRARY_KEY = "combCouponLibrary";
const FEED_STATE_KEY = "combFeedState";
const MAX_CODES = 20;
const MAX_CODE_LENGTH = 64;
const MAX_MERCHANTS = 500;
const MAX_TRUST_KEYS = 20;
const MAX_FEEDS = 20;
const MAX_SIGNED_FEED_BYTES = 2 * 1024 * 1024;

function cleanText(value) {
  return String(value == null ? "" : value)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(value) {
  const code = cleanText(value);

  if (!code || code.length > MAX_CODE_LENGTH) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._%+\-]*$/.test(code)) return null;
  return code;
}

function normalizeCodes(input) {
  const source = Array.isArray(input) ? input : cleanText(input).split(/[\s,;]+/);
  const output = [];
  const seen = new Set();

  for (const value of source) {
    const code = normalizeCode(value);
    const key = code ? code.toLocaleUpperCase("en-US") : null;

    if (!code || seen.has(key)) continue;
    seen.add(key);
    output.push(code);

    if (output.length >= MAX_CODES) break;
  }

  return output;
}

function normalizeHostname(value) {
  const hostname = cleanText(value).toLowerCase().replace(/^www\./, "");
  return /^[a-z0-9.-]+$/.test(hostname) ? hostname.slice(0, 253) : null;
}

function hostnameFromTab(tab) {
  try {
    const parsed = new URL(tab.url);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    return normalizeHostname(parsed.hostname);
  } catch (_error) {
    return null;
  }
}

function emptyLibrary() {
  return {
    version: 1,
    merchants: {}
  };
}

function validateLibrary(value) {
  const output = emptyLibrary();

  if (!value || typeof value !== "object" || !value.merchants || typeof value.merchants !== "object") {
    return output;
  }

  for (const [rawHostname, rawRecord] of Object.entries(value.merchants).slice(0, MAX_MERCHANTS)) {
    const hostname = normalizeHostname(rawHostname);
    const codes = normalizeCodes(rawRecord && rawRecord.codes);

    if (!hostname || !codes.length) continue;

    output.merchants[hostname] = {
      codes,
      updatedAt: Number.isFinite(rawRecord.updatedAt) ? rawRecord.updatedAt : Date.now()
    };
  }

  return output;
}

async function getLibrary() {
  const stored = await chrome.storage.local.get(LIBRARY_KEY);
  return validateLibrary(stored[LIBRARY_KEY]);
}

async function setLibrary(library) {
  const validated = validateLibrary(library);
  await chrome.storage.local.set({ [LIBRARY_KEY]: validated });
  return validated;
}

async function saveMerchantCodes(hostname, rawCodes) {
  const normalizedHostname = normalizeHostname(hostname);
  const codes = normalizeCodes(rawCodes);

  if (!normalizedHostname) {
    throw new Error("Comb could not identify this merchant.");
  }

  const library = await getLibrary();

  if (!codes.length) {
    delete library.merchants[normalizedHostname];
  } else {
    library.merchants[normalizedHostname] = {
      codes,
      updatedAt: Date.now()
    };
  }

  return setLibrary(library);
}

function emptyFeedState() {
  return {
    version: 1,
    trustedKeys: {},
    feeds: {}
  };
}

async function getFeedState() {
  const stored = await chrome.storage.local.get(FEED_STATE_KEY);
  const raw = stored[FEED_STATE_KEY];
  const state = emptyFeedState();

  if (!raw || typeof raw !== "object") return state;

  const rawKeys = raw.trustedKeys && typeof raw.trustedKeys === "object" ? raw.trustedKeys : {};
  for (const rawKey of Object.values(rawKeys).slice(0, MAX_TRUST_KEYS)) {
    try {
      const key = await CombFeed.validateTrustKey(rawKey);
      state.trustedKeys[key.keyId] = key;
    } catch (_error) {
      // Invalid local records are quarantined by omission.
    }
  }

  const rawFeeds = raw.feeds && typeof raw.feeds === "object" ? raw.feeds : {};
  for (const [feedId, record] of Object.entries(rawFeeds).slice(0, MAX_FEEDS)) {
    try {
      if (!record || typeof record !== "object" || !record.envelope) continue;
      const keyId = cleanText(record.envelope.signature && record.envelope.signature.keyId);
      const trustKey = state.trustedKeys[keyId];
      if (!trustKey) continue;
      const verified = await CombFeed.verifyEnvelope(record.envelope, trustKey);
      if (verified.payload.feedId !== feedId || verified.payloadHash !== cleanText(record.payloadHash)) continue;

      state.feeds[feedId] = {
        envelope: record.envelope,
        payload: verified.payload,
        payloadHash: verified.payloadHash,
        keyId: verified.keyId,
        verifiedAt: cleanText(record.verifiedAt).slice(0, 40)
      };
    } catch (_error) {
      // Expired, malformed, or orphaned feeds are not eligible for checkout use.
    }
  }

  return state;
}

async function setFeedState(state) {
  await chrome.storage.local.set({ [FEED_STATE_KEY]: state });
  return state;
}

function summarizeFeedState(state) {
  return {
    version: 1,
    trustedKeys: Object.values(state.trustedKeys)
      .map((key) => ({
        keyId: key.keyId,
        name: key.name,
        algorithm: key.algorithm,
        createdAt: key.createdAt
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    feeds: Object.values(state.feeds)
      .map((record) => ({
        feedId: record.payload.feedId,
        name: record.payload.name,
        sequence: record.payload.sequence,
        keyId: record.payload.keyId,
        issuedAt: record.payload.issuedAt,
        expiresAt: record.payload.expiresAt,
        entryCount: record.payload.entries.length,
        verifiedAt: record.verifiedAt
      }))
      .sort((left, right) => left.name.localeCompare(right.name))
  };
}

async function getFeedStateSummary() {
  return summarizeFeedState(await getFeedState());
}

async function importTrustKey(rawKey) {
  const key = await CombFeed.validateTrustKey(rawKey);
  const state = await getFeedState();

  if (!state.trustedKeys[key.keyId] && Object.keys(state.trustedKeys).length >= MAX_TRUST_KEYS) {
    throw new Error(`Comb supports at most ${MAX_TRUST_KEYS} trusted feed keys.`);
  }

  state.trustedKeys[key.keyId] = key;
  await setFeedState(state);
  return summarizeFeedState(state);
}

async function importSignedFeed(envelope) {
  let serialized;
  try {
    serialized = JSON.stringify(envelope);
  } catch (_error) {
    throw new Error("Signed feed is not valid JSON data.");
  }

  if (!serialized || new TextEncoder().encode(serialized).byteLength > MAX_SIGNED_FEED_BYTES) {
    throw new Error("Signed feed exceeds Comb's 2 MiB import limit.");
  }

  const state = await getFeedState();
  const keyId = cleanText(envelope && envelope.signature && envelope.signature.keyId);
  const trustKey = state.trustedKeys[keyId];
  if (!trustKey) throw new Error("Import the feed's public trust key before importing this signed feed.");

  const verified = await CombFeed.verifyEnvelope(envelope, trustKey);
  const existing = Object.prototype.hasOwnProperty.call(state.feeds, verified.payload.feedId)
    ? state.feeds[verified.payload.feedId]
    : null;
  if (existing && existing.keyId !== verified.keyId) {
    throw new Error("This feed ID is already bound to another trusted publisher. Remove it before changing signing keys.");
  }
  const classification = CombFeed.classifyFeedUpdate(existing, verified);

  if (classification === "identical") return summarizeFeedState(state);
  if (!existing && Object.keys(state.feeds).length >= MAX_FEEDS) {
    throw new Error(`Comb supports at most ${MAX_FEEDS} signed feeds.`);
  }

  state.feeds[verified.payload.feedId] = {
    envelope,
    payload: verified.payload,
    payloadHash: verified.payloadHash,
    keyId: verified.keyId,
    verifiedAt: verified.verifiedAt
  };
  await setFeedState(state);
  return summarizeFeedState(state);
}

async function deleteSignedFeed(rawFeedId) {
  const feedId = cleanText(rawFeedId).toLowerCase();
  const state = await getFeedState();
  delete state.feeds[feedId];
  await setFeedState(state);
  return summarizeFeedState(state);
}

async function deleteTrustKey(rawKeyId) {
  const keyId = cleanText(rawKeyId);
  const state = await getFeedState();
  delete state.trustedKeys[keyId];

  for (const [feedId, record] of Object.entries(state.feeds)) {
    if (record.keyId === keyId) delete state.feeds[feedId];
  }

  await setFeedState(state);
  return summarizeFeedState(state);
}

async function communityCodesForMerchant(hostname) {
  const state = await getFeedState();
  return CombFeed.selectCodesForMerchant(Object.values(state.feeds), hostname, { limit: MAX_CODES });
}

async function ensureCheckoutRunner(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "COMB_PING" });
    if (response && response.ready) return;
  } catch (_error) {
    // Expected on the first run for a tab.
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: CONTENT_FILES
  });

  const response = await chrome.tabs.sendMessage(tabId, { type: "COMB_PING" });
  if (!response || !response.ready) {
    throw new Error("Comb could not start its checkout engine on this page.");
  }
}

function sanitizeAttempt(value) {
  if (!value || typeof value !== "object") return null;

  return {
    code: normalizeCode(value.code),
    status: cleanText(value.status).slice(0, 40),
    beforeTotal: Number.isFinite(value.beforeTotal) ? value.beforeTotal : null,
    afterTotal: Number.isFinite(value.afterTotal) ? value.afterTotal : null,
    savings: Number.isFinite(value.savings) ? value.savings : 0,
    currency: cleanText(value.currency).slice(0, 8) || null,
    message: cleanText(value.message).slice(0, 180) || null
  };
}

function sanitizeProgress(value) {
  const allowedPhases = new Set([
    "started",
    "testing",
    "tested",
    "stopped",
    "restoring",
    "complete"
  ]);
  const phase = cleanText(value && value.phase);

  return {
    phase: allowedPhases.has(phase) ? phase : "unknown",
    code: normalizeCode(value && value.code),
    index: Number.isInteger(value && value.index) ? value.index : null,
    totalCodes: Number.isInteger(value && value.totalCodes) ? value.totalCodes : null,
    baseline: Number.isFinite(value && value.baseline) ? value.baseline : null,
    reason: cleanText(value && value.reason).slice(0, 80) || null,
    result: sanitizeAttempt(value && value.result)
  };
}

async function initializePopup(message) {
  const tabId = Number(message.tabId);

  if (!Number.isInteger(tabId)) {
    throw new Error("Comb could not identify the active tab.");
  }

  const tab = await chrome.tabs.get(tabId);
  const hostname = hostnameFromTab(tab);

  if (!hostname) {
    throw new Error("Open Comb on a normal HTTP or HTTPS checkout page.");
  }

  await ensureCheckoutRunner(tabId);
  const scan = await chrome.tabs.sendMessage(tabId, { type: "COMB_SCAN" });
  const [library, communityCodes] = await Promise.all([
    getLibrary(),
    communityCodesForMerchant(hostname)
  ]);
  const merchant = library.merchants[hostname];
  const localCodes = merchant ? merchant.codes : [];
  const codes = normalizeCodes([...localCodes, ...communityCodes.map((candidate) => candidate.code)]);
  const included = new Set(codes.map((code) => code.toLocaleUpperCase("en-US")));

  return {
    tabId,
    hostname,
    title: cleanText(tab.title).slice(0, 120),
    scan,
    codes,
    localCodes,
    communityCodes: communityCodes.filter((candidate) =>
      included.has(candidate.code.toLocaleUpperCase("en-US"))
    ),
    attribution: {
      protected: true,
      detail: "Comb never replaces creator affiliate tags or cookies."
    }
  };
}

async function runCouponJob(message) {
  const tabId = Number(message.tabId);
  const codes = normalizeCodes(message.codes);

  if (!Number.isInteger(tabId)) throw new Error("Comb could not identify the active tab.");
  if (!codes.length) throw new Error("Enter at least one valid coupon code.");

  const tab = await chrome.tabs.get(tabId);
  const hostname = hostnameFromTab(tab);

  if (!hostname) throw new Error("This is not a supported checkout page.");

  if (message.saveCodes !== false) {
    const codesToSave = Array.isArray(message.localCodes) ? message.localCodes : codes;
    await saveMerchantCodes(hostname, codesToSave);
  }

  await ensureCheckoutRunner(tabId);
  return chrome.tabs.sendMessage(tabId, {
    type: "COMB_RUN",
    codes
  });
}

async function routeMessage(message, sender) {
  if (!message || typeof message.type !== "string") return undefined;

  switch (message.type) {
    case "COMB_INIT":
      return initializePopup(message);
    case "COMB_RUN":
      return runCouponJob(message);
    case "COMB_CANCEL": {
      const tabId = Number(message.tabId);
      if (!Number.isInteger(tabId)) throw new Error("Comb could not identify the active tab.");
      return chrome.tabs.sendMessage(tabId, { type: "COMB_CANCEL" });
    }
    case "COMB_PROGRESS": {
      if (!sender.tab || !Number.isInteger(sender.tab.id)) return { ignored: true };
      const progress = sanitizeProgress(message.progress);
      await chrome.runtime.sendMessage({
        type: "COMB_PROGRESS_UPDATE",
        tabId: sender.tab.id,
        progress
      }).catch(() => undefined);
      return { received: true };
    }
    case "COMB_GET_LIBRARY":
      return getLibrary();
    case "COMB_SAVE_MERCHANT":
      return saveMerchantCodes(message.hostname, message.codes);
    case "COMB_DELETE_MERCHANT":
      return saveMerchantCodes(message.hostname, []);
    case "COMB_REPLACE_LIBRARY":
      return setLibrary(message.library);
    case "COMB_GET_FEED_STATE":
      return getFeedStateSummary();
    case "COMB_IMPORT_TRUST_KEY":
      return importTrustKey(message.trustKey);
    case "COMB_IMPORT_SIGNED_FEED":
      return importSignedFeed(message.envelope);
    case "COMB_DELETE_TRUST_KEY":
      return deleteTrustKey(message.keyId);
    case "COMB_DELETE_SIGNED_FEED":
      return deleteSignedFeed(message.feedId);
    default:
      return undefined;
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get([LIBRARY_KEY, FEED_STATE_KEY]);
  if (!stored[LIBRARY_KEY]) {
    await chrome.storage.local.set({ [LIBRARY_KEY]: emptyLibrary() });
  }
  if (!stored[FEED_STATE_KEY]) {
    await chrome.storage.local.set({ [FEED_STATE_KEY]: emptyFeedState() });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  routeMessage(message, sender)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: cleanText(error && error.message ? error.message : error).slice(0, 240)
      });
    });

  return true;
});
