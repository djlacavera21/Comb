# Comb Architecture

## Goals

Comb's first release proves the difficult local loop: find the relevant checkout controls, test codes without clicking unrelated controls, measure the real price change, and leave the cart in the best recoverable state.

The MVP optimizes for inspectability and safe failure. It is dependency-free, uses ordinary JavaScript, and can be loaded directly from the repository.

## Components

### Popup

The popup is the only primary user interface. Opening it grants temporary `activeTab` access. It shows the detected adapter and total, accepts codes, streams progress, renders a result for every tested code, and keeps the creator-attribution guarantee visible.

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

No feed field can select DOM elements, execute logic, supply a URL, or change the Creator Attribution Guarantee. In v0.3, source URLs live in a separate local configuration guarded by `source-policy.js`; they never enter the feed schema or checkout engine.

### Approved-source updater

The options page validates a user-entered public HTTPS URL and invokes Chrome's runtime origin prompt directly from the submit gesture. Only after approval does the service worker retrieve the endpoint. Network source messages are rejected unless their sender is Comb's options page.

The updater sends a credential-free, referrer-free request with redirects disabled, a 15-second timeout, and a streaming 2 MiB ceiling. Returned bytes must decode as UTF-8 JSON and pass the existing trust-key, signature, strict-schema, expiry, signer-pin, feed-ID-pin, and monotonic-sequence checks. A packaged alarm performs the same check about every 12 hours. Browser sleep may delay it.

Expired feeds retain a verified sequence head for rollback detection but `selectCodesForMerchant` excludes their entries. Removing a source leaves its last verified feed installed, clears the alarm when no sources remain, and removes the now-unused origin grant.

All feed-state mutations share one serialized queue, so a scheduled refresh cannot race an import, trust-key removal, or source deletion into restoring stale state.

### Checkout engine

The checkout engine runs in Chrome's isolated content-script world. It has no network client and never receives payment or identity data. Its adapter pipeline is:

1. WooCommerce selectors;
2. Shopify-style selectors;
3. scored generic selectors.

An adapter must produce a coupon input and coupon-specific apply control. The total detector ranks visible price elements, strongly favoring grand/order totals and penalizing subtotal, tax, shipping, savings, and line-item labels.

### Coupon transaction

Each run treats the checkout as a recoverable transaction:

1. Refuse to start if an existing coupon is detected; the user must review and remove it manually before a run.
2. Record the baseline payable total.
3. Enter one normalized code and dispatch native input/change events.
4. Click only the selected coupon-apply control.
5. Wait for the page DOM to settle.
6. Compare the payable total and inspect coupon-scoped status messages.
7. Remove the tested coupon using a coupon-specific removal control.
8. Stop early if safe removal is unavailable.
9. Reapply the best verified code.

The engine never clicks buttons whose text indicates purchase, pay, order, checkout, or cart-item removal.

## Message protocol

| Message | Direction | Purpose |
| --- | --- | --- |
| `COMB_INIT` | Popup → worker | Inject scripts, scan checkout, merge local and eligible signed-feed codes |
| `COMB_RUN` | Popup → worker | Start one bounded coupon run |
| `COMB_CANCEL` | Popup → worker → page | Request cancellation between code attempts |
| `COMB_SCAN` | Worker → page | Return serializable checkout metadata |
| `COMB_PROGRESS` | Page → worker/UI | Report lifecycle progress without page contents |
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

| Risk | MVP control |
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
| Leaving a worse cart state | Per-attempt removal and best-code restoration |
| Ambiguous page controls | Minimum selector scores and conservative refusal |
| Oversized or hostile messages | Code length/count limits and plain serializable results |

## Feed boundary

Community feeds are signed data artifacts rather than executable configuration. Feed entries contain only exact merchant scope, code, observed outcome counts, and freshness. They cannot contain affiliate IDs, redirect URLs, DOM selectors, source URLs, or constraints expressed as logic. The full contract is in [FEED_SPEC.md](FEED_SPEC.md). Telemetry remains absent; any future reporting would require a separate consent and minimization design.
