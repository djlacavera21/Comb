# Security Policy

## Supported versions

Comb is pre-release software. Security fixes currently target the latest commit on `main`.

## Reporting a vulnerability

Do not include active checkout URLs, session cookies, payment details, addresses, affiliate IDs, or order data in a public report. Open a minimal sanitized GitHub issue for non-sensitive problems. For a vulnerability that cannot be described safely in public, use GitHub's private vulnerability reporting feature when it is enabled for this repository.

## Design constraints

- No remotely hosted executable code.
- No permanent host permissions in the v0.2 manifest.
- No cookie or traffic-interception permissions.
- No affiliate-link or attribution mutation.
- No order-submission automation.
- No collection of page contents, payment data, browsing history, or identities.
- Merchant codes remain in extension-local storage unless a user explicitly exports them.
- Community-feed JSON must verify against an explicitly imported P-256 public key before it becomes eligible for checkout use.
- Feed sequence numbers cannot move backward or reuse a sequence for different content.
- Private feed-signing keys must never be committed to this repository; CI scans JSON artifacts for private EC material.
