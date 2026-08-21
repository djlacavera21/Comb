"use strict";

if (typeof importScripts === "function") {
  importScripts("shared/feed-verifier.js", "shared/source-policy.js");
}

const extensionApi = globalThis.browser || globalThis.chrome;
if (!extensionApi) throw new Error("Comb requires the WebExtensions API.");

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
const MAX_SOURCES = 20;
const MAX_SIGNED_FEED_BYTES = 2 * 1024 * 1024;
const FEED_REFRESH_ALARM = "comb-signed-feed-refresh";
const FEED_REFRESH_MINUTES = 12 * 60;
const FEED_FETCH_TIMEOUT_MS = 15_000;
const SOURCE_STATUSES = new Set(["idle", "ok", "error", "permission-needed"]);
let feedMutationTail = Promise.resolve();

function queueFeedMutation(task) {
  const run = feedMutationTail.then(task, task);
  feedMutationTail = run.catch(() => undefined);
  return run;
}

function afterFeedMutations(task) {
  return feedMutationTail.then(task);
}

function cleanText(value) {
  return String(value == null ? "" : value)
    .replace(/\s+/g, " ")
    .trim();
}

function ownRecord(collection, key) {
  return Object.prototype.hasOwnProperty.call(collection, key) ? collection[key] : null;
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
  const stored = await extensionApi.storage.local.get(LIBRARY_KEY);
  return validateLibrary(stored[LIBRARY_KEY]);
}

async function setLibrary(library) {
  const validated = validateLibrary(library);
  await extensionApi.storage.local.set({ [LIBRARY_KEY]: validated });
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
    version: 2,
    trustedKeys: {},
    feeds: {},
    sources: {}
  };
}

function normalizeStoredTimestamp(value) {
  const milliseconds = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

async function getFeedState() {
  const stored = await extensionApi.storage.local.get(FEED_STATE_KEY);
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
      const verified = await CombFeed.verifyEnvelope(record.envelope, trustKey, { allowExpired: true });
      if (verified.payload.feedId !== feedId || verified.payloadHash !== cleanText(record.payloadHash)) continue;

      state.feeds[feedId] = {
        envelope: record.envelope,
        payload: verified.payload,
        payloadHash: verified.payloadHash,
        keyId: verified.keyId,
        verifiedAt: cleanText(record.verifiedAt).slice(0, 40)
      };
    } catch (_error) {
      // Malformed, signature-mismatched, or orphaned records are quarantined.
    }
  }

  const rawSources = raw.sources && typeof raw.sources === "object" ? raw.sources : {};
  for (const rawSource of Object.values(rawSources).slice(0, MAX_SOURCES)) {
    try {
      if (!rawSource || typeof rawSource !== "object") continue;
      const descriptor = CombSourcePolicy.normalizeSourceUrl(rawSource.url);
      const feedId = cleanText(rawSource.feedId).toLowerCase();
      const keyId = cleanText(rawSource.keyId);
      const addedAt = normalizeStoredTimestamp(rawSource.addedAt);
      if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(feedId) || !state.trustedKeys[keyId] || !addedAt) continue;

      state.sources[feedId] = {
        feedId,
        keyId,
        url: descriptor.url,
        originPattern: descriptor.originPattern,
        addedAt,
        lastCheckedAt: normalizeStoredTimestamp(rawSource.lastCheckedAt),
        lastUpdatedAt: normalizeStoredTimestamp(rawSource.lastUpdatedAt),
        status: SOURCE_STATUSES.has(rawSource.status) ? rawSource.status : "idle",
        lastError: cleanText(rawSource.lastError).slice(0, 160) || null
      };
    } catch (_error) {
      // Invalid source configuration is quarantined without making a request.
    }
  }

  return state;
}

async function setFeedState(state) {
  await extensionApi.storage.local.set({ [FEED_STATE_KEY]: state });
  return state;
}

