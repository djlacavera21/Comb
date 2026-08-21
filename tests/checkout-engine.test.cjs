"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../src/content/checkout-engine.js");

function fakeElement(attributes = {}, options = {}) {
  const element = {
    hidden: false,
    disabled: false,
    nodeType: 1,
    tagName: options.tagName || "DIV",
    value: options.value || "",
    textContent: options.textContent || "",
    children: options.children || [],
    parentElement: options.parentElement || null,
    ownerDocument: { defaultView: null },
    classList: {
      contains(name) {
        return String(attributes.class || "").split(/\s+/).includes(name);
      }
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null;
    },
    closest(selector) {
      if (selector === "form") return options.form || null;
      return null;
    },
    contains(candidate) {
      return candidate === element;
    }
  };

  return element;
}

test("parseMoney handles common US and international formats", () => {
  assert.equal(engine.parseMoney("$1,234.56"), 1234.56);
  assert.equal(engine.parseMoney("EUR 1.234,56"), 1234.56);
  assert.equal(engine.parseMoney("1 234,50 €"), 1234.5);
  assert.equal(engine.parseMoney("¥1,234"), 1234);
  assert.equal(engine.parseMoney("£99"), 99);
  assert.equal(engine.parseMoney("₹1,23,456.78"), 123456.78);
  assert.equal(engine.parseMoney("CHF 1’234.50"), 1234.5);
  assert.equal(engine.parseMoney("AED ١٬٢٣٤٫٥٠"), 1234.5);
  assert.equal(engine.parseMoney("Ｒ＄ １２３,４５"), 123.45);
});

test("inferCurrency distinguishes regional dollar and international codes", () => {
  assert.equal(engine.inferCurrency("C$ 125.00"), "CAD");
  assert.equal(engine.inferCurrency("A$ 125.00"), "AUD");
  assert.equal(engine.inferCurrency("R$ 1.234,50"), "BRL");
  assert.equal(engine.inferCurrency("CHF 1’234.50"), "CHF");
  assert.equal(engine.inferCurrency("AED ١٬٢٣٤٫٥٠"), "AED");
  assert.equal(engine.inferCurrency("MX$1,999.90"), "MXN");
});

test("parseMoney favors a currency amount over an item count", () => {
  assert.equal(engine.parseMoney("Order total (3 items): $125.00"), 125);
});

test("parseMoney returns null when no amount exists", () => {
  assert.equal(engine.parseMoney("Calculated at checkout"), null);
  assert.equal(engine.parseMoney(null), null);
});

test("normalizeCodes preserves the first spelling and removes duplicates", () => {
  assert.deepEqual(
    engine.normalizeCodes(["save10", "SAVE10", " WELCOME20 ", "", "FREESHIP"]),
    ["save10", "WELCOME20", "FREESHIP"]
  );
});

test("normalizeCodes rejects links and non-token payloads", () => {
  assert.equal(engine.normalizeCode("https://merchant.example/deal"), null);
  assert.equal(engine.normalizeCode("SAVE 10"), null);
  assert.equal(engine.normalizeCode("<script>"), null);
  assert.equal(engine.normalizeCode("SAVE-10_percent"), "SAVE-10_percent");
});

test("normalizeCodes enforces the bounded run size", () => {
  const codes = Array.from({ length: 40 }, (_, index) => `CODE${index}`);
  assert.equal(engine.normalizeCodes(codes).length, engine.MAX_CODES);
});

test("calculateSavings rounds currency differences and never reports negative savings", () => {
  assert.equal(engine.calculateSavings(132.95, 112.95), 20);
  assert.equal(engine.calculateSavings(10, 8.333), 1.67);
  assert.equal(engine.calculateSavings(10, 12), 0);
  assert.equal(engine.calculateSavings(null, 5), null);
});

test("total matching rejects currency drift and tolerates cent-level rendering noise", () => {
  assert.equal(
    engine.totalsMatch({ amount: 100, currency: "USD" }, { amount: 100.01, currency: "USD" }),
    true
  );
  assert.equal(
    engine.totalsMatch({ amount: 100, currency: "USD" }, { amount: 100, currency: "EUR" }),
    false
  );
  assert.equal(
    engine.totalsMatch({ amount: 100, currency: "USD" }, { amount: 100, currency: null }),
    false
  );
  assert.equal(
    engine.totalsMatch({ amount: 100, currency: "USD" }, { amount: 99.95, currency: "USD" }),
    false
  );
});

test("coupon input scoring prefers explicit coupon semantics", () => {
  const coupon = fakeElement(
    { name: "coupon_code", placeholder: "Enter coupon" },
    { tagName: "INPUT" }
  );
  const giftCard = fakeElement(
    { name: "gift_card", placeholder: "Gift card" },
    { tagName: "INPUT" }
  );
  assert.ok(engine.scoreCouponInput(coupon) >= 20);
  assert.ok(engine.scoreCouponInput(coupon) > engine.scoreCouponInput(giftCard));
});

