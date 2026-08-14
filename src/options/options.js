"use strict";

const elements = {
  merchantCount: document.querySelector("#merchantCount"),
  emptyState: document.querySelector("#emptyState"),
  merchantList: document.querySelector("#merchantList"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  clearButton: document.querySelector("#clearButton"),
  pageStatus: document.querySelector("#pageStatus")
};

let currentLibrary = { version: 1, merchants: {} };

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

async function loadLibrary() {
  try {
    renderLibrary(await callBackground({ type: "COMB_GET_LIBRARY" }));
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

loadLibrary();
