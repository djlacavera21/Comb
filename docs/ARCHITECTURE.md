# Comb Architecture

## Goals

Comb proves the difficult local loop: find the relevant checkout controls, test codes without clicking unrelated controls, measure the real price change, and leave the cart in the best recoverable state.

The v0.7 build optimizes for inspectability, safe failure, privacy-safe support intake, independently reproducible evidence, and a controlled browser-store handoff. It is dependency-free, uses ordinary JavaScript, and can be loaded directly from the repository.

## Components

### Popup

The popup is the only primary user interface. Opening it grants temporary `activeTab` access. It shows the detected adapter and total, accepts codes, streams progress, renders a result for every tested code, keeps the creator-attribution guarantee visible, and can save an allowlisted compatibility report locally after a user gesture.

### Service worker

The Manifest V3 service worker is the trust boundary between extension UI and checkout page. It:

- validates and normalizes messages;
- injects the packaged content scripts after a user gesture;
- reads and writes per-merchant codes in local extension storage;
- forwards bounded coupon jobs to the active tab;
- returns progress and final results.

It has no API for navigation, cookies, affiliate tags, page requests, or order submission.

### Signed-feed verifier

The service worker loads a packaged verifier that treats community feeds as inert data. A feed becomes eligible only after its ECDSA P-256 signature verifies against a public key the user explicitly imported. Strict schema validation then checks expiry, exact merchant scope, code-token syntax, outcome counts, duplicate entries, and lifetime limits. Sequence numbers provide rollback and substitution resistance.

No feed field can select DOM elements, execute logic, supply a URL, or change the Creator Attribution Guarantee. Source URLs live in a separate local configuration guarded by `source-policy.js`; they never enter the feed schema or checkout engine.

### Approved-source updater

The options page validates a user-entered public HTTPS URL and invokes Chrome's runtime origin prompt directly from the submit gesture. Only after approval does the service worker retrieve the endpoint. Network source messages are rejected unless their sender is Comb's options page.

The updater sends a credential-free, referrer-free request with redirects disabled, a 15-second timeout, and a streaming 2 MiB ceiling. Returned bytes must decode as UTF-8 JSON and pass the existing trust-key, signature, strict-schema, expiry, signer-pin, feed-ID-pin, and monotonic-sequence checks. A packaged alarm performs the same check about every 12 hours. Browser sleep may delay it.

Expired feeds retain a verified sequence head for rollback detection but `selectCodesForMerchant` excludes their entries. Removing a source leaves its last verified feed installed, clears the alarm when no sources remain, and removes the now-unused origin grant.

All feed-state mutations share one serialized queue, so a scheduled refresh cannot race an import, trust-key removal, or source deletion into restoring stale state.

### Checkout engine

The checkout engine runs in Chrome's isolated content-script world. It has no network client and never reads payment credentials, address fields, or identity data; it handles only the displayed payable amount/currency and coupon-specific UI needed for the run. Its adapter pipeline is:

1. WooCommerce classic and Blocks selectors;
2. BigCommerce Cornerstone selectors derived from its public templates;
3. Shopify-style selectors;
4. scored generic selectors.

An adapter must produce a coupon input and coupon-specific apply control. Known platform selectors can establish structural trust for localized controls only inside narrowly scoped coupon forms; the generic adapter still requires explicit coupon/apply semantics. The total detector ranks visible price elements, strongly favoring grand/order totals and penalizing subtotal, tax, shipping, savings, and line-item labels.

Money parsing normalizes regional grouping and decimal separators plus Arabic, Persian, and full-width digits. It recognizes a broader ISO/symbol set, but any detected currency change during a transaction invalidates the comparison and causes a safe stop.

### Coupon transaction

Each run treats the checkout as a recoverable transaction:

1. Refuse to start if an existing coupon is detected; the user must review and remove it manually before a run.
2. Record the baseline payable total.
3. Enter one normalized code and dispatch native input/change events.
4. Click only the selected coupon-apply control.
5. Wait for the page DOM to settle.
6. Compare the payable total and inspect coupon-scoped status messages.
7. Remove the tested coupon using a coupon-specific removal control.
8. Verify that all coupon markers disappeared and the payable amount/currency returned to the baseline within a two-cent rendering tolerance.
9. Stop before another attempt if removal, baseline restoration, or currency stability cannot be proven.
10. Reapply the best measured code and verify its final savings against the original baseline.

The engine never clicks buttons whose text indicates purchase, pay, order, checkout, or cart-item removal.

Accepted but unmeasured shipping discounts are reported but not ranked as the winner. Comb removes them before continuing unless the final payable total proves a savings amount.

### Browser contracts

`scripts/run-browser-fixtures.js` starts a local-only fixture server and drives headless Chrome directly through the Chrome DevTools Protocol, without an automation dependency. `tests/fixtures/support-matrix.json` is the versioned source of fixture expectations; validation requires every synthetic HTML fixture exactly once and allows only the creator-tagged generic fixture to own URL/cookie preservation. Sanitized contracts cover WooCommerce classic/Blocks, two Shopify-style variants, BigCommerce Cornerstone, generic and RTL detection, MXN/EUR/CHF/AED/USD totals, separate subtotal/tax/shipping rows, ambiguous-control refusal, the existing-coupon gate, failed-removal no-stacking behavior, creator URL/cookie preservation, safe-report non-disclosure, popup tab order, accessible control names, progress semantics, and settings file-import controls. CI passes `--require-browser`; a missing browser is therefore a failure rather than a skip.

