(function installCombRunner(root) {
  "use strict";

  if (root.__combRunnerInstalled) return;
  root.__combRunnerInstalled = true;

  let activeRun = null;

  function sendProgress(progress) {
    return chrome.runtime.sendMessage({
      type: "COMB_PROGRESS",
      progress
    }).catch(() => undefined);
  }

  function respondWithPromise(promise, sendResponse) {
    promise
      .then((result) => sendResponse(result))
      .catch((error) => {
        sendResponse({
          status: "error",
          error: String(error && error.message ? error.message : error).slice(0, 240),
          results: []
        });
      });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== "string") return false;

    if (message.type === "COMB_PING") {
      sendResponse({
        ready: Boolean(root.CombCheckout),
        version: root.CombCheckout ? root.CombCheckout.VERSION : null
      });
      return false;
    }

    if (!root.CombCheckout) {
      sendResponse({ status: "error", error: "Comb checkout engine is unavailable." });
      return false;
    }

    if (message.type === "COMB_SCAN") {
      sendResponse(root.CombCheckout.scanCheckout(document));
      return false;
    }

    if (message.type === "COMB_CANCEL") {
      if (activeRun) activeRun.cancelled = true;
      sendResponse({ cancelled: Boolean(activeRun) });
      return false;
    }

    if (message.type === "COMB_RUN") {
      if (activeRun) {
        sendResponse({
          status: "blocked",
          reason: "run_already_in_progress",
          results: []
        });
        return false;
      }

      activeRun = { cancelled: false };
      const runState = activeRun;
      const promise = root.CombCheckout
        .runCoupons(document, message.codes, {
          isCancelled: () => runState.cancelled,
          onProgress: (progress) => {
            sendProgress(progress);
          }
        })
        .finally(() => {
          if (activeRun === runState) activeRun = null;
        });

      respondWithPromise(promise, sendResponse);
      return true;
    }

    return false;
  });
})(globalThis);
