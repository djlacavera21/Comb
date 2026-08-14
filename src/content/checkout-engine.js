(function initCombCheckout(root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.CombCheckout = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createCombCheckout() {
  "use strict";

  const VERSION = "0.7.0";
  const MAX_CODES = 20;
  const MAX_CODE_LENGTH = 64;

  const SAFE_APPLY_TERMS = ["apply", "redeem", "use code", "add coupon", "add promo"];
  const DANGEROUS_ACTION_TERMS = [
    "place order",
    "submit order",
    "complete order",
    "confirm order",
    "pay now",
    "make payment",
    "buy now",
    "continue to payment",
    "continue checkout",
    "proceed to checkout"
  ];
  const COUPON_TERMS = ["coupon", "promo", "promotion", "discount", "voucher", "offer code"];
  const SUCCESS_TERMS = ["applied", "accepted", "success", "saved", "discount added", "coupon added"];
  const ERROR_TERMS = [
    "invalid",
    "expired",
    "not valid",
    "not available",
    "not applicable",
    "cannot be used",
    "can't be used",
    "already used",
    "minimum",
    "does not exist",
    "couldn't apply",
    "could not apply"
  ];

  const GENERIC_SELECTORS = Object.freeze({
    inputs: [
      "input[name*='coupon' i]",
      "input[id*='coupon' i]",
      "input[name*='promo' i]",
      "input[id*='promo' i]",
      "input[name*='discount' i]",
      "input[id*='discount' i]",
      "input[name*='voucher' i]",
      "input[id*='voucher' i]",
      "input[placeholder*='coupon' i]",
      "input[placeholder*='promo' i]",
      "input[placeholder*='discount' i]",
      "input[aria-label*='coupon' i]",
      "input[aria-label*='promo' i]",
      "input[aria-label*='discount' i]"
    ],
    applyButtons: [
      "button",
      "input[type='button']",
      "input[type='submit']",
      "[role='button']"
    ],
    totals: [
      "[data-testid*='grand-total' i]",
      "[data-testid*='order-total' i]",
      "[data-testid*='total-price' i]",
      "[data-testid='total']",
      "[data-test*='grand-total' i]",
      "[data-test*='order-total' i]",
      ".grand-total",
      ".order-total",
      "#grand-total",
      "#order-total",
      "[class*='grandTotal']",
      "[class*='orderTotal']",
      "[class*='total-price' i]",
      "[aria-label*='order total' i]",
      "[aria-label*='grand total' i]",
      "[class*='total' i]"
    ],
    removeButtons: [
      "a[href*='remove_coupon' i]",
      "button[name*='remove_coupon' i]",
      "[data-testid*='remove-discount' i]",
      "[data-testid*='remove-coupon' i]",
      ".cart-coupon-remove",
      ".remove-coupon",
      ".coupon-remove",
      ".woocommerce-remove-coupon"
    ],
    status: [
      "[role='alert']",
      "[aria-live='polite']",
      "[aria-live='assertive']",
      ".coupon-error",
      ".coupon-success",
      ".promo-error",
      ".promo-success",
      ".woocommerce-error",
      ".woocommerce-message",
      ".wc-block-components-validation-error",
      ".alertBox--error",
      ".alertBox--success",
      "[data-testid*='discount-error' i]",
      "[data-testid*='discount-message' i]"
    ]
  });

  const ADAPTERS = Object.freeze([
    Object.freeze({
      id: "woocommerce",
      label: "WooCommerce",
      markers: [
        "form.checkout_coupon",
        ".woocommerce-form-coupon",
        "form.wc-block-components-totals-coupon__form",
        ".wc-block-components-totals-coupon__input input",
        "input#coupon_code",
        "input[name='coupon_code']"
      ],
      inputs: [
        "input#coupon_code",
        "input[name='coupon_code']",
        ".wc-block-components-totals-coupon__input input"
      ],
      applyButtons: [
        "button[name='apply_coupon']",
        "input[name='apply_coupon']",
        ".checkout_coupon button[type='submit']",
        ".woocommerce-form-coupon button[type='submit']",
        ".wc-block-components-totals-coupon__form button[type='submit']"
      ],
      totals: [
        ".order-total .woocommerce-Price-amount",
        ".order-total .amount",
        "tr.order-total",
        ".wc-block-components-totals-footer-item .wc-block-formatted-money-amount"
      ],
      removeButtons: [
        ".woocommerce-remove-coupon",
        "a[href*='remove_coupon' i]",
        ".wc-block-components-chip__remove"
      ]
    }),
    Object.freeze({
      id: "bigcommerce",
      label: "BigCommerce",
      markers: [
        "form.coupon-form",
        "input#couponcode",
        "input[name='couponcode']",
        ".cart-coupon-list"
      ],
      inputs: ["input#couponcode", "input[name='couponcode']"],
      applyButtons: [
        ".coupon-form input[type='submit']",
        ".coupon-form button[type='submit']"
      ],
      totals: [
        ".cart-total-grandTotal .cart-total-amount",
        ".cart-total-grandTotal"
      ],
      removeButtons: [
        ".cart-coupon-remove",
        ".cart-coupon-item a[href*='coupon' i]"
      ]
    }),
    Object.freeze({
      id: "shopify",
      label: "Shopify-style",
      markers: [
        "input[name='reductions']",
        "input[name='discount']",
        "[data-discount-field]"
      ],
      inputs: [
        "input[name='reductions']",
        "input[name='discount']",
        "input[autocomplete='off'][placeholder*='discount' i]"
      ],
      applyButtons: [
        "button[data-testid*='discount' i]",
        "button[aria-label*='discount' i]",
        "[data-discount-field] button"
      ],
      totals: [
        "[data-checkout-payment-due-target]",
        "[data-testid='total-price']",
        "[data-testid*='total-price' i]",
        ".payment-due__price"
      ],
      removeButtons: [
        "button[data-testid*='remove-discount' i]",
        "button[aria-label*='remove discount' i]",
        "[data-reduction-form] button"
      ]
    }),
    Object.freeze({
      id: "generic",
      label: "Generic checkout",
      markers: [],
      inputs: [],
      applyButtons: [],
      totals: [],
      removeButtons: []
    })
  ]);

  function cleanText(value) {
    return String(value == null ? "" : value)
      .replace(/[\u00a0\u202f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeMoneyText(value) {
    return cleanText(value)
      .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
      .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
      .replace(/[\uff10-\uff19]/g, (digit) => String(digit.charCodeAt(0) - 0xff10))
      .replace(/\u066b/g, ".")
      .replace(/\u066c/g, ",");
  }

  function includesAny(value, terms) {
    const normalized = cleanText(value).toLowerCase();
    return terms.some((term) => normalized.includes(term));
  }

  function normalizeCode(value) {
    const code = cleanText(value);

    if (!code || code.length > MAX_CODE_LENGTH) {
      return null;
    }

    // Coupon tokens only. URLs and whitespace-bearing payloads are deliberately rejected.
    if (!/^[A-Za-z0-9][A-Za-z0-9._%+\-]*$/.test(code)) {
      return null;
    }

    return code;
  }

  function normalizeCodes(input, limit = MAX_CODES) {
    const source = Array.isArray(input)
      ? input
      : cleanText(input).split(/[\s,;]+/);
    const output = [];
    const seen = new Set();

    for (const value of source) {
      const code = normalizeCode(value);
      const key = code ? code.toLocaleUpperCase("en-US") : null;

      if (!code || seen.has(key)) {
        continue;
      }

      seen.add(key);
      output.push(code);

      if (output.length >= Math.max(1, Math.min(limit, MAX_CODES))) {
        break;
      }
    }

    return output;
  }

  function parseNumericToken(rawToken) {
    let token = normalizeMoneyText(rawToken).replace(/[\s'’]/g, "");
    const negative = token.startsWith("-");
    token = token.replace(/[^\d.,]/g, "");

    if (!token || !/\d/.test(token)) {
      return null;
    }

    const lastDot = token.lastIndexOf(".");
    const lastComma = token.lastIndexOf(",");
    let decimalSeparator = null;

    if (lastDot >= 0 && lastComma >= 0) {
      decimalSeparator = lastDot > lastComma ? "." : ",";
    } else {
      const separator = lastDot >= 0 ? "." : lastComma >= 0 ? "," : null;

      if (separator) {
        const index = token.lastIndexOf(separator);
        const trailingDigits = token.length - index - 1;
        const occurrences = token.split(separator).length - 1;

        if (trailingDigits > 0 && trailingDigits <= 2) {
          decimalSeparator = separator;
        } else if (occurrences > 1 && trailingDigits === 2) {
          decimalSeparator = separator;
        }
      }
    }

    let normalized;

    if (decimalSeparator) {
      const decimalIndex = token.lastIndexOf(decimalSeparator);
      const integerPart = token.slice(0, decimalIndex).replace(/[.,]/g, "");
      const fractionalPart = token.slice(decimalIndex + 1).replace(/[.,]/g, "");
      normalized = `${integerPart || "0"}.${fractionalPart}`;
    } else {
      normalized = token.replace(/[.,]/g, "");
    }

    const amount = Number(normalized);
    return Number.isFinite(amount) ? (negative ? -amount : amount) : null;
  }

  function parseMoney(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    const text = normalizeMoneyText(value);
    const matches = Array.from(text.matchAll(/-?\d[\d\s.,'’]*/g));

    if (!matches.length) {
      return null;
    }

    let best = null;

    for (const match of matches) {
      const amount = parseNumericToken(match[0]);

      if (amount == null) {
        continue;
      }

      const index = match.index || 0;
      const nearby = text.slice(Math.max(0, index - 5), index + match[0].length + 5);
      const hasCurrency = /[$€£¥₹₩₽₺₫₪₱฿]|\b(?:USD|EUR|GBP|CAD|AUD|NZD|JPY|CNY|RMB|INR|KRW|CHF|SEK|NOK|DKK|PLN|BRL|MXN|AED|SAR|TRY|VND)\b/i.test(nearby);
      const hasDecimals = /[.,]\d{2}(?:\D|$)/.test(match[0]);
      const score = (hasCurrency ? 10 : 0) + (hasDecimals ? 4 : 0) + index / 10000;

      if (!best || score > best.score) {
        best = { amount, score };
      }
    }

    return best ? best.amount : null;
  }

  function inferCurrency(value) {
    const text = normalizeMoneyText(value);

    if (/\bEUR\b|€/i.test(text)) return "EUR";
    if (/\bGBP\b|£/i.test(text)) return "GBP";
    if (/\bCAD\b|(?:CA|C)\$/i.test(text)) return "CAD";
    if (/\bAUD\b|(?:AU|A)\$/i.test(text)) return "AUD";
    if (/\bNZD\b|NZ\$/i.test(text)) return "NZD";
    if (/\bCNY\b|\bRMB\b|CN¥|元|人民币/i.test(text)) return "CNY";
    if (/\bJPY\b|JP¥|¥/i.test(text)) return "JPY";
    if (/\bINR\b|₹/i.test(text)) return "INR";
    if (/\bKRW\b|₩/i.test(text)) return "KRW";
    if (/\bCHF\b/i.test(text)) return "CHF";
    if (/\bSEK\b/i.test(text)) return "SEK";
    if (/\bNOK\b/i.test(text)) return "NOK";
    if (/\bDKK\b/i.test(text)) return "DKK";
    if (/\bPLN\b|zł/i.test(text)) return "PLN";
    if (/\bBRL\b|R\$/i.test(text)) return "BRL";
    if (/\bMXN\b|MX\$/i.test(text)) return "MXN";
    if (/\bAED\b/i.test(text)) return "AED";
    if (/\bSAR\b/i.test(text)) return "SAR";
    if (/\bTRY\b|₺/i.test(text)) return "TRY";
    if (/\bVND\b|₫/i.test(text)) return "VND";
    if (/\bUSD\b|\$/i.test(text)) return "USD";
    return null;
  }

  function calculateSavings(before, after) {
    if (!Number.isFinite(before) || !Number.isFinite(after)) {
      return null;
    }

    return Math.max(0, Math.round((before - after) * 100) / 100);
  }

  function totalsMatch(left, right, tolerance = 0.02) {
    if (!left || !right || !Number.isFinite(left.amount) || !Number.isFinite(right.amount)) {
      return false;
    }
    if (left.currency !== right.currency) return false;
    return Math.abs(left.amount - right.amount) <= tolerance;
  }

  function queryAll(documentRef, selectors) {
    const unique = new Set();

    for (const selector of selectors) {
      try {
        for (const element of documentRef.querySelectorAll(selector)) {
          unique.add(element);
        }
      } catch (_error) {
        // A merchant-specific selector should never prevent the generic adapter from running.
      }
    }

    return Array.from(unique);
  }

  function isVisible(element) {
    if (!element || element.hidden || element.getAttribute("aria-hidden") === "true") {
      return false;
    }

    if (element.disabled || element.getAttribute("disabled") != null) {
      return false;
    }

    const view = element.ownerDocument && element.ownerDocument.defaultView;

    if (view && typeof view.getComputedStyle === "function") {
      let node = element;

      while (node && node.nodeType === 1) {
        const style = view.getComputedStyle(node);

        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
          return false;
        }

        node = node.parentElement;
      }
    }

    return true;
  }

  function elementText(element) {
    if (!element) return "";

    const attributes = [
      element.getAttribute("id"),
      element.getAttribute("name"),
      element.getAttribute("placeholder"),
      element.getAttribute("aria-label"),
      element.getAttribute("data-testid"),
      element.getAttribute("data-test"),
      element.getAttribute("class"),
      element.value,
      element.textContent
    ];

    return cleanText(attributes.filter(Boolean).join(" "));
  }

  function scoreCouponInput(element) {
    if (!isVisible(element)) return -1000;

    const type = cleanText(element.getAttribute("type") || "text").toLowerCase();

    if (["hidden", "password", "email", "tel", "number", "checkbox", "radio"].includes(type)) {
      return -1000;
    }

    const descriptor = elementText(element).toLowerCase();
    let score = 0;

    for (const term of COUPON_TERMS) {
      if (descriptor.includes(term)) score += term === "coupon" ? 28 : 20;
    }

    if (descriptor.includes("gift card")) score -= 35;
    if (element.tagName === "INPUT") score += 8;
    if (element.closest("form")) score += 4;
    return score;
  }

  function ancestorDistance(first, second) {
    if (!first || !second) return 99;
    let node = first;

    for (let depth = 0; node && depth <= 6; depth += 1) {
      if (node === second || (typeof node.contains === "function" && node.contains(second))) {
        return depth;
      }
      node = node.parentElement;
    }

    return 99;
  }

  function scoreApplyButton(element, input) {
    if (!isVisible(element)) return -1000;

    const descriptor = elementText(element).toLowerCase();

    if (includesAny(descriptor, DANGEROUS_ACTION_TERMS)) {
      return -1000;
    }

    let score = 0;
    let semanticScore = 0;

    for (const term of SAFE_APPLY_TERMS) {
      if (descriptor.includes(term)) semanticScore += 34;
    }

    for (const term of COUPON_TERMS) {
      if (descriptor.includes(term)) semanticScore += 12;
    }

    // Proximity is never enough: the control itself must say Apply/Redeem or identify a coupon.
    if (semanticScore === 0) return -1000;
    score += semanticScore;

    if (descriptor.includes("remove") || descriptor.includes("delete")) score -= 80;

    const inputForm = input && input.closest("form");
    const buttonForm = element.closest("form");

    if (inputForm && inputForm === buttonForm) score += 45;

    const distance = ancestorDistance(input, element);
    if (distance <= 2) score += 24;
    else if (distance <= 4) score += 12;

    return score;
  }

  function scoreTotalElement(element) {
    if (!isVisible(element)) return -1000;

    const descriptor = elementText(element).toLowerCase();
    const amount = parseMoney(descriptor);

    if (amount == null) return -1000;

    let score = 0;
    if (descriptor.includes("grand total")) score += 90;
    if (descriptor.includes("order total")) score += 85;
    if (descriptor.includes("total due") || descriptor.includes("amount due")) score += 80;
    if (descriptor.includes("payment due") || descriptor.includes("payable")) score += 75;
    if (descriptor.includes("total")) score += 35;
    if (descriptor.includes("subtotal")) score -= 75;
    if (descriptor.includes("shipping")) score -= 55;
    if (descriptor.includes("tax")) score -= 55;
    if (descriptor.includes("discount") || descriptor.includes("savings")) score -= 60;
    if (descriptor.includes("item")) score -= 8;
    if (element.children && element.children.length > 6) score -= 20;
    return score;
  }

  function findAdapter(documentRef) {
    for (const adapter of ADAPTERS) {
      if (adapter.id === "generic") continue;

      if (queryAll(documentRef, adapter.markers).some(isVisible)) {
        return adapter;
      }
    }

    return ADAPTERS.find((adapter) => adapter.id === "generic");
  }

  function findBestCouponInput(documentRef, adapter) {
    const adapterCandidates = new Set(queryAll(documentRef, adapter.inputs));
    const candidates = queryAll(documentRef, [...adapter.inputs, ...GENERIC_SELECTORS.inputs]);
    return candidates
      .map((element) => {
        const score = scoreCouponInput(element);
        return {
          element,
          score: score <= -1000 ? score : score + (adapterCandidates.has(element) ? 70 : 0)
        };
      })
      .filter((candidate) => candidate.score >= 20)
      .sort((a, b) => b.score - a.score)[0]?.element || null;
  }

  function findBestApplyButton(documentRef, adapter, input) {
    if (!input) return null;

    const adapterCandidates = new Set(queryAll(documentRef, adapter.applyButtons));
    const candidates = queryAll(documentRef, [
      ...adapter.applyButtons,
      ...GENERIC_SELECTORS.applyButtons
    ]);

    return candidates
      .map((element) => {
        const score = scoreApplyButton(element, input);
        const descriptor = elementText(element).toLowerCase();
        const structurallyTrusted =
          adapterCandidates.has(element) &&
          isVisible(element) &&
          !includesAny(descriptor, DANGEROUS_ACTION_TERMS);
        return { element, score: structurallyTrusted ? Math.max(score, 80) : score };
      })
      .filter((candidate) => candidate.score >= 30)
      .sort((a, b) => b.score - a.score)[0]?.element || null;
  }

  function findBestTotalElement(documentRef, adapter) {
    const adapterCandidates = new Set(queryAll(documentRef, adapter.totals));
    const candidates = queryAll(documentRef, [...adapter.totals, ...GENERIC_SELECTORS.totals]);
    return candidates
      .map((element) => {
        const score = scoreTotalElement(element);
        const structurallyTrusted =
          adapterCandidates.has(element) &&
          isVisible(element) &&
          parseMoney(elementText(element)) != null;
        return { element, score: structurallyTrusted ? Math.max(score, 80) : score };
      })
      .filter((candidate) => candidate.score >= 20)
      .sort((a, b) => b.score - a.score)[0]?.element || null;
  }

  function readTotal(documentRef, adapter) {
    const element = findBestTotalElement(documentRef, adapter);
    const text = element ? cleanText(element.textContent || element.getAttribute("aria-label")) : "";
    return {
      amount: parseMoney(text),
      currency: inferCurrency(text),
      text: text.slice(0, 120)
    };
  }

  function isCouponScoped(element, text) {
    const descriptor = elementText(element).toLowerCase();
    return includesAny(descriptor, COUPON_TERMS) || includesAny(text, [...COUPON_TERMS, ...SUCCESS_TERMS, ...ERROR_TERMS]);
  }

  function readStatus(documentRef) {
    const messages = [];

    for (const element of queryAll(documentRef, GENERIC_SELECTORS.status)) {
      if (!isVisible(element)) continue;
      const text = cleanText(element.textContent || element.getAttribute("aria-label"));

      if (!text || !isCouponScoped(element, text)) continue;
      messages.push(text.slice(0, 180));
    }

    return Array.from(new Set(messages)).slice(-3);
  }

  function classifyStatus(messages) {
    const text = cleanText(messages.join(" ")).toLowerCase();

    if (includesAny(text, ERROR_TERMS)) return "rejected";
    if (includesAny(text, SUCCESS_TERMS)) return "accepted";
    return "unknown";
  }

  function findRemoveButton(documentRef, adapter) {
    const adapterCandidates = new Set(queryAll(documentRef, adapter.removeButtons));
    const candidates = queryAll(documentRef, [
      ...adapter.removeButtons,
      ...GENERIC_SELECTORS.removeButtons
    ]);

    return candidates.find((element) => {
      if (!isVisible(element)) return false;
      if (adapterCandidates.has(element)) return true;
      const descriptor = elementText(element).toLowerCase();
      return (
        descriptor.includes("coupon") ||
        descriptor.includes("discount") ||
        descriptor.includes("promo") ||
        descriptor.includes("remove_coupon") ||
        element.classList.contains("woocommerce-remove-coupon")
      );
    }) || null;
  }

  function countExistingCoupons(documentRef, adapter) {
    const candidates = queryAll(documentRef, [
      ...adapter.removeButtons,
      ...GENERIC_SELECTORS.removeButtons,
      ".applied-coupon",
      ".applied-discount",
      ".wc-block-components-chip",
      ".cart-coupon-item",
      "[data-testid*='applied-discount' i]"
    ]).filter(isVisible);

    return Math.min(candidates.length, 9);
  }

  function describeControl(element) {
    if (!element) return null;

    return {
      tag: cleanText(element.tagName).toLowerCase(),
      id: cleanText(element.getAttribute("id")).slice(0, 80) || null,
      name: cleanText(element.getAttribute("name")).slice(0, 80) || null,
      label: cleanText(
        element.getAttribute("aria-label") ||
          element.getAttribute("placeholder") ||
          element.textContent
      ).slice(0, 100) || null
    };
  }

  function scanCheckout(documentRef) {
    const adapter = findAdapter(documentRef);
    const input = findBestCouponInput(documentRef, adapter);
    const applyButton = findBestApplyButton(documentRef, adapter, input);
    const total = readTotal(documentRef, adapter);
    const existingCouponCount = countExistingCoupons(documentRef, adapter);

    return {
      engineVersion: VERSION,
      detected: Boolean(input && applyButton && Number.isFinite(total.amount)),
      adapter: adapter.id,
      adapterLabel: adapter.label,
      input: describeControl(input),
      applyButton: describeControl(applyButton),
      total,
      existingCouponCount,
      attribution: {
        protected: true,
        mode: "zero-affiliate"
      },
      reason: !input
        ? "coupon_input_not_found"
        : !applyButton
          ? "coupon_apply_button_not_found"
          : !Number.isFinite(total.amount)
            ? "payable_total_not_found"
            : null
    };
  }

  function setInputValue(element, value) {
    const documentRef = element.ownerDocument;
    const view = documentRef.defaultView;
    const prototype = Object.getPrototypeOf(element);
    const descriptor = prototype && Object.getOwnPropertyDescriptor(prototype, "value");

    if (descriptor && typeof descriptor.set === "function") {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    const EventConstructor = view && view.Event ? view.Event : Event;
    element.dispatchEvent(new EventConstructor("input", { bubbles: true }));
    element.dispatchEvent(new EventConstructor("change", { bubbles: true }));
  }

  function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  async function waitForCheckoutToSettle(documentRef, options = {}) {
    const minimumMs = Math.max(250, options.minimumMs || 900);
    const maximumMs = Math.max(minimumMs, options.maximumMs || 3500);
    const quietMs = Math.max(150, options.quietMs || 400);
    const startedAt = Date.now();
    let lastMutationAt = startedAt;
    const ViewMutationObserver = documentRef.defaultView && documentRef.defaultView.MutationObserver;
    const observer = ViewMutationObserver
      ? new ViewMutationObserver(() => {
          lastMutationAt = Date.now();
        })
      : null;

    if (observer && documentRef.body) {
      observer.observe(documentRef.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
    }

    try {
      while (Date.now() - startedAt < maximumMs) {
        await delay(100);
        const elapsed = Date.now() - startedAt;

        if (elapsed >= minimumMs && Date.now() - lastMutationAt >= quietMs) {
          break;
        }
      }
    } finally {
      if (observer) observer.disconnect();
    }
  }

  async function applyCode(documentRef, adapter, code, settleOptions) {
    const input = findBestCouponInput(documentRef, adapter);
    const applyButton = findBestApplyButton(documentRef, adapter, input);

    if (!input || !applyButton) {
      throw new Error("The checkout coupon controls changed during the run.");
    }

    const before = readTotal(documentRef, adapter);
    setInputValue(input, "");
    input.focus();
    setInputValue(input, code);
    applyButton.click();
    await waitForCheckoutToSettle(documentRef, settleOptions);

    const after = readTotal(documentRef, adapter);
    const messages = readStatus(documentRef);
    const messageStatus = classifyStatus(messages);
    const couponPresent = countExistingCoupons(documentRef, adapter) > 0;
    const currencyChanged = before.currency !== after.currency;
    const savings = currencyChanged ? null : calculateSavings(before.amount, after.amount);
    const accepted =
      couponPresent || currencyChanged || (savings != null && savings > 0) || messageStatus === "accepted";

    return {
      code,
      status: currencyChanged
        ? "currency_changed"
        : savings != null && savings > 0
        ? "working"
        : messageStatus === "rejected"
          ? "rejected"
          : accepted
            ? "accepted_unmeasured"
            : "unverified",
      accepted,
      beforeTotal: before.amount,
      afterTotal: after.amount,
      savings: savings || 0,
      currency: after.currency || before.currency,
      currencyChanged,
      couponPresent,
      message: messages[messages.length - 1] || null
    };
  }

  async function removeCoupon(documentRef, adapter, settleOptions, expectedTotal) {
    const removeButton = findRemoveButton(documentRef, adapter);

    if (!removeButton) {
      return {
        verified: false,
        couponPresent: countExistingCoupons(documentRef, adapter) > 0,
        total: readTotal(documentRef, adapter)
      };
    }

    removeButton.click();
    await waitForCheckoutToSettle(documentRef, settleOptions);
    const remainingCoupons = countExistingCoupons(documentRef, adapter);
    const restoredTotal = readTotal(documentRef, adapter);
    return {
      verified: remainingCoupons === 0 && totalsMatch(restoredTotal, expectedTotal),
      couponPresent: remainingCoupons > 0,
      total: restoredTotal
    };
  }

  async function runCoupons(documentRef, rawCodes, options = {}) {
    const codes = normalizeCodes(rawCodes);
    const initialScan = scanCheckout(documentRef);
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => {};
    const isCancelled = typeof options.isCancelled === "function" ? options.isCancelled : () => false;
    const settleOptions = options.settle || {};

    if (!initialScan.detected) {
      return {
        status: "blocked",
        reason: initialScan.reason,
        scan: initialScan,
        results: []
      };
    }

    if (initialScan.existingCouponCount > 0) {
      return {
        status: "blocked",
        reason: "existing_coupon_detected",
        scan: initialScan,
        results: []
      };
    }

    if (!codes.length) {
      return {
        status: "blocked",
        reason: "no_valid_codes",
        scan: initialScan,
        results: []
      };
    }

    const adapter = ADAPTERS.find((candidate) => candidate.id === initialScan.adapter) ||
      ADAPTERS.find((candidate) => candidate.id === "generic");
    const baseline = initialScan.total.amount;
    const baselineTotal = initialScan.total;
    const results = [];
    let best = null;
    let currentAppliedCode = null;
    let stoppedEarly = false;
    let cancelled = false;
    let restorationFailed = false;
    let stopReason = null;

    onProgress({ phase: "started", totalCodes: codes.length, baseline });

    for (let index = 0; index < codes.length; index += 1) {
      if (isCancelled()) {
        cancelled = true;
        break;
      }

      const code = codes[index];
      if (!totalsMatch(readTotal(documentRef, adapter), baselineTotal)) {
        stoppedEarly = true;
        stopReason = "checkout_total_changed_during_run";
        onProgress({ phase: "stopped", reason: stopReason, code });
        break;
      }
      onProgress({ phase: "testing", code, index: index + 1, totalCodes: codes.length });
      const attempt = await applyCode(documentRef, adapter, code, settleOptions);
      results.push(attempt);

      if (attempt.accepted) {
        currentAppliedCode = code;
      }

      if (attempt.status === "working" && (!best || attempt.savings > best.savings)) {
        best = attempt;
      }

      onProgress({
        phase: "tested",
        code,
        index: index + 1,
        totalCodes: codes.length,
        result: attempt
      });

      if (attempt.currencyChanged) {
        const removal = await removeCoupon(documentRef, adapter, settleOptions, baselineTotal);
        if (removal.verified || !removal.couponPresent) currentAppliedCode = null;
        stoppedEarly = true;
        stopReason = "checkout_total_changed_during_run";
        onProgress({ phase: "stopped", reason: stopReason, code });
        break;
      }

      const hasAnotherCode = index < codes.length - 1;

      if (attempt.accepted && hasAnotherCode) {
        const removal = await removeCoupon(documentRef, adapter, settleOptions, baselineTotal);

        if (!removal.verified) {
          if (!removal.couponPresent) currentAppliedCode = null;
          stoppedEarly = true;
          stopReason = "coupon_removal_unverified";
          onProgress({ phase: "stopped", reason: stopReason, code });
          break;
        }

        currentAppliedCode = null;
      }
    }

    const checkoutStateUnverified = Boolean(stopReason);

    if (!checkoutStateUnverified && best && currentAppliedCode !== best.code) {
      if (currentAppliedCode) {
        const removal = await removeCoupon(documentRef, adapter, settleOptions, baselineTotal);

        if (!removal.verified) {
          if (!removal.couponPresent) currentAppliedCode = null;
          stoppedEarly = true;
          restorationFailed = true;
          stopReason = "coupon_removal_unverified";
        } else {
          currentAppliedCode = null;
        }
      }

      if (!currentAppliedCode && !stopReason) {
        onProgress({ phase: "restoring", code: best.code });
        const restored = await applyCode(documentRef, adapter, best.code, settleOptions);

        if (restored.accepted) {
          currentAppliedCode = best.code;
        } else {
          restorationFailed = true;
        }
      }
    } else if (!checkoutStateUnverified && !best && currentAppliedCode) {
      const removal = await removeCoupon(documentRef, adapter, settleOptions, baselineTotal);
      if (removal.verified) {
        currentAppliedCode = null;
      } else {
        if (!removal.couponPresent) currentAppliedCode = null;
        stoppedEarly = true;
        stopReason = "coupon_removal_unverified";
      }
    }

    const finalTotal = readTotal(documentRef, adapter);
    const finalSavings = baselineTotal.currency !== finalTotal.currency
      ? 0
      : calculateSavings(baseline, finalTotal.amount) || 0;
    const bestApplied = Boolean(best && currentAppliedCode === best.code && finalSavings > 0);
    if (best && !bestApplied && !stopReason) restorationFailed = true;
    const status = cancelled
      ? "cancelled"
      : stoppedEarly
        ? bestApplied
          ? "partial"
          : restorationFailed
            ? "restore_failed"
            : "stopped"
        : bestApplied
          ? "complete"
          : best
            ? "restore_failed"
            : "no_savings";
    const output = {
      status,
      reason: stopReason || (restorationFailed ? "best_coupon_could_not_be_restored" : null),
      scan: initialScan,
      baseline,
      finalTotal: finalTotal.amount,
      currency: finalTotal.currency || initialScan.total.currency,
      finalSavings,
      tested: results.length,
      stoppedEarly,
      best: bestApplied
        ? {
            code: best.code,
            savings: best.savings,
            afterTotal: best.afterTotal,
            currency: best.currency
          }
        : null,
      bestCandidate: best && !bestApplied
        ? {
            code: best.code,
            savings: best.savings,
            afterTotal: best.afterTotal,
            currency: best.currency
          }
        : null,
      results
    };

    onProgress({ phase: "complete", result: output });
    return output;
  }

  return Object.freeze({
    VERSION,
    MAX_CODES,
    MAX_CODE_LENGTH,
    ADAPTERS,
    cleanText,
    normalizeCode,
    normalizeCodes,
    parseMoney,
    inferCurrency,
    calculateSavings,
    totalsMatch,
    scoreCouponInput,
    scoreApplyButton,
    scoreTotalElement,
    scanCheckout,
    runCoupons
  });
});
