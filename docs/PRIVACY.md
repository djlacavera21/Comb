# Comb v0.4 Privacy Specification

## Data Comb stores

Comb stores coupon-code lists keyed by merchant hostname, explicitly trusted public feed keys, signed coupon-feed envelopes, and any feed-source URL the user approves. Source records include the pinned feed ID and signer, origin grant, last-check and last-update times, and a short status or error. This data stays in the browser's extension-local storage. The options page can export or delete local lists and remove keys, feeds, or sources.

Signed-feed records contain only publisher name, public-key fingerprint, feed identity and sequence, issue/expiry times, exact merchant hostnames, coupon tokens, verification timestamps, and aggregate success/failure counts. Private signing keys never enter the extension.

## Data Comb reads temporarily

After the user clicks Comb, the checkout engine examines visible DOM metadata needed to identify:

- a coupon or promotion input;
- a coupon-specific apply or remove control;
- a displayed checkout total;
- a coupon-related success or error message.

It does not query payment fields, addresses, identity fields, cart item descriptions, cookies, local storage belonging to the merchant, or network traffic.

## Creator attribution

Comb neither reads nor writes affiliate cookies. It does not change referral parameters, URLs, navigation, or merchant requests and has no Comb affiliate identity. A creator's existing referral path is left untouched. See [ATTRIBUTION.md](ATTRIBUTION.md).

## Optional feed-source requests

By default, nothing is transmitted. Comb has no server, analytics SDK, advertising SDK, affiliate rewrite, error collector, default feed, or outcome upload.

If the user enters a public HTTPS feed URL and approves its origin in Chrome's permission prompt, Comb sends a `GET` request to that exact URL when the source is connected, when the user selects **Check now**, and approximately every 12 hours while the browser can run the scheduled task. The request:

- omits cookies and other credentials;
- supplies no referrer;
- rejects redirects;
- sends no checkout URL, merchant history, coupon outcomes, creator tags, identity, or payment data; and
- accepts at most 2 MiB of UTF-8 JSON before local signature and schema verification.

As with any network connection, the feed operator can ordinarily observe network-level information such as the request time, IP address, and common transport or browser headers. Comb does not add a user identifier.

Messages between the checkout page, service worker, and popup remain inside the browser extension. They contain coupon codes under test, detected merchant hostname, adapter name, status text reduced to a short coupon-related message, and numeric before/after totals.

The browser fixtures used in continuous integration are entirely synthetic. They run against invented local pages and contain no merchant session, account, purchase, creator, or checkout data.

## Permissions

- `activeTab`: temporary access to the current page after the user invokes Comb.
- `alarms`: run best-effort checks for sources the user has already connected.
- `scripting`: inject the packaged checkout engine into that temporarily authorized page.
- `storage`: keep the user's local merchant coupon lists, trusted public keys, signed feeds, and approved-source settings.
- optional `https://*/*`: allows Chrome to offer an origin-specific runtime prompt for a feed URL discovered from user input. No origin is granted at installation, and Comb requests only the exact HTTPS origin selected by the user.

Comb requests no required host patterns, shopping-site host access, cookie permission, traffic-interception permission, or browsing-history permission.

## Deletion and export

Open Comb's extension options to export the local coupon library, delete one merchant, erase the entire local library, remove a source, remove a signed feed, or remove a trusted key and every feed and source signed by it. Removing the final source on an origin asks Chrome to remove that optional origin grant; the last verified feed remains installed until separately removed or replaced.
