"use strict";

const elements = {
  storeHeading: document.querySelector("#storeHeading"),
  adapterBadge: document.querySelector("#adapterBadge"),
  totalRow: document.querySelector("#totalRow"),
  detectedTotal: document.querySelector("#detectedTotal"),
  statusText: document.querySelector("#statusText"),
  codesInput: document.querySelector("#codesInput"),
  sourceBadge: document.querySelector("#sourceBadge"),
  inputHelp: document.querySelector("#inputHelp"),
  runButton: document.querySelector("#runButton"),
  cancelButton: document.querySelector("#cancelButton"),
  progressCard: document.querySelector("#progressCard"),
  progressTitle: document.querySelector("#progressTitle"),
  progressCount: document.querySelector("#progressCount"),
  progressBar: document.querySelector("#progressBar"),
  progressDetail: document.querySelector("#progressDetail"),
  resultsSection: document.querySelector("#resultsSection"),
  resultSummary: document.querySelector("#resultSummary"),
  resultsList: document.querySelector("#resultsList"),
  optionsButton: document.querySelector("#optionsButton"),
  privacyButton: document.querySelector("#privacyButton")
};

const state = {
  tabId: null,
  hostname: null,
  scan: null,
  running: false,
  localCodeKeys: new Set(),
  communityCodeKeys: new Set()
};

function cleanText(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function setStatus(message, tone = "normal") {
  elements.statusText.textContent = message;
  elements.statusText.classList.toggle("status-error", tone === "error");
  elements.statusText.classList.toggle("status-warning", tone === "warning");
}

function formatMoney(amount, currency) {
  if (!Number.isFinite(amount)) return "—";

  try {
    if (currency) {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2
      }).format(amount);
    }
  } catch (_error) {
    // Fall through to a neutral amount when a merchant currency is unknown.
  }

  return amount.toFixed(2);
}

async function callBackground(message) {
  const response = await chrome.runtime.sendMessage(message);

  if (!response || response.ok !== true) {
    throw new Error(response && response.error ? response.error : "Comb did not receive a response.");
  }

  return response.result;
}

function validCodes() {
  const seen = new Set();
  const output = [];

  for (const raw of elements.codesInput.value.split(/[\s,;]+/)) {
    const code = cleanText(raw);
    const key = code.toLocaleUpperCase("en-US");

    if (!/^[A-Za-z0-9][A-Za-z0-9._%+\-]{0,63}$/.test(code) || seen.has(key)) continue;
    seen.add(key);
    output.push(code);
    if (output.length >= 20) break;
  }

  return output;
}

function refreshRunButton() {
  const blockedByExistingCoupon = Boolean(state.scan && state.scan.existingCouponCount > 0);
  elements.runButton.disabled =
    state.running ||
    !state.scan ||
    !state.scan.detected ||
    blockedByExistingCoupon ||
    validCodes().length === 0;
}

function reasonMessage(reason) {
  const messages = {
    coupon_input_not_found: "Open the store's coupon or promo section, then reopen Comb.",
    coupon_apply_button_not_found: "A coupon field was found, but its safe Apply control was ambiguous.",
    payable_total_not_found: "Comb could not identify one reliable payable total on this page.",
    existing_coupon_detected: "A coupon is already active. Remove it manually before testing other codes.",
    no_valid_codes: "Enter at least one coupon token. Links and spaces inside a code are not accepted.",
    run_already_in_progress: "A coupon run is already in progress.",
    stopped_to_preserve_checkout_state: "Comb stopped early because it could not safely reset the checkout.",
    best_coupon_could_not_be_restored: "A working code was found, but Comb could not verify that it was restored. Review the checkout manually."
  };

  return messages[reason] || "Comb could not safely complete this checkout test.";
}

