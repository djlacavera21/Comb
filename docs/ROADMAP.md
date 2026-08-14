# Comb Roadmap

## v0.1 — Local proof of value

- Manifest V3 Chrome/Edge extension.
- Temporary, user-initiated page access.
- Generic, WooCommerce, and Shopify-style checkout adapters.
- Sequential coupon testing, safe removal, best-code restoration.
- Per-merchant local code library and synthetic demo.
- Enforced zero-affiliate creator-attribution guarantee.

## v0.2 — Adapter reliability

- Fixture-driven adapter contract tests in a real browser.
- Additional adapters based on sanitized community fixtures.
- Better international money parsing and shipping-discount handling.
- Accessibility audit and keyboard-only run flow.
- Reproducible signed ZIP build with checksums.

## v0.3 — Community coupon data

- Signed, versioned, non-executable, affiliate-neutral coupon feed.
- Code provenance and freshness indicators.
- Optional anonymous outcome reporting with separate consent and data minimization.
- Abuse controls for poisoned or misleading submissions.

## v0.4 — Store release hardening

- Chrome Web Store and Edge Add-ons privacy disclosures.
- Automated end-to-end checkout fixture matrix.
- Localization and currency test corpus.
- Public security and creator-attribution review.

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
