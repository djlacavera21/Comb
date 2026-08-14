"use strict";

const elements = {
  merchantCount: document.querySelector("#merchantCount"),
  emptyState: document.querySelector("#emptyState"),
  merchantList: document.querySelector("#merchantList"),
  feedSummaryCount: document.querySelector("#feedSummaryCount"),
  trustKeyInput: document.querySelector("#trustKeyInput"),
  trustKeyButton: document.querySelector("#trustKeyButton"),
  signedFeedInput: document.querySelector("#signedFeedInput"),
  signedFeedButton: document.querySelector("#signedFeedButton"),
  trustKeyEmpty: document.querySelector("#trustKeyEmpty"),
  signedFeedEmpty: document.querySelector("#signedFeedEmpty"),
  trustKeyList: document.querySelector("#trustKeyList"),
  signedFeedList: document.querySelector("#signedFeedList"),
  sourceForm: document.querySelector("#sourceForm"),
  sourceUrlInput: document.querySelector("#sourceUrlInput"),
  connectSourceButton: document.querySelector("#connectSourceButton"),
  sourceEmpty: document.querySelector("#sourceEmpty"),
  sourceList: document.querySelector("#sourceList"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  importButton: document.querySelector("#importButton"),
  clearButton: document.querySelector("#clearButton"),
  pageStatus: document.querySelector("#pageStatus")
};

let currentLibrary = { version: 1, merchants: {} };
let currentFeedState = { version: 2, trustedKeys: [], feeds: [], sources: [] };

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
  removeButton.setAttribute("aria-label", `Delete saved coupon codes for ${hostname}`);
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
  removeButton.setAttribute("aria-label", `Remove trusted key ${key.name}`);
  removeButton.title = "Remove this key and every feed or source pinned to it";
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
  metadata.textContent = `${feed.expired ? "Expired · " : ""}${feed.entryCount} codes · sequence ${feed.sequence} · expires ${formatDate(feed.expiresAt)}`;
  if (feed.expired) metadata.classList.add("expired");
  copy.append(name, metadata);
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.setAttribute("aria-label", `Remove signed feed ${feed.name}`);
  removeButton.addEventListener("click", () => deleteSignedFeed(feed));
  article.append(copy, removeButton);
  return article;
}

function sourceStatus(source) {
  if (source.status === "permission-needed") return "Origin approval needed";
  if (source.status === "error") return `Update failed${source.lastError ? `: ${source.lastError}` : ""}`;
  if (source.lastCheckedAt) return `Verified ${formatDate(source.lastCheckedAt)}`;
  return "Awaiting first check";
}

function createFeedSource(source) {
  const article = document.createElement("article");
  const copy = document.createElement("div");
  const name = document.createElement("strong");
  const url = document.createElement("code");
  const metadata = document.createElement("span");
  const actions = document.createElement("div");
  const refreshButton = document.createElement("button");
  const removeButton = document.createElement("button");
  article.className = "source-record";
  name.textContent = source.feedId;
  url.textContent = source.url;
  url.title = source.url;
  metadata.textContent = `${sourceStatus(source)} · signer ${source.keyId}`;
  if (source.status === "error" || source.status === "permission-needed") metadata.classList.add("error");
  copy.append(name, url, metadata);
  actions.className = "source-actions";
  refreshButton.type = "button";
  refreshButton.textContent = "Check now";
  refreshButton.setAttribute("aria-label", `Check approved source for ${source.feedId}`);
  refreshButton.addEventListener("click", () => refreshFeedSource(source));
  removeButton.type = "button";
  removeButton.textContent = "Remove access";
  removeButton.className = "danger-link";
  removeButton.setAttribute("aria-label", `Remove approved source for ${source.feedId}`);
  removeButton.addEventListener("click", () => deleteFeedSource(source));
  actions.append(refreshButton, removeButton);
  article.append(copy, actions);
  return article;
}