function renderScan(data) {
  state.tabId = data.tabId;
  state.hostname = data.hostname;
  state.scan = data.scan;
  state.localCodeKeys = new Set(
    (data.localCodes || []).map((code) => code.toLocaleUpperCase("en-US"))
  );
  state.communityCodeKeys = new Set(
    (data.communityCodes || []).map((candidate) => candidate.code.toLocaleUpperCase("en-US"))
  );
  elements.storeHeading.textContent = data.hostname;
  elements.codesInput.value = (data.codes || []).join("\n");

  if (data.communityCodes && data.communityCodes.length) {
    const feedCount = new Set(data.communityCodes.map((candidate) => candidate.feedId)).size;
    elements.sourceBadge.textContent = `${data.communityCodes.length} signed`;
    elements.inputHelp.textContent =
      `Includes signature-verified codes from ${feedCount} trusted feed${feedCount === 1 ? "" : "s"}. Only your own codes are saved locally.`;
  } else {
    elements.sourceBadge.textContent = "20 max";
    elements.inputHelp.textContent = "Saved only in this browser for this merchant. URLs are rejected.";
  }

  if (data.scan && data.scan.adapterLabel) {
    elements.adapterBadge.textContent = data.scan.adapterLabel;
    elements.adapterBadge.hidden = false;
  }

  if (data.scan && Number.isFinite(data.scan.total && data.scan.total.amount)) {
    elements.detectedTotal.textContent = formatMoney(data.scan.total.amount, data.scan.total.currency);
    elements.totalRow.hidden = false;
  }

  if (!data.scan || !data.scan.detected) {
    elements.codesInput.disabled = true;
    setStatus(reasonMessage(data.scan && data.scan.reason), "warning");
  } else if (data.scan.existingCouponCount > 0) {
    elements.codesInput.disabled = true;
    setStatus("An existing coupon is active. Comb will not risk replacing it; remove it manually first.", "warning");
  } else {
    elements.codesInput.disabled = false;
    const signedCount = data.communityCodes ? data.communityCodes.length : 0;
    setStatus(
      signedCount
        ? `Checkout controls verified. ${signedCount} signature-verified community code${signedCount === 1 ? " is" : "s are"} ready.`
        : "Checkout controls verified. Comb will test only the coupon Apply control."
    );
  }

  refreshRunButton();
}

function setRunning(running) {
  state.running = running;
  elements.codesInput.disabled =
    running ||
    !state.scan ||
    !state.scan.detected ||
    state.scan.existingCouponCount > 0;
  elements.cancelButton.hidden = !running;
  elements.runButton.querySelector("span").textContent = running ? "…" : "⬡";
  elements.runButton.lastChild.textContent = running ? " Testing" : " Try codes";
  refreshRunButton();
}

function renderProgress(progress) {
  if (!progress) return;
  elements.progressCard.hidden = false;
  const current = Number.isInteger(progress.index) ? progress.index : 0;
  const total = Number.isInteger(progress.totalCodes) ? progress.totalCodes : 0;
  const percent = total > 0 ? Math.max(0, Math.min(100, (current / total) * 100)) : 4;
  elements.progressCount.textContent = `${current} / ${total}`;
  elements.progressBar.style.width = `${percent}%`;

  if (progress.phase === "testing") {
    elements.progressTitle.textContent = "Testing coupon";
    elements.progressDetail.textContent = `Trying ${progress.code} without touching creator attribution…`;
  } else if (progress.phase === "tested" && progress.result) {
    elements.progressTitle.textContent = progress.result.status === "working" ? "Discount verified" : "Code checked";
    elements.progressDetail.textContent = progress.result.status === "working"
      ? `${progress.code} saved ${formatMoney(progress.result.savings, progress.result.currency)}.`
      : `${progress.code}: ${progress.result.status.replaceAll("_", " ")}.`;
  } else if (progress.phase === "restoring") {
    elements.progressTitle.textContent = "Restoring best code";
    elements.progressDetail.textContent = `Reapplying ${progress.code}.`;
  } else if (progress.phase === "stopped") {
    elements.progressTitle.textContent = "Stopped safely";
    elements.progressDetail.textContent = "Comb could not remove the active test coupon, so it did not continue.";
  }
}

