"use strict";

(function installFixture() {
  const input = document.querySelector("[data-fixture-input]");
  const apply = document.querySelector("[data-fixture-apply]");
  const form = input && input.closest("form");
  const total = document.querySelector("[data-fixture-total]");
  const status = document.querySelector("[data-fixture-status]");
  const applied = document.querySelector("[data-fixture-applied]");
  const appliedCode = document.querySelector("[data-fixture-applied-code]");
  const remove = document.querySelector("[data-fixture-remove]");
  const danger = document.querySelector("[data-fixture-danger]");
  const baseline = Number(document.body.dataset.baseline || 132.95);
  const shipping = Number(document.body.dataset.shipping || 7.95);
  const locale = document.body.dataset.locale || "en-US";
  const currency = document.body.dataset.currency || "USD";
  const currencyDisplay = document.body.dataset.currencyDisplay || "symbol";
  const removeFails = document.body.dataset.removeFails === "true";
  const removeLeavesTotal = document.body.dataset.removeLeavesTotal === "true";
  const currencyDrift = document.body.dataset.currencyDrift || null;
  const initialExistingCoupon = document.body.dataset.existingCoupon === "true";
  const initialExistingDiscount = Number(document.body.dataset.existingDiscount || 10);
  const discounts = {
    SAVE10: Math.round(baseline * 10) / 100,
    BEST20: 20,
    SHIPFREE: shipping
  };
  const state = {
    applyClicks: 0,
    removeClicks: 0,
    dangerClicks: 0,
    appliedCode: null
  };

  function money(value) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay
    }).format(value);
  }

  function setStatus(message) {
    if (!status) return;
    status.textContent = message;
    status.hidden = !message;
  }

  function renderCoupon(code, discount) {
    state.appliedCode = code;
    if (appliedCode) appliedCode.textContent = `${code} applied`;
    if (applied) applied.hidden = false;
    if (total) total.textContent = money(baseline - discount);
    setStatus(`Coupon ${code} applied successfully. You saved ${money(discount)}.`);
  }

  function clearCoupon() {
    state.removeClicks += 1;
    if (removeFails) {
      setStatus("Coupon removal failed. The discount remains active.");
      return;
    }

    state.appliedCode = null;
    if (input) input.value = "";
    if (appliedCode) appliedCode.textContent = "";
    if (applied) applied.hidden = true;
    if (!removeLeavesTotal && total) total.textContent = money(baseline);
    setStatus(removeLeavesTotal
      ? "Coupon marker removed, but total update is still pending."
      : "Coupon removed. Order total restored.");
  }

  function applyCoupon() {
    state.applyClicks += 1;
    const code = String(input && input.value || "").trim().toUpperCase();
    const discount = discounts[code];

    if (currencyDrift && state.applyClicks === 1) {
      if (total) {
        total.textContent = new Intl.NumberFormat(locale, {
          style: "currency",
          currency: currencyDrift,
          currencyDisplay
        }).format(baseline);
      }
      setStatus("Coupon could not be verified because the checkout currency changed.");
      return;
    }

    if (!discount) {
      setStatus("Coupon code is invalid or expired.");
      return;
    }

    renderCoupon(code, discount);
  }

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      applyCoupon();
    });
  }
  if (apply && (!form || String(apply.type).toLowerCase() !== "submit")) {
    apply.addEventListener("click", applyCoupon);
  }
  if (remove) {
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      clearCoupon();
    });
  }
  if (danger) {
    danger.addEventListener("click", () => {
      state.dangerClicks += 1;
    });
  }

  if (total) total.textContent = money(baseline);
  if (initialExistingCoupon) renderCoupon("ALREADY10", initialExistingDiscount);
  else {
    if (applied) applied.hidden = true;
    setStatus("");
  }

  globalThis.fixtureState = state;
})();
