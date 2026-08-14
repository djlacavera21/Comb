# Comb v0.2 Privacy Specification

## Data Comb stores

Comb stores coupon-code lists keyed by merchant hostname, explicitly trusted public feed keys, and manually imported signed coupon-feed envelopes. This data stays in the browser's extension-local storage. The options page can export or delete local lists and remove keys or feeds.

Signed-feed records contain only publisher name, public-key fingerprint, feed identity and sequence, issue/expiry times, exact merchant hostnames, coupon tokens, verification timestamps, and aggregate success/failure counts. Private signing keys never enter the extension.

## Data Comb reads temporarily

After the user clicks Comb, the checkout engine examines visible DOM metadata needed to identify:

- a coupon or promotion input;
- a coupon-specific apply or remove control;
- a displayed checkout total;
- a coupon-related success or error message.

It does not query payment fields, addresses, identity fields, cart item descriptions, cookies, local storage belonging to the merchant, or network traffic.

## Creator attribution

Comb neither reads nor writes affiliate cookies. It does not change referral parameters, URLs, navigation, or network requests and has no Comb affiliate identity. A creator's existing referral path is left untouched. See [ATTRIBUTION.md](ATTRIBUTION.md).

## Data Comb transmits

Nothing in v0.2. There is no Comb server, analytics SDK, advertising SDK, affiliate rewrite, error collector, automatic feed download, or outcome upload. Feed files are imported from the user's device and verified locally.

Messages between the checkout page, service worker, and popup remain inside the browser extension. They contain coupon codes under test, detected merchant hostname, adapter name, status text reduced to a short coupon-related message, and numeric before/after totals.

## Permissions

- `activeTab`: temporary access to the current page after the user invokes Comb.
- `scripting`: inject the packaged checkout engine into that temporarily authorized page.
- `storage`: keep the user's local merchant coupon lists, trusted public keys, and manually imported signed feeds.

Comb requests no permanent host patterns, cookie permission, traffic-interception permission, or browsing-history permission.

## Deletion and export

Open Comb's extension options to export the local coupon library, delete one merchant, erase the entire local library, remove a signed feed, or remove a trusted key and every feed signed by it.