function appendResult(attempt) {
  const item = document.createElement("li");
  const code = document.createElement("span");
  const result = document.createElement("span");
  item.className = `result-${attempt.status}`;
  code.className = "result-code";
  result.className = "result-state";
  code.textContent = attempt.code;
  result.textContent = attempt.status === "working"
    ? `saved ${formatMoney(attempt.savings, attempt.currency)}`
    : attempt.status.replaceAll("_", " ");
  item.append(code, result);
  elements.resultsList.append(item);
}

function renderResult(result) {
  elements.progressCard.hidden = true;
  elements.resultsSection.hidden = false;
  elements.resultsList.replaceChildren();
  elements.resultSummary.replaceChildren();

  const headline = document.createElement("strong");
  const detail = document.createElement("span");

  if (result.status === "blocked") {
    headline.textContent = "No checkout changes made";
    detail.textContent = reasonMessage(result.reason);
    setStatus(detail.textContent, "warning");
  } else if (result.best) {
    if (state.scan) state.scan.existingCouponCount = 1;
    headline.textContent = `${result.best.code} saves ${formatMoney(result.finalSavings, result.currency)}`;
    detail.textContent = `Best code left applied. Final detected total: ${formatMoney(result.finalTotal, result.currency)}.`;
    setStatus("Best verified code applied. Review the checkout before placing the order.");
  } else if (result.status === "cancelled") {
    headline.textContent = "Coupon test cancelled";
    detail.textContent = "Comb stopped between attempts and restored the safest state it could verify.";
    setStatus("Run cancelled.", "warning");
  } else if (result.bestCandidate) {
    headline.textContent = `${result.bestCandidate.code} worked, but needs review`;
    detail.textContent = reasonMessage(result.reason);
    setStatus(detail.textContent, "warning");
  } else {
    headline.textContent = "No measured savings found";
    detail.textContent = result.reason ? reasonMessage(result.reason) : "No tested code lowered the detected payable total.";
    setStatus(detail.textContent, result.reason ? "warning" : "normal");
  }

  elements.resultSummary.append(headline, detail);
  for (const attempt of result.results || []) appendResult(attempt);
}

async function initialize() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab || !Number.isInteger(tab.id)) {
      throw new Error("Comb could not identify the active tab.");
    }

    const data = await callBackground({ type: "COMB_INIT", tabId: tab.id });
    renderScan(data);
  } catch (error) {
    elements.storeHeading.textContent = "Checkout unavailable";
    elements.codesInput.disabled = true;
    setStatus(cleanText(error.message || error), "error");
    refreshRunButton();
  }
}

async function startRun() {
  const codes = validCodes();
  if (!codes.length || state.running) return;
  const localCodes = codes.filter((code) => {
    const key = code.toLocaleUpperCase("en-US");
    return state.localCodeKeys.has(key) || !state.communityCodeKeys.has(key);
  });

  setRunning(true);
  elements.resultsSection.hidden = true;
  renderProgress({ phase: "started", totalCodes: codes.length, index: 0 });

  try {
    const result = await callBackground({
      type: "COMB_RUN",
      tabId: state.tabId,
      codes,
      localCodes,
      saveCodes: true
    });
    renderResult(result);
  } catch (error) {
    elements.progressCard.hidden = true;
    setStatus(cleanText(error.message || error), "error");
  } finally {
    setRunning(false);
  }
}

async function cancelRun() {
  if (!state.running) return;
  elements.cancelButton.disabled = true;
  setStatus("Cancellation requested. Comb will stop between coupon attempts.", "warning");

  try {
    await callBackground({ type: "COMB_CANCEL", tabId: state.tabId });
  } catch (error) {
    setStatus(cleanText(error.message || error), "error");
  } finally {
    elements.cancelButton.disabled = false;
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (
    message &&
    message.type === "COMB_PROGRESS_UPDATE" &&
    message.tabId === state.tabId
  ) {
    renderProgress(message.progress);
  }
});

elements.codesInput.addEventListener("input", refreshRunButton);
elements.runButton.addEventListener("click", startRun);
elements.cancelButton.addEventListener("click", cancelRun);
elements.optionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
elements.privacyButton.addEventListener("click", () => chrome.runtime.openOptionsPage());

initialize();
