# Changelog

All notable Comb changes are recorded here. At browser-store publication, the release version must match `manifest.json`, `package.json`, the checkout engine, store metadata, and an immutable `vX.Y.Z` source tag created only after required CI succeeds.

## [0.6.0] - 2026-08-14

### Added

- A user-triggered `comb.compatibility-report/v1` download with fixed allowlists and no automatic upload.
- Regression tests proving merchant URLs/hostnames, page labels/selectors, totals/currencies, coupon codes, cookies, creator identifiers, and affiliate tags cannot enter the safe report.
- A privacy-gated GitHub compatibility issue form, executed adapter matrix, support triage policy, and browser-store review-response playbook.
- Required real-Chrome coverage for the compatibility-report schema and popup keyboard access.

### Preserved

- The creator-tagging issue remains fixed: Comb has no affiliate identity and leaves existing creator affiliate tags, referral parameters, and attribution cookies untouched so the original creator can keep proper attribution.
- No backend, analytics, outcome upload, account, remote code, purchase click, permanent shopping-site permission, or install-time feed-origin access was added.

## [0.5.0] - 2026-08-14

- Added validated Chrome/Edge submission metadata, exact-dimension store assets, public security evidence, localized fixtures, deterministic runtime/reviewer-kit archives, and required creator URL/cookie preservation coverage.

## [0.4.0] - 2026-08-14

- Added required real-Chrome adapter/restoration contracts, localized money parsing, accessibility coverage, and deterministic runtime packaging.

## [0.3.0] - 2026-08-14

- Added explicitly approved, origin-scoped, credential-free signed-feed retrieval with signer/feed pinning and rollback protection.

## [0.2.0] - 2026-08-14

- Added offline trust-key import and strict ECDSA P-256 signed code-only community feeds.

## [0.1.0] - 2026-08-14

- Added the local Manifest V3 coupon-testing proof of value and zero-affiliate Creator Attribution Guarantee.
