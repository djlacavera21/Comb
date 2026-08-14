# Comb v0.6 reviewer notes

Comb has one purpose: test coupon-code tokens on the user-authorized active checkout and preserve the best measurable discount without changing creator affiliate attribution.

## Important creator-attribution fix

The creator-tagging issue is fixed by architecture. Comb has no affiliate identity and does not navigate, redirect, intercept requests, mutate URL query parameters, or read/write cookies. The popup keeps **Creator attribution protected** visible. Required CI runs a complete coupon transaction at a synthetic URL containing `affiliate_id=creator-42&utm_source=creator`, sets `creator_attribution=creator-42`, and asserts that the URL and cookie are byte-for-byte unchanged afterward.

## Permission review

- `activeTab`: checkout access begins only when the user opens Comb on the current tab.
- `scripting`: injects only packaged `src/content/checkout-engine.js` and `src/content/runner.js` into that temporary tab.
- `storage`: stores merchant-scoped coupon tokens, trusted public keys, verified signed feeds, and approved-source settings locally.
- `alarms`: checks only sources already connected by the user, approximately every 12 hours while the browser can run the task.
- optional `https://*/*`: declares the shape of runtime feed-origin grants. Comb requests only the exact public HTTPS origin derived from the URL the user enters; no site is granted at installation.

## Remote-code declaration

Select **No, I am not using remote code**. All executable JavaScript and CSS is inside the upload ZIP. An optional feed is bounded signed JSON with a strict coupon-code schema; it cannot contain code, selectors, source URLs, referral fields, or executable configuration.

## Data-use review

The privacy form should conservatively select **Financial and payment information**, **Web history**, and **Website content**, even though the relevant data is handled on-device:

- financial/payment: the visible payable amount and currency only, in memory during a run;
- web history: the current merchant hostname used to scope a locally saved list; Comb never reads the browser history API;
- website content: coupon tokens, coupon-control labels, coupon-specific messages, and the visible payable total.

The Comb developer receives none of that checkout data. The current merchant receives only the coupon token entered into its existing visible coupon field, as required for the requested test. If the user connects an optional feed URL, that user-selected operator can ordinarily observe the requested path, time, IP address, and common network headers. The request omits credentials and referrers and sends no checkout URL, merchant history, outcomes, creator tag, identity, or payment data.

## Privacy-safe compatibility report

The popup's **Save safe report** button creates a local `comb.compatibility-report/v1` JSON file only after a user gesture. Comb does not upload or transmit it. The generator constructs a fixed allowlisted object containing version/timestamp, adapter/reason enums, and detection booleans; it omits merchant URL/hostname, page text/selectors, codes, totals/currency values, cookies, affiliate/referral tags, and creator identifiers. Unit and required real-Chrome tests inject secret-looking values and fail if the serialized report contains them.

## Functional review path

1. Load the ZIP and pin Comb to the toolbar.
2. Open a checkout with a visible coupon field and payable total, then open Comb.
3. Confirm the popup shows the detected merchant/adapter and **Creator attribution protected**.
4. Enter coupon-code tokens and choose **Try codes**. Comb never clicks the checkout's purchase control.
5. Choose **Save safe report**, inspect the downloaded JSON, and confirm that it contains no merchant, total, code, page, cookie, or creator-tag value.
6. Open **Settings** to inspect/export/delete local lists or import an explicitly trusted public feed key.
7. To use the repository's sanitized checkout, clone the linked public source, run `npm run demo`, open `http://127.0.0.1:4173/demo/checkout.html`, and try `SAVE10`, `WELCOME20`, `FREESHIP`, and `NOTREAL`.

The runtime upload ZIP intentionally excludes demo/test files. Public evidence and exact commands are in `docs/SECURITY_REVIEW.md` and `docs/RELEASE.md`.
