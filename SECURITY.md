# Security Policy

## Supported versions

Comb is pre-release software. Security fixes currently target the latest commit on `main`.

## Reporting a vulnerability

Do not include active checkout URLs, session cookies, payment details, addresses, affiliate IDs, or order data in a public report. Open a minimal sanitized GitHub issue for non-sensitive problems. For a vulnerability that cannot be described safely in public, use GitHub's private vulnerability reporting feature when it is enabled for this repository.

## Design constraints

- No remotely hosted executable code.
- No permanent host permissions in the v0.1 manifest.
- No cookie or traffic-interception permissions.
- No affiliate-link or attribution mutation.
- No order-submission automation.
- No collection of page contents, payment data, browsing history, or identities.
- Merchant codes remain in extension-local storage unless a user explicitly exports them.
