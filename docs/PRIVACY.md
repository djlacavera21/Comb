# Comb Privacy Policy and Data-Use Specification

Effective: August 14, 2026

Comb is an open-source browser extension with no Comb account, developer backend, analytics, advertising SDK, default feed, or checkout-outcome upload. The developer does not receive checkout data. Comb does, however, handle limited data on-device to test coupons. Browser-store disclosures must include that local handling; “local” does not mean “undisclosed.”

## Data handled on-device

The Chrome Web Store and Edge Add-ons submissions conservatively disclose these categories. Firefox metadata separately declares no collection and transmission of user data outside the extension; it does not erase the on-device handling described here.

| Store category | Exact scope | Purpose | Retention |
| --- | --- | --- | --- |
| **Financial and payment information** | The displayed payable amount and currency only. Comb does not access card, bank, payment-token, billing-address, or account fields. | Measure whether a coupon changed the amount displayed by the checkout. | Memory for the active run only. |
| **Web history** | The current merchant hostname when the user opens Comb. Comb does not request or read the browser history API or build a general history. | Scope a saved coupon list to the correct merchant. | Extension-local storage until the user deletes that merchant or all local data. |
| **Website content** | User-entered coupon tokens, visible coupon-control labels, coupon-specific status messages, and the displayed payable total. | Find coupon controls, test requested codes, verify removal, and report results. | Coupon tokens may remain in extension-local storage; checkout labels, messages, and totals remain in memory for the active run only. |

Comb also stores explicitly trusted public feed keys, verified signed coupon-feed envelopes, and any feed-source URL the user approves. Source records include the pinned feed ID and signer, granted origin, last-check and last-update times, and a short status or error. Signed-feed records contain publisher name, public-key fingerprint, feed identity and sequence, issue/expiry times, exact merchant hostnames, coupon tokens, verification timestamps, and publisher-provided aggregate success/failure counts. Private signing keys never enter the extension.

The community-catalog search in Comb settings operates only over those already verified local feed records. Search terms remain in the settings page for the current view, are not persisted as browsing history, and are not transmitted to Comb, a feed operator, or any third party. Active/expired filters, ranking, deduplication, and pagination all run in packaged extension code.

Messages between the checkout page, background runtime, and popup stay inside the browser extension. They contain coupon tokens under test, current merchant hostname, adapter name, a short coupon-related message, and numeric before/after totals.

## User-saved compatibility reports

The popup can create `comb.compatibility-report/v1` only after the user chooses **Save safe report**. The file is saved locally and is never uploaded by Comb. It contains the Comb version/timestamp, an allowlisted adapter and safe-stop reason, coarse detection booleans, the Creator Attribution Guarantee, and explicit non-disclosure flags.

The report generator builds a new allowlisted object. It does not redact or serialize the checkout scan. The output therefore excludes merchant hostname/URL, page content and selectors, coupon codes, amounts and currency values, cookies, affiliate/referral tags, and creator identifiers. Sharing the downloaded report through a public issue remains a separate user choice; [COMPATIBILITY.md](COMPATIBILITY.md) defines the public-report boundary.

## Data Comb deliberately does not access

Comb does not query payment instruments, address fields, identity fields, cart-item descriptions, merchant cookies, merchant local storage, browser history, or merchant network traffic. It requests no cookie, history, web-request interception, or required shopping-site permission. It never clicks purchase, payment, checkout, or place-order controls.

## Who receives data

| Recipient | What it receives |
| --- | --- |
| Comb developer | No checkout data, merchant history, coupon outcomes, identity, payment data, creator tags, or extension analytics. Comb has no service that accepts them. |
| Merchant checkout already open by the user | Coupon tokens entered through the merchant's existing visible coupon field, exactly as necessary to perform the requested test. |
| User-selected feed operator, only if the user connects a source | The requested public HTTPS path plus network-level information ordinarily visible to a server, such as request time, IP address, and common transport/browser headers. It receives no checkout URL, merchant history, coupon outcome, creator tag, identity, or payment data from Comb. |
| Any other third party | Nothing from Comb. Comb does not sell data, provide advertising audiences, or transfer data for unrelated purposes. |