function summarizeFeedState(state) {
  const now = Date.now();
  return {
    version: 2,
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
        verifiedAt: record.verifiedAt,
        expired: Date.parse(record.payload.expiresAt) <= now
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    sources: Object.values(state.sources)
      .map((source) => ({ ...source }))
      .sort((left, right) => left.feedId.localeCompare(right.feedId))
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

function assertEnvelopeSize(envelope) {
  let serialized;
  try {
    serialized = JSON.stringify(envelope);
  } catch (_error) {
    throw new Error("Signed feed is not valid JSON data.");
  }

  if (!serialized || new TextEncoder().encode(serialized).byteLength > MAX_SIGNED_FEED_BYTES) {
    throw new Error("Signed feed exceeds Comb's 2 MiB import limit.");
  }
}

async function verifyAndInstallEnvelope(state, envelope, expected = {}) {
  assertEnvelopeSize(envelope);
  const keyId = cleanText(envelope && envelope.signature && envelope.signature.keyId);
  const trustKey = state.trustedKeys[keyId];
  if (!trustKey) throw new Error("Import the feed's public trust key before importing this signed feed.");

  const verified = await CombFeed.verifyEnvelope(envelope, trustKey);
  if (expected.keyId && verified.keyId !== expected.keyId) {
    throw new Error("Feed source changed signing keys. Reapprove the publisher key and source explicitly.");
  }
  if (expected.feedId && verified.payload.feedId !== expected.feedId) {
    throw new Error("Feed source changed its feed ID and was rejected.");
  }
  const existing = Object.prototype.hasOwnProperty.call(state.feeds, verified.payload.feedId)
    ? state.feeds[verified.payload.feedId]
    : null;
  if (existing && existing.keyId !== verified.keyId) {
    throw new Error("This feed ID is already bound to another trusted publisher. Remove it before changing signing keys.");
  }
  const classification = CombFeed.classifyFeedUpdate(existing, verified);

  if (!existing && Object.keys(state.feeds).length >= MAX_FEEDS) {
    throw new Error(`Comb supports at most ${MAX_FEEDS} signed feeds.`);
  }

  if (classification !== "identical") {
    state.feeds[verified.payload.feedId] = {
      envelope,
      payload: verified.payload,
      payloadHash: verified.payloadHash,
      keyId: verified.keyId,
      verifiedAt: verified.verifiedAt
    };
  }

  return { classification, verified };
}

async function importSignedFeed(envelope) {
  const state = await getFeedState();
  await verifyAndInstallEnvelope(state, envelope);
  await setFeedState(state);
  return summarizeFeedState(state);
}

async function deleteSignedFeed(rawFeedId) {
  const feedId = cleanText(rawFeedId).toLowerCase();
  const state = await getFeedState();
  if (ownRecord(state.sources, feedId)) {
    throw new Error("Remove this feed's approved update source before removing the installed feed.");
  }
  delete state.feeds[feedId];
  await setFeedState(state);
  return summarizeFeedState(state);
}

async function deleteTrustKey(rawKeyId) {
  const keyId = cleanText(rawKeyId);
  const state = await getFeedState();
  const removedOrigins = new Set();
  delete state.trustedKeys[keyId];

  for (const [feedId, record] of Object.entries(state.feeds)) {
    if (record.keyId === keyId) delete state.feeds[feedId];
  }
  for (const [feedId, source] of Object.entries(state.sources)) {
    if (source.keyId === keyId) {
      removedOrigins.add(source.originPattern);
      delete state.sources[feedId];
    }
  }

  await setFeedState(state);
  await syncFeedAlarm(state);
  const removableOrigins = Array.from(removedOrigins).filter((originPattern) =>
    !Object.values(state.sources).some((source) => source.originPattern === originPattern)
  );
  await Promise.all(removableOrigins.map((originPattern) =>
    extensionApi.permissions.remove({ origins: [originPattern] }).catch(() => false)
  ));
  return {
    state: summarizeFeedState(state),
    removedOriginPatterns: removableOrigins
  };
}

function assertOptionsSender(sender) {
  const expectedUrl = extensionApi.runtime.getURL("src/options/options.html");
  if (!sender || sender.tab || sender.url !== expectedUrl) {
    throw new Error("Feed trust and source changes are allowed only from Comb settings.");
  }
}

async function syncFeedAlarm(state) {
  if (Object.keys(state.sources).length) {
    const existing = await extensionApi.alarms.get(FEED_REFRESH_ALARM);
    if (!existing) {
      await extensionApi.alarms.create(FEED_REFRESH_ALARM, {
        delayInMinutes: FEED_REFRESH_MINUTES,
        periodInMinutes: FEED_REFRESH_MINUTES
      });
    }
  } else {
    await extensionApi.alarms.clear(FEED_REFRESH_ALARM);
  }
}

async function readBoundedFeedResponse(response) {
  const rawLength = response.headers && response.headers.get
    ? response.headers.get("content-length")
    : null;
  const declaredLength = rawLength == null ? null : Number(rawLength);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SIGNED_FEED_BYTES) {
    throw new Error("Feed source response exceeds Comb's 2 MiB limit.");
  }

  let bytes;
  if (response.body && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      total += chunk.byteLength;
      if (total > MAX_SIGNED_FEED_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error("Feed source response exceeds Comb's 2 MiB limit.");
      }
      chunks.push(chunk);
    }

    bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } else {
    bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_SIGNED_FEED_BYTES) {
      throw new Error("Feed source response exceeds Comb's 2 MiB limit.");
    }
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text);
  } catch (_error) {
    throw new Error("Feed source did not return valid UTF-8 JSON.");
  }
}