### Release package

`scripts/build-release.js` uses a deterministic, stored-entry ZIP writer implemented with Node built-ins. It sorts the exact runtime file list, normalizes every entry timestamp to `SOURCE_DATE_EPOCH` or the Git commit time, fixes file modes, writes no platform-specific extras, builds twice, and emits a SHA-256 sidecar. The manifest stays at the archive root.

`scripts/validate-store.js` separately binds copy-ready Chrome/Edge metadata to the manifest, exact permission explanations, conservative on-device data categories, Limited Use commitments, safe-report disclosure, creator-attribution evidence, description/search limits, and PNG dimensions. `scripts/build-store-package.js` runs both validation boundaries and places the runtime ZIP plus listing copy, assets, privacy policy, machine support matrix, independent-review guide, support evidence, and public review in a second deterministic reviewer kit. Required CI uploads both archives and sidecars.

Publication uses a separate manual `workflow_dispatch` workflow. It checks out the supplied full SHA, requires it to equal current `origin/main`, validates every product version, rejects existing tags, reruns lint/unit/real-Chrome/build gates, verifies the exact artifact checksums, and creates `vX.Y.Z` plus a GitHub release only after an explicit creator-attribution authorization. Browser-store dashboard submission remains a maintainer account action and supplies the installable extension signature.

## Message protocol

| Message | Direction | Purpose |
| --- | --- | --- |
| `COMB_INIT` | Popup → worker | Inject scripts, scan checkout, merge local and eligible signed-feed codes |
| `COMB_RUN` | Popup → worker | Start one bounded coupon run |
| `COMB_CANCEL` | Popup → worker → page | Request cancellation between code attempts |
| `COMB_SCAN` | Worker → page | Return serializable checkout metadata |
| `COMB_PROGRESS` | Page → worker/UI | Report bounded coupon lifecycle/results without arbitrary page content |
| `COMB_GET_LIBRARY` | Options → worker | Read local merchant-code records |
| `COMB_REPLACE_LIBRARY` | Options → worker | Import a validated local library |
| `COMB_GET_FEED_STATE` | Options → worker | List trusted keys and installed feed metadata |
| `COMB_IMPORT_TRUST_KEY` | Options → worker | Fingerprint and add an explicit public trust anchor |
| `COMB_IMPORT_SIGNED_FEED` | Options → worker | Verify and install a bounded signed coupon feed |
| `COMB_DELETE_TRUST_KEY` | Options → worker | Remove a key and cascade-delete feeds signed by it |
| `COMB_DELETE_SIGNED_FEED` | Options → worker | Remove one installed feed |
| `COMB_ADD_FEED_SOURCE` | Options → worker | Retrieve, verify, pin, and schedule one approved HTTPS source |
| `COMB_REFRESH_FEED_SOURCE` | Options → worker | Check one pinned source through the same bounded verifier |
| `COMB_DELETE_FEED_SOURCE` | Options → worker | Stop updates and remove an unused origin grant |

## Threat boundaries

| Risk | Release control |
| --- | --- |
| Persistent observation of browsing | `activeTab`; no `host_permissions` |
| Creator commission diversion | Zero-affiliate design; no cookie/navigation/traffic APIs |
| Poisoned community codes | Explicit trust keys, signatures, strict schema, expiry, evidence scoring |
| Feed rollback/substitution | Monotonic sequence and payload-hash checks |
| Source endpoint compromise | Signer/feed pinning, signature verification, expiry, exact schema, size/time limits |
| Cross-origin request abuse | Options-page-only messages and runtime-granted HTTPS origin |
| Redirect or credential leakage | Redirect errors, `credentials: omit`, no referrer, no query-token URLs |
| Remote-code supply chain | No dependencies or remote executable code |
| Accidental purchase | Purchase/payment verbs are excluded; no order API exists |
| Replacing a pre-existing deal | Existing-coupon gate and explicit override |
| Leaving a worse cart state | Coupon-marker disappearance plus baseline amount/currency restoration before the next attempt |
| Ambiguous page controls | Minimum selector scores and conservative refusal |
| Localized structural mis-selection | Platform-specific selectors only, backed by sanitized real-browser contracts |
| False cross-currency savings | Currency drift invalidates the comparison and stops the run |
| Oversized or hostile messages | Code length/count limits and plain serializable results |

## Feed boundary

Community feeds are signed data artifacts rather than executable configuration. Feed entries contain only exact merchant scope, code, observed outcome counts, and freshness. They cannot contain affiliate IDs, redirect URLs, DOM selectors, source URLs, or constraints expressed as logic. The full contract is in [FEED_SPEC.md](FEED_SPEC.md). Telemetry remains absent; any future reporting would require a separate consent and minimization design.