## Optional feed-source requests

Network feed updates are disabled by default. If the user enters a public HTTPS feed URL and approves its exact origin in the browser permission prompt, Comb sends a `GET` request when the source is connected, when the user selects **Check now**, and approximately every 12 hours while the browser can run the scheduled task.

The request omits cookies and other credentials, supplies no referrer, rejects redirects, and accepts at most 2 MiB of UTF-8 JSON. The response remains inert data and must pass local public-key signature, schema, expiry, signer-pin, feed-ID, and rollback checks. A feed cannot contain JavaScript, DOM selectors, affiliate metadata, referral URLs, source URLs, or executable configuration. The user-selected feed operator is independent of Comb; users should connect only operators they trust.

## Creator attribution

The creator-tagging issue is fixed by design. Comb neither reads nor writes affiliate cookies, never changes a URL or referral query parameter, never opens a merchant referral tab, and has no Comb affiliate identity. Existing creator affiliate tags, referral parameters, and attribution cookies remain untouched so the original creator can keep proper attribution. See [ATTRIBUTION.md](ATTRIBUTION.md) and the executed regression record in [SECURITY_REVIEW.md](SECURITY_REVIEW.md).

## Permissions

- `activeTab`: temporary access to the current page only after the user invokes Comb.
- `alarms`: best-effort checks only for sources the user has already connected.
- `scripting`: inject the packaged checkout engine into the temporarily authorized page.
- `storage`: keep merchant coupon lists, trusted public keys, verified feeds, and approved-source settings on the device.
- optional `https://*/*`: allows an origin-specific runtime prompt for the public feed URL entered by the user. No origin is granted at installation, and Comb requests only the exact approved HTTPS origin.

The permission list and data boundary are identical in the Chrome-worker and Firefox-event-page environments. Firefox's `data_collection_permissions.required: ["none"]` means Comb does not collect and transmit user data to the developer or another recipient; the optional user-selected feed request and its ordinary server-visible network metadata remain disclosed above.

## User controls, retention, and deletion

Open Comb settings to export the local coupon library, delete one merchant, erase the entire library, remove a source, remove a signed feed, or remove a trusted key and the feeds/sources signed by it. Removing the final source on an origin asks the browser to remove that optional origin grant. Uninstalling Comb asks the browser to delete its extension-local storage under the browser's normal uninstall behavior.

Checkout labels, status messages, and totals are not intentionally persisted after a run. Local coupon lists, keys, feeds, sources, sequence history, and related settings remain until the user removes them or uninstalls the extension.

## Limited Use commitments

Comb's handling of user data is limited to its disclosed single purpose. The project commits that it will:

- not sell user data or transfer it outside approved uses necessary to provide the requested feature;
- not use or transfer user data for a purpose unrelated to local coupon testing and user-configured signed-feed updates;
- not use or transfer user data to determine creditworthiness or for lending;
- not use or transfer user data for personalized advertising; and
- not allow humans to read user data except at the user's affirmative request, for a specific security/abuse investigation, or where legally required.

Any future analytics, outcome reporting, affiliate model, account, or backend would require a separate public design, new consent where applicable, updated store disclosures and privacy policy, and review of the Creator Attribution Guarantee before implementation. It is not part of the current build.

## Security and policy changes

Comb's packaged-code validator blocks cookie, navigation, traffic-interception, remote-code, and purchase-click capabilities. Required continuous integration also exercises sanitized real-browser checkout and creator-attribution contracts. These controls reduce risk but are not a substitute for independent review.

Material policy changes will be versioned in the public repository before a corresponding extension release. Questions can be opened through the sanitized [checkout compatibility form](https://github.com/djlacavera21/Comb/issues/new?template=compatibility.yml). Do not include checkout URLs, screenshots, page source, cookies, codes, totals, payment details, addresses, affiliate IDs, creator identifiers, or order data in a public issue. Private vulnerability reporting is currently disabled; follow [../SECURITY.md](../SECURITY.md) to request a private channel without publishing details.
