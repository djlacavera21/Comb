"use strict";

const elements = {
  merchantCount: document.querySelector("#merchantCount"),
  emptyState: document.querySelector("#emptyState"),
  merchantList: document.querySelector("#merchantList"),
  feedSummaryCount: document.querySelector("#feedSummaryCount"),
  trustKeyInput: document.querySelector("#trustKeyInput"),
  signedFeedInput: document.querySelector("#signedFeedInput"),
  trustKeyEmpty: document.querySelector("#trustKeyEmpty"),
  signedFeedEmpty: document.querySelector("#signedFeedEmpty"),
  trustKeyList: document.querySelector("#trustKeyList"),
  signedFeedList: document.querySelector("#signedFeedList"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  clearButton: document.querySelector("#clearButton"),
  pageStatus: document.querySelector("#pageStatus")
};

let currentLibrary = { version: 1, merchants: {} };
let currentFeedState = { version: 1, trustedKeys: [], feeds: [] };

function setStatus(message, error = false) {
  elements.pageStatus.textContent = message;
  elements.pageStatus.classList.toggle("error", error);
}

async function callBackground(message) {
  const response = await chrome.runtime.sendMessage(message);

  if (!response || response.ok !== true) {
    throw new Error(response && response.error ? response.error : "Comb did not receive a response.");
  }

  return response.result;
}

function createMerchant(hostname, record) {
  const container = document.createElement("article");
  const heading = document.createElement("div");
  const name = document.createElement("strong");
  const removeButton = document.createElement("button");
  const chips = document.createElement("div");
  container.className = "merchant";
  heading.className = "merchant-heading";
  chips.className = "chips";
  name.textContent = hostname;
  removeButton.type = "button";
  removeButton.textContent = "Delete merchant";
  removeButton.addEventListener("click", () => deleteMerchant(hostname));
  heading.append(name, removeButton);

  for (const code of record.codes || []) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = code;
    chips.append(chip);
  }

  container.append(heading, chips);
  return container;
}

function renderLibrary(library) {
  currentLibrary = library || { version: 1, merchants: {} };
  const merchants = Object.entries(currentLibrary.merchants || {}).sort(([a], [b]) => a.localeCompare(b));
  elements.merchantList.replaceChildren();
  elements.emptyState.hidden = merchants.length > 0;
  elements.merchantCount.textContent = `${merchants.length} merchant${merchants.length === 1 ? "" : "s"}`;
  elements.exportButton.disabled = merchants.length === 0;
  elements.clearButton.disabled = merchants.length === 0;

  for (const [hostname, record] of merchants) {
    elements.merchantList.append(createMerchant(hostname, record));
  }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function createTrustKey(key) {
  const article = document.createElement("article");
  const copy = document.createElement("div");
  const name = document.createElement("strong");
  const fingerprint = document.createElement("code");
  const removeButton = document.createElement("button");
  article.className = "feed-record";
  name.textContent = key.name;
  fingerprint.textContent = key.keyId;
  fingerprint.title = key.keyId;
  copy.append(name, fingerprint);
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.title = "Remove this key and every feed signed by it";
  removeButton.addEventListener("click", () => deleteTrustKey(key));
  article.append(copy, removeButton);
  return article;
}

function createSignedFeed(feed) {
  const article = document.createElement("article");
  const copy = document.createElement("div");
  const name = document.createElement("strong");
  const metadata = document.createElement("span");
  const removeButton = document.createElement("button");
  article.className = "feed-record";
  name.textContent = feed.name;
  metadata.textContent = `${feed.entryCount} codes · sequence ${feed.sequence} · expires ${formatDate(feed.expiresAt)}`;
  copy.append(name, metadata);
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => deleteSignedFeed(feed));
  article.append(copy, removeButton);
  return article;
}

function renderFeedState(feedState) {
  currentFeedState = feedState || { version: 1, trustedKeys: [], feeds: [] };
  const keys = currentFeedState.trustedKeys || [];
  const feeds = currentFeedState.feeds || [];
  elements.feedSummaryCount.textContent = `${feeds.length} feed${feeds.length === 1 ? "" : "s"} · ${keys.length} key${keys.length === 1 ? "" : "s"}`;
  elements.trustKeyEmpty.hidden = keys.length > 0;
  elements.signedFeedEmpty.hidden = feeds.length > 0;
  elements.trustKeyList.replaceChildren(...keys.map(createTrustKey));
  elements.signedFeedList.replaceChildren(...feeds.map(createSignedFeed));
  elements.signedFeedInput.disabled = keys.length === 0;
  elements.signedFeedInput.previousElementSibling.classList.toggle("disabled", keys.length === 0);
  elements.signedFeedInput.previousElementSibling.setAttribute("aria-disabled", String(keys.length === 0));
}

