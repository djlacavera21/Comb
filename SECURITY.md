# Security Policy

## Supported versions

Comb is pre-release software. Security fixes currently target the latest commit on `main`.

## Reporting a vulnerability

Do not include active checkout URLs, session cookies, payment details, addresses, affiliate IDs, or order data in a public report. Open a minimal sanitized GitHub issue for non-sensitive problems. For a vulnerability that cannot be described safely in public, use GitHub's private vulnerability reporting feature when it is enabled for this repository.

## Design constraints

- No remotely hosted executable code.
- No required host permissions in the v0.3 manifest and no install-time access to shopping sites.
- Optional feed-origin access is granted at runtime for one user-selected HTTPS origin and removed when its last source is removed.
- No cookie or traffic-interception permissions.
- No affiliate-link or attribution mutation.
- No order-submission automation.
- No collection of page contents, payment data, browsing history, or identities.
- Merchant codes remain in extension-local storage unless a user explicitly exports them.
- Community-feed JSON must verify against an explicitly imported P-256 public key before it becomes eligible for checkout use.
- Feed sequence numbers cannot move backward or reuse a sequence for different content.
- Approved sources are pinned to their first verified feed ID and signing key; downloads omit credentials and referrers, reject redirects, time out, and stop at 2 MiB.
- Network-source message handlers accept calls only from Comb's settings page, never from checkout content.
- Private feed-signing keys must never be committed to this repository; CI scans JSON artifacts for private EC material.
