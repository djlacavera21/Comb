# Comb Roadmap

## v0.1 — Local proof of value (shipped)

- Manifest V3 Chrome/Edge extension.
- Temporary, user-initiated page access.
- Generic, WooCommerce, and Shopify-style checkout adapters.
- Sequential coupon testing, safe removal, best-code restoration.
- Per-merchant local code library and synthetic demo.
- Enforced zero-affiliate creator-attribution guarantee.

## v0.2 — Signed community-feed foundation (shipped)

- Explicitly trusted ECDSA P-256 publisher keys.
- Signed, versioned, non-executable, affiliate-neutral coupon feeds.
- Strict code-only schema with expiry, size, lifetime, and exact-merchant limits.
- Rollback, same-sequence substitution, cross-publisher replacement, and tamper protection.
- Freshness and aggregate-outcome ranking, with manual offline import.

## v0.3 — Controlled signed-feed distribution (shipped)

- Optional feed retrieval only from an HTTPS origin the user explicitly approves at runtime.
- Credential-free, referrer-free, redirect-free, bounded JSON requests.
- Feed-ID and signer pinning across scheduled updates.
- Best-effort twice-daily checks plus manual **Check now**.
- Origin permission cleanup and expired-feed rollback-history retention.
- No remote executable code, default source, telemetry, affiliate tags, or outcome upload.

## v0.4 — Adapter reliability

- Fixture-driven adapter contract tests in a real browser.
- Additional adapters based on sanitized community fixtures.
- Better international money parsing and shipping-discount handling.
- Accessibility audit and keyboard-only run flow.
- Reproducible signed ZIP build with checksums.

## v0.5 — Store release hardening

- Chrome Web Store and Edge Add-ons privacy disclosures.
- Automated end-to-end checkout fixture matrix.
- Localization and currency test corpus.
- Public security and creator-attribution review.
- Any anonymous outcome reporting only after separate consent, minimization, and abuse-control design.

## v1.0 — Trustworthy shopping assistant

- Mature adapter coverage and rollback behavior.
- Searchable community coupon catalog.
- Price-history features only where provenance and consumer benefit can be verified.
- Firefox package where browser API behavior can meet the same safety boundary.

## Non-goals

- Selling browsing or purchase history.
- Replacing creator or publisher affiliate attribution.
- Quietly replacing merchant links with Comb referral redirects.
- Injecting ads into merchant pages.
- Automating payment, order placement, or account changes.
- Downloading or evaluating remote executable code.
