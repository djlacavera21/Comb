"use strict";

const SUBTOTAL = 125;
const SHIPPING = 7.95;
const discounts = {
  SAVE10: SUBTOTAL * 0.1,
  WELCOME20: 20,
  FREESHIP: SHIPPING
};

const elements = {
  form: document.querySelector("#promo-form"),
  input: document.querySelector("#promo-code"),
  apply: document.querySelector("#apply-coupon"),
  message: document.querySelector("#coupon-message"),
  applied: document.querySelector("#applied-coupon"),
  appliedCode: document.querySelector("#applied-code"),
  remove: document.querySelector("#remove-coupon"),
  discountRow: document.querySelector("#discount-row"),
  discountAmount: document.querySelector("#discount-amount"),
  total: document.querySelector("#order-total")
};

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function showMessage(text, tone) {
  elements.message.textContent = text;
  elements.message.className = `coupon-message ${tone}`;
  elements.message.hidden = false;
}

function clearCoupon(showConfirmation = true) {
  elements.input.value = "";
  elements.applied.hidden = true;
  elements.appliedCode.textContent = "";
  elements.discountRow.hidden = true;
  elements.discountAmount.textContent = "−$0.00";
  elements.total.textContent = money(SUBTOTAL + SHIPPING);

  if (showConfirmation) showMessage("Coupon removed. Order total restored.", "success");
  else elements.message.hidden = true;
}

function applyCoupon() {
  const code = elements.input.value.trim().toUpperCase();
  const discount = discounts[code];

  if (!discount) {
    showMessage("Coupon code is invalid or expired.", "error");
    return;
  }

  elements.input.value = code;
  elements.appliedCode.textContent = `${code} applied`;
  elements.applied.hidden = false;
  elements.discountRow.hidden = false;
  elements.discountAmount.textContent = `−${money(discount)}`;
  elements.total.textContent = money(SUBTOTAL + SHIPPING - discount);
  showMessage(`Coupon ${code} applied successfully. You saved ${money(discount)}.`, "success");
}

elements.apply.addEventListener("click", applyCoupon);
elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  applyCoupon();
});
elements.remove.addEventListener("click", () => clearCoupon(true));

clearCoupon(false);
