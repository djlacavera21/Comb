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

## v0.7 — Browser-store launch controls (shipped)

- Added a machine-validated fixture matrix that tracks public-contract snapshots and synthetic theme versions without collecting live checkout captures.
- Bound every synthetic fixture to expected adapter, status, reason, totals, click counts, and the sole creator-attribution preservation owner.
- Added a commit-pinned, public-evidence-only independent-review guide and intake for permission, signed-feed, compatibility-report, release, and creator-attribution boundaries.
- Added a manually authorized GitHub publication workflow that reruns every safety/attribution gate and creates the version tag/release only at the supplied current `main` SHA.
- Added the matrix and independent-review guide to the deterministic store evidence kit and retained exact disclosure language for reviewer responses.

## v0.8 — Browser-store publication and field feedback

- Maintain a machine-validated publication record whose official state mapping rejects premature GitHub-release or store-availability claims.
- Published the approved v0.7 source commit through the verified release workflow and recorded its immutable tag, release URL, and four artifact checksums.
- Submit only the runtime ZIP through Chrome Web Store and Microsoft Edge Add-ons developer dashboards; record review outcomes and public listing URLs without claiming availability early.
- Convert privacy-safe compatibility reports into independently written synthetic fixtures through a strict enum/boolean-only scaffold while retaining safe stops on unknown markup.
- Link scoped independent reviews and respond to findings with tests or documented rationale before release.
- Keep outcome reporting absent unless a separate consent, minimization, and abuse-control design is approved.

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