function renderFeedState(feedState) {
  currentFeedState = feedState || { version: 2, trustedKeys: [], feeds: [], sources: [] };
  const keys = currentFeedState.trustedKeys || [];
  const feeds = currentFeedState.feeds || [];
  const sources = currentFeedState.sources || [];
  elements.feedSummaryCount.textContent = `${feeds.length} feed${feeds.length === 1 ? "" : "s"} · ${keys.length} key${keys.length === 1 ? "" : "s"} · ${sources.length} source${sources.length === 1 ? "" : "s"}`;
  elements.trustKeyEmpty.hidden = keys.length > 0;
  elements.signedFeedEmpty.hidden = feeds.length > 0;
  elements.trustKeyList.replaceChildren(...keys.map(createTrustKey));
  elements.signedFeedList.replaceChildren(...feeds.map(createSignedFeed));
  elements.sourceEmpty.hidden = sources.length > 0;
  elements.sourceList.replaceChildren(...sources.map(createFeedSource));
  elements.signedFeedInput.disabled = keys.length === 0;
  elements.signedFeedButton.disabled = keys.length === 0;
  elements.sourceUrlInput.disabled = keys.length === 0;
  elements.connectSourceButton.disabled = keys.length === 0;
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
  const shouldDelete = confirm(`Remove “${key.name}” and every signed feed or approved source that uses this key?`);
  if (!shouldDelete) return;

  try {
    const result = await callBackground({ type: "COMB_DELETE_TRUST_KEY", keyId: key.keyId });
    renderFeedState(result.state);
    setStatus(`Removed trust key “${key.name}”, its feeds, its sources, and unused origin access.`);
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
}

async function connectFeedSource(event) {
  event.preventDefault();
  let descriptor;
  let granted = false;
  try {
    descriptor = CombSourcePolicy.normalizeSourceUrl(elements.sourceUrlInput.value);
  } catch (error) {
    setStatus(error.message || String(error), true);
    return;
  }

  const originAlreadyConnected = (currentFeedState.sources || []).some(
    (source) => source.originPattern === descriptor.originPattern
  );
  try {
    const permissionRequest = chrome.permissions.request({ origins: [descriptor.originPattern] });
    granted = await permissionRequest;
    if (!granted) throw new Error("Chrome did not grant access to that feed origin.");
    renderFeedState(await callBackground({ type: "COMB_ADD_FEED_SOURCE", url: descriptor.url }));
    elements.sourceUrlInput.value = "";
    setStatus("Source approved, signature verified, and secure updates enabled about twice daily.");
  } catch (error) {
    if (granted && !originAlreadyConnected) {
      await chrome.permissions.remove({ origins: [descriptor.originPattern] }).catch(() => false);
    }
    setStatus(`Source connection failed: ${error.message || String(error)}`, true);
  }
}

async function refreshFeedSource(source) {
  try {
    renderFeedState(await callBackground({ type: "COMB_REFRESH_FEED_SOURCE", feedId: source.feedId }));
    setStatus(`Checked “${source.feedId}”; signer, identity, sequence, and schema verified.`);
  } catch (error) {
    await loadLibrary();
    setStatus(`Source check failed: ${error.message || String(error)}`, true);
  }
}

async function deleteFeedSource(source) {
  const shouldDelete = confirm(`Stop updates for “${source.feedId}” and remove access to its origin when unused? The last verified feed remains installed until you remove it.`);
  if (!shouldDelete) return;

  try {
    const result = await callBackground({ type: "COMB_DELETE_FEED_SOURCE", feedId: source.feedId });
    renderFeedState(result.state);
    setStatus(`Removed the approved source for “${source.feedId}”.`);
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
elements.importButton.addEventListener("click", () => elements.importInput.click());
elements.importInput.addEventListener("change", () => importLibrary(elements.importInput.files[0]));
elements.clearButton.addEventListener("click", clearLibrary);
elements.trustKeyButton.addEventListener("click", () => elements.trustKeyInput.click());
elements.trustKeyInput.addEventListener("change", () => importTrustKey(elements.trustKeyInput.files[0]));
elements.signedFeedButton.addEventListener("click", () => elements.signedFeedInput.click());
elements.signedFeedInput.addEventListener("change", () => importSignedFeed(elements.signedFeedInput.files[0]));
elements.sourceForm.addEventListener("submit", connectFeedSource);

loadLibrary();
