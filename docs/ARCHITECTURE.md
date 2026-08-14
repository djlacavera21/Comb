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

No feed field can select DOM elements, execute logic, supply a URL, or change the Creator Attribution Guarantee. v0.2 performs no automatic feed request.

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

## Threat boundaries

| Risk | MVP control |
| --- | --- |
| Persistent observation of browsing | `activeTab`; no `host_permissions` |
| Creator commission diversion | Zero-affiliate design; no cookie/navigation/traffic APIs |
| Poisoned community codes | Explicit trust keys, signatures, strict schema, expiry, evidence scoring |
| Feed rollback/substitution | Monotonic sequence and payload-hash checks |
| Remote-code supply chain | No dependencies or remote executable code |
| Accidental purchase | Purchase/payment verbs are excluded; no order API exists |
| Replacing a pre-existing deal | Existing-coupon gate and explicit override |
| Leaving a worse cart state | Per-attempt removal and best-code restoration |
| Ambiguous page controls | Minimum selector scores and conservative refusal |
| Oversized or hostile messages | Code length/count limits and plain serializable results |

## Feed boundary

Community feeds are signed data artifacts rather than executable configuration. Feed entries contain only exact merchant scope, code, observed outcome counts, and freshness. They cannot contain affiliate IDs, redirect URLs, DOM selectors, or constraints expressed as logic. The full contract is in [FEED_SPEC.md](FEED_SPEC.md). Telemetry remains absent; any future reporting would require a separate consent and minimization design.