async function loadLibrary() {
  try {
    const [library, feedState] = await Promise.all([
      callBackground({ type: "COMB_GET_LIBRARY" }),
      callBackground({ type: "COMB_GET_FEED_STATE" })
    ]);
    renderLibrary(library);
    renderFeedState(feedState);
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
}

async function readJsonFile(file, maximumBytes, label) {
  if (!file) return null;
  if (file.size > maximumBytes) throw new Error(`${label} exceeds the ${Math.round(maximumBytes / 1024)} KiB limit.`);
  return JSON.parse(await file.text());
}

async function importTrustKey(file) {
  try {
    const trustKey = await readJsonFile(file, 64 * 1024, "Trust key");
    if (!trustKey) return;
    renderFeedState(await callBackground({ type: "COMB_IMPORT_TRUST_KEY", trustKey }));
    setStatus("Public feed key imported and fingerprint verified.");
  } catch (error) {
    setStatus(`Trust-key import failed: ${error.message || String(error)}`, true);
  } finally {
    elements.trustKeyInput.value = "";
  }
}

async function importSignedFeed(file) {
  try {
    const envelope = await readJsonFile(file, 2 * 1024 * 1024, "Signed feed");
    if (!envelope) return;
    renderFeedState(await callBackground({ type: "COMB_IMPORT_SIGNED_FEED", envelope }));
    setStatus("Feed signature, expiry, schema, and sequence verified. Coupon codes are now available.");
  } catch (error) {
    setStatus(`Feed import failed: ${error.message || String(error)}`, true);
  } finally {
    elements.signedFeedInput.value = "";
  }
}

async function deleteTrustKey(key) {
  const shouldDelete = confirm(`Remove “${key.name}” and every signed feed that uses this key?`);
  if (!shouldDelete) return;

  try {
    renderFeedState(await callBackground({ type: "COMB_DELETE_TRUST_KEY", keyId: key.keyId }));
    setStatus(`Removed trust key “${key.name}” and its feeds.`);
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
}

async function deleteSignedFeed(feed) {
  try {
    renderFeedState(await callBackground({ type: "COMB_DELETE_SIGNED_FEED", feedId: feed.feedId }));
    setStatus(`Removed signed feed “${feed.name}”.`);
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
}

async function deleteMerchant(hostname) {
  try {
    const library = await callBackground({ type: "COMB_DELETE_MERCHANT", hostname });
    renderLibrary(library);
    setStatus(`Deleted codes for ${hostname}.`);
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
}

function exportLibrary() {
  const payload = JSON.stringify(currentLibrary, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `comb-coupon-library-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
  setStatus("Exported the local coupon library.");
}

async function importLibrary(file) {
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const library = await callBackground({ type: "COMB_REPLACE_LIBRARY", library: parsed });
    renderLibrary(library);
    setStatus("Imported and validated the coupon library.");
  } catch (error) {
    setStatus(`Import failed: ${error.message || String(error)}`, true);
  } finally {
    elements.importInput.value = "";
  }
}

async function clearLibrary() {
  const shouldErase = confirm("Erase every merchant and coupon code saved by Comb on this browser?");
  if (!shouldErase) return;

  try {
    const library = await callBackground({
      type: "COMB_REPLACE_LIBRARY",
      library: { version: 1, merchants: {} }
    });
    renderLibrary(library);
    setStatus("Erased the local coupon library.");
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
}

elements.exportButton.addEventListener("click", exportLibrary);
elements.importInput.addEventListener("change", () => importLibrary(elements.importInput.files[0]));
elements.clearButton.addEventListener("click", clearLibrary);
elements.trustKeyInput.addEventListener("change", () => importTrustKey(elements.trustKeyInput.files[0]));
elements.signedFeedInput.addEventListener("change", () => importSignedFeed(elements.signedFeedInput.files[0]));

loadLibrary();