test("apply-button scoring rejects order submission controls", () => {
  const form = {
    parentElement: null,
    nodeType: 1,
    contains(candidate) {
      return candidate === applyButton || candidate === input;
    }
  };
  const input = fakeElement({ name: "coupon" }, { tagName: "INPUT", form, parentElement: form });
  const applyButton = fakeElement(
    { name: "apply_coupon" },
    { tagName: "BUTTON", textContent: "Apply coupon", form, parentElement: form }
  );
  const orderButton = fakeElement(
    { name: "place_order" },
    { tagName: "BUTTON", textContent: "Place order", form, parentElement: form }
  );
  const ambiguousContinueButton = fakeElement(
    { name: "continue" },
    { tagName: "BUTTON", textContent: "Continue", form, parentElement: form }
  );

  assert.ok(engine.scoreApplyButton(applyButton, input) >= 30);
  assert.equal(engine.scoreApplyButton(orderButton, input), -1000);
  assert.equal(engine.scoreApplyButton(ambiguousContinueButton, input), -1000);
});

test("Magento's scoped form marker outranks the overlapping WooCommerce coupon_code marker", () => {
  const form = fakeElement({ id: "discount-coupon-form" }, { tagName: "FORM" });
  const input = fakeElement(
    { id: "coupon_code", name: "coupon_code", placeholder: "Inserisci codice sconto" },
    { tagName: "INPUT", form, parentElement: form }
  );
  const applyButton = fakeElement(
    { class: "action apply primary" },
    { tagName: "BUTTON", textContent: "Applica sconto", form, parentElement: form }
  );
  const total = fakeElement(
    { class: "price" },
    { tagName: "SPAN", textContent: "€ 132,95" }
  );
  form.contains = (candidate) => candidate === form || candidate === input || candidate === applyButton;

  const selectors = new Map([
    ["form#discount-coupon-form", [form]],
    ["#discount-coupon-form input#coupon_code", [input]],
    ["#discount-coupon-form input[name='coupon_code']", [input]],
    ["#discount-coupon-form button.action.apply", [applyButton]],
    ["tr.grand.totals .price", [total]],
    ["input#coupon_code", [input]],
    ["input[name='coupon_code']", [input]]
  ]);
  const documentRef = {
    querySelectorAll(selector) {
      return selectors.get(selector) || [];
    }
  };

  const scan = engine.scanCheckout(documentRef);
  assert.equal(engine.ADAPTERS[0].id, "magento");
  assert.equal(scan.detected, true);
  assert.equal(scan.adapter, "magento");
  assert.equal(scan.adapterLabel, "Magento / Adobe Commerce");
  assert.equal(scan.total.amount, 132.95);
  assert.equal(scan.total.currency, "EUR");
});

test("Magento's localized Luma checkout form uses its scoped controls", () => {
  const form = fakeElement(
    { id: "discount-form", class: "form form-discount" },
    { tagName: "FORM" }
  );
  const input = fakeElement(
    { id: "discount-code", name: "discount_code", placeholder: "Saisissez le code de réduction" },
    { tagName: "INPUT", form, parentElement: form }
  );
  const applyButton = fakeElement(
    { class: "action action-apply" },
    { tagName: "BUTTON", textContent: "Appliquer la réduction", form, parentElement: form }
  );
  const total = fakeElement(
    { class: "price" },
    { tagName: "SPAN", textContent: "132,95 €" }
  );
  form.contains = (candidate) => candidate === form || candidate === input || candidate === applyButton;

  const selectors = new Map([
    ["form#discount-form.form-discount", [form]],
    ["#discount-form input#discount-code", [input]],
    ["#discount-form input[name='discount_code']", [input]],
    ["#discount-form button.action-apply", [applyButton]],
    ["tr.grand.totals .price", [total]]
  ]);
  const documentRef = {
    querySelectorAll(selector) {
      return selectors.get(selector) || [];
    }
  };

  const scan = engine.scanCheckout(documentRef);
  assert.equal(scan.detected, true);
  assert.equal(scan.adapter, "magento");
  assert.equal(scan.input.id, "discount-code");
  assert.equal(scan.applyButton.label, "Appliquer la réduction");
  assert.equal(scan.total.amount, 132.95);
  assert.equal(scan.total.currency, "EUR");
});

test("total scoring favors order total over subtotal and savings", () => {
  const total = fakeElement(
    { class: "order-total" },
    { textContent: "Order total $132.95" }
  );
  const subtotal = fakeElement(
    { class: "subtotal" },
    { textContent: "Subtotal $125.00" }
  );
  const savings = fakeElement(
    { class: "total-savings" },
    { textContent: "Total savings $20.00" }
  );
  const shipping = fakeElement(
    { class: "shipping-total" },
    { textContent: "Shipping AED 50.00" }
  );
  const tax = fakeElement(
    { class: "tax-total" },
    { textContent: "Tax CHF 4.95" }
  );

  assert.ok(engine.scoreTotalElement(total) > engine.scoreTotalElement(subtotal));
  assert.ok(engine.scoreTotalElement(total) > engine.scoreTotalElement(savings));
  assert.ok(engine.scoreTotalElement(total) > engine.scoreTotalElement(shipping));
  assert.ok(engine.scoreTotalElement(total) > engine.scoreTotalElement(tax));
});