async function fetchFeedEnvelope(source) {
  const descriptor = CombSourcePolicy.normalizeSourceUrl(source.url);
  const permitted = await extensionApi.permissions.contains({ origins: [descriptor.originPattern] });
  if (!permitted) {
    const error = new Error("Feed source access is no longer approved. Reconnect it from Comb settings.");
    error.code = "permission_needed";
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FEED_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(descriptor.url, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal
    });
    if (!response.ok || response.status !== 200) {
      throw new Error(`Feed source returned HTTP ${Number(response.status) || "error"}.`);
    }
    return await readBoundedFeedResponse(response);
  } catch (error) {
    if (error && error.name === "AbortError") throw new Error("Feed source request timed out.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function addFeedSource(rawUrl) {
  const descriptor = CombSourcePolicy.normalizeSourceUrl(rawUrl);
  const state = await getFeedState();
  const existingUrlSource = Object.values(state.sources).find((source) => source.url === descriptor.url);
  if (existingUrlSource) return refreshFeedSource(existingUrlSource.feedId);
  if (Object.keys(state.sources).length >= MAX_SOURCES) {
    throw new Error(`Comb supports at most ${MAX_SOURCES} approved feed sources.`);
  }

  const envelope = await fetchFeedEnvelope(descriptor);
  const { verified } = await verifyAndInstallEnvelope(state, envelope);
  const feedId = verified.payload.feedId;
  const existingSource = ownRecord(state.sources, feedId);
  if (existingSource && existingSource.url !== descriptor.url) {
    throw new Error("This feed already has a different approved source. Remove it before changing origins.");
  }

  const now = new Date().toISOString();
  state.sources[feedId] = {
    feedId,
    keyId: verified.keyId,
    url: descriptor.url,
    originPattern: descriptor.originPattern,
    addedAt: existingSource ? existingSource.addedAt : now,
    lastCheckedAt: now,
    lastUpdatedAt: now,
    status: "ok",
    lastError: null
  };
  await setFeedState(state);
  await syncFeedAlarm(state);
  return summarizeFeedState(state);
}

async function refreshFeedSource(rawFeedId, scheduled = false) {
  const feedId = cleanText(rawFeedId).toLowerCase();
  const state = await getFeedState();
  const source = ownRecord(state.sources, feedId);
  if (!source) throw new Error("Approved feed source was not found.");

  try {
    const envelope = await fetchFeedEnvelope(source);
    const { classification } = await verifyAndInstallEnvelope(state, envelope, {
      feedId: source.feedId,
      keyId: source.keyId
    });
    const now = new Date().toISOString();
    source.lastCheckedAt = now;
    if (classification !== "identical") source.lastUpdatedAt = now;
    source.status = "ok";
    source.lastError = null;
    await setFeedState(state);
    return summarizeFeedState(state);
  } catch (error) {
    source.lastCheckedAt = new Date().toISOString();
    source.status = error && error.code === "permission_needed" ? "permission-needed" : "error";
    source.lastError = cleanText(error && error.message ? error.message : error).slice(0, 160);
    await setFeedState(state);
    if (!scheduled) throw error;
    return null;
  }
}

async function refreshAllFeedSources() {
  const state = await getFeedState();
  for (const feedId of Object.keys(state.sources)) {
    await refreshFeedSource(feedId, true);
  }
}

async function deleteFeedSource(rawFeedId) {
  const feedId = cleanText(rawFeedId).toLowerCase();
  const state = await getFeedState();
  const source = ownRecord(state.sources, feedId);
  if (!source) throw new Error("Approved feed source was not found.");
  delete state.sources[feedId];
  const originStillUsed = Object.values(state.sources).some(
    (candidate) => candidate.originPattern === source.originPattern
  );
  await setFeedState(state);
  await syncFeedAlarm(state);
  const permissionRemoved = originStillUsed
    ? false
    : await extensionApi.permissions.remove({ origins: [source.originPattern] }).catch(() => false);
  return {
    state: summarizeFeedState(state),
    removedOriginPattern: source.originPattern,
    originStillUsed,
    permissionRemoved
  };
}

async function communityCodesForMerchant(hostname) {
  return afterFeedMutations(async () => {
    const state = await getFeedState();
    return CombFeed.selectCodesForMerchant(Object.values(state.feeds), hostname, { limit: MAX_CODES });
  });
}

async function searchCommunityCatalog(options) {
  return afterFeedMutations(async () => {
    const state = await getFeedState();
    return CombFeed.searchCatalog(Object.values(state.feeds), options);
  });
}

async function ensureCheckoutRunner(tabId) {
  try {
    const response = await extensionApi.tabs.sendMessage(tabId, { type: "COMB_PING" });
    if (response && response.ready) return;
  } catch (_error) {
    // Expected on the first run for a tab.
  }

  await extensionApi.scripting.executeScript({
    target: { tabId },
    files: CONTENT_FILES
  });

  const response = await extensionApi.tabs.sendMessage(tabId, { type: "COMB_PING" });
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

  const tab = await extensionApi.tabs.get(tabId);
  const hostname = hostnameFromTab(tab);

  if (!hostname) {
    throw new Error("Open Comb on a normal HTTP or HTTPS checkout page.");
  }

  await ensureCheckoutRunner(tabId);
  const scan = await extensionApi.tabs.sendMessage(tabId, { type: "COMB_SCAN" });
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

  const tab = await extensionApi.tabs.get(tabId);
  const hostname = hostnameFromTab(tab);

  if (!hostname) throw new Error("This is not a supported checkout page.");

  if (message.saveCodes !== false) {
    const codesToSave = Array.isArray(message.localCodes) ? message.localCodes : codes;
    await saveMerchantCodes(hostname, codesToSave);
  }

  await ensureCheckoutRunner(tabId);
  return extensionApi.tabs.sendMessage(tabId, {
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
      return extensionApi.tabs.sendMessage(tabId, { type: "COMB_CANCEL" });
    }
    case "COMB_PROGRESS": {
      if (!sender.tab || !Number.isInteger(sender.tab.id)) return { ignored: true };
      const progress = sanitizeProgress(message.progress);
      await extensionApi.runtime.sendMessage({
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
      assertOptionsSender(sender);
      return afterFeedMutations(getFeedStateSummary);
    case "COMB_SEARCH_CATALOG":
      assertOptionsSender(sender);
      return searchCommunityCatalog({
        query: message.query,
        status: message.status,
        sort: message.sort,
        offset: message.offset,
        limit: message.limit
      });
    case "COMB_IMPORT_TRUST_KEY":
      assertOptionsSender(sender);
      return queueFeedMutation(() => importTrustKey(message.trustKey));
    case "COMB_IMPORT_SIGNED_FEED":
      assertOptionsSender(sender);
      return queueFeedMutation(() => importSignedFeed(message.envelope));
    case "COMB_DELETE_TRUST_KEY":
      assertOptionsSender(sender);
      return queueFeedMutation(() => deleteTrustKey(message.keyId));
    case "COMB_DELETE_SIGNED_FEED":
      assertOptionsSender(sender);
      return queueFeedMutation(() => deleteSignedFeed(message.feedId));
    case "COMB_ADD_FEED_SOURCE":
      assertOptionsSender(sender);
      return queueFeedMutation(() => addFeedSource(message.url));
    case "COMB_REFRESH_FEED_SOURCE":
      assertOptionsSender(sender);
      return queueFeedMutation(() => refreshFeedSource(message.feedId));
    case "COMB_DELETE_FEED_SOURCE":
      assertOptionsSender(sender);
      return queueFeedMutation(() => deleteFeedSource(message.feedId));
    default:
      return undefined;
  }
}

extensionApi.runtime.onInstalled.addListener(() => queueFeedMutation(async () => {
  const stored = await extensionApi.storage.local.get([LIBRARY_KEY, FEED_STATE_KEY]);
  if (!stored[LIBRARY_KEY]) {
    await extensionApi.storage.local.set({ [LIBRARY_KEY]: emptyLibrary() });
  }
  if (!stored[FEED_STATE_KEY]) {
    await extensionApi.storage.local.set({ [FEED_STATE_KEY]: emptyFeedState() });
  }
  await syncFeedAlarm(await getFeedState());
}));

extensionApi.alarms.onAlarm.addListener((alarm) => {
  if (alarm && alarm.name === FEED_REFRESH_ALARM) {
    return queueFeedMutation(refreshAllFeedSources).catch(() => undefined);
  }
  return undefined;
});

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

afterFeedMutations(async () => syncFeedAlarm(await getFeedState()))
  .catch(() => undefined);
