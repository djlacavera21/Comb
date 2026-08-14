"use strict";

const CONTENT_FILES = [
  "src/content/checkout-engine.js",
  "src/content/runner.js"
];
const LIBRARY_KEY = "combCouponLibrary";
const MAX_CODES = 20;
const MAX_CODE_LENGTH = 64;
const MAX_MERCHANTS = 500;

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
  const library = await getLibrary();
  const merchant = library.merchants[hostname];

  return {
    tabId,
    hostname,
    title: cleanText(tab.title).slice(0, 120),
    scan,
    codes: merchant ? merchant.codes : [],
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
    await saveMerchantCodes(hostname, codes);
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
    default:
      return undefined;
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(LIBRARY_KEY);
  if (!stored[LIBRARY_KEY]) {
    await chrome.storage.local.set({ [LIBRARY_KEY]: emptyLibrary() });
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
