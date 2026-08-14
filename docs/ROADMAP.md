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

## v0.4 — Adapter reliability (shipped)

- Required headless-Chrome contracts for WooCommerce Blocks, BigCommerce Cornerstone, Shopify-style, and generic fixtures.
- Browser safety contracts for ambiguous controls, existing coupons, failed removal, no stacking, and untouched purchase controls.
- Verified coupon removal: coupon markers must disappear and the original payable amount/currency must return before another attempt.
- Regional money parsing for broader currencies, separator styles, and Arabic, Persian, and full-width digits.
- Keyboard-visible native controls, announced progress, result focus management, and reduced-motion support.
- Reproducible Chrome Web Store upload ZIP with a SHA-256 checksum and CI artifact.

## v0.5 — Store release hardening (shipped)

- Validated Chrome Web Store and Edge Add-ons privacy disclosures, including data handled only on-device.
- Localized WooCommerce classic, Shopify-style, and generic RTL contracts across MXN, CHF, and AED.
- Separate subtotal, tax, shipping, and payable-total fixtures to prevent false total selection.
- Copy-ready listing metadata, reviewer notes, exact-dimension store graphics, and deterministic review kit.
- Public security and creator-attribution self-review with executed URL/cookie preservation evidence.
- Any anonymous outcome reporting only after separate consent, minimization, and abuse-control design.

## v0.6 — Privacy-safe release-candidate feedback (shipped)

- User-triggered, local-only compatibility report with fixed adapter/reason allowlists and coarse detection booleans.
- Regression proof that URLs/hostnames, page content/selectors, codes, totals/currencies, cookies, and creator tags cannot enter the report.
- Privacy-gated GitHub issue form that rejects live checkout captures and requires a generated safe report.
- Executed adapter/platform matrix, release changelog, support triage, and store-review response playbook.
- Unchanged zero-affiliate creator-attribution guarantee and no analytics/outcome upload.

## v0.7 — Public browser-store launch

- Publish through Chrome Web Store and Microsoft Edge Add-ons after developer-dashboard review.
- Add synthetic fixtures derived from verified sanitized compatibility reports without collecting live checkout captures.
- Track adapter regressions by public platform/theme version and continue stopping safely on unknown markup.
- Invite independent review of the permission, signed-feed, compatibility-report, and creator-attribution boundaries.
- Respond to browser-store review using the public evidence kit without weakening disclosures.

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
