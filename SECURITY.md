# Security Policy

## Supported versions

Comb is pre-release software. Security fixes currently target the latest commit on `main`.

## Reporting a vulnerability

Do not include active checkout URLs, hostnames, screenshots, page source, session cookies, coupon codes, totals, payment details, addresses, affiliate IDs, creator identifiers, or order data in a public report. Use Comb's generated safe-report workflow for non-sensitive compatibility problems.

GitHub private vulnerability reporting is not currently enabled for this repository. If a vulnerability cannot be described safely in public, open a sanitized issue containing only the title **Private security channel requested** and no vulnerability or checkout details. The maintainer must enable or create an appropriate private channel before requesting further information. Never send sensitive material until that channel exists.

## Design constraints

- No remotely hosted executable code.
- No required host permissions in the v0.6 manifest and no install-time access to shopping sites.
- Optional feed-origin access is granted at runtime for one user-selected HTTPS origin and removed when its last source is removed.
- No cookie or traffic-interception permissions.
- No affiliate-link or attribution mutation.
- No order-submission automation.
- No developer receipt or broad persistence of page content; only coupon controls/messages and the displayed payable amount/currency are handled locally for the active run.
- No payment credentials, address/identity fields, browser-history API access, or general browsing-history log.
- Merchant codes remain in extension-local storage unless a user explicitly exports them.
- Community-feed JSON must verify against an explicitly imported P-256 public key before it becomes eligible for checkout use.
- Feed sequence numbers cannot move backward or reuse a sequence for different content.
- Approved sources are pinned to their first verified feed ID and signing key; downloads omit credentials and referrers, reject redirects, time out, and stop at 2 MiB.
- Network-source message handlers accept calls only from Comb's settings page, never from checkout content.
- Compatibility reports are user-triggered local downloads constructed from fixed allowlists; no automatic upload, URL/hostname, page content/selectors, codes, totals/currencies, cookies, or creator tags.
- A coupon removal is successful only when coupon markers disappear and the original total and currency return; otherwise the run stops before another code can stack.
- Currency or unexplained payable-total drift between attempts stops the transaction instead of producing a false savings comparison.
- CI drives sanitized checkout, creator-attribution preservation, and keyboard contracts in a real Chrome process and builds both the runtime ZIP and reviewer kit twice before publication.
- Private feed-signing keys must never be committed to this repository; CI scans JSON artifacts for private EC material.
