# Changelog

All notable Comb changes are recorded here. At browser-store publication, the release version must match `manifest.json`, `package.json`, the checkout engine, store metadata, and an immutable `vX.Y.Z` source tag created only after required CI succeeds.

## Unreleased

### Added

- A machine-validated publication record with exact Chrome and Edge lifecycle states, immutable release-asset requirements, and fail-closed public-availability claims.
- An offline report-to-fixture proposal scaffold that accepts only the exact safe-report schema, copies coarse allowlisted signals, discards timestamps, and emits invented placeholders without generating HTML.
- A privacy-gated synthetic-fixture issue form and authoring guide that require public documentation, independent markup authorship, safe stops, and unchanged creator attribution.

### Preserved

- The verified v0.7 release remains immutably tagged at its green `main` commit while both browser stores remain unsubmitted.
- No telemetry, outcome upload, live checkout evidence, affiliate identity, or creator-attribution mutation was added.

## [0.7.0] - 2026-08-15

### Added

- A strict `comb.fixture-support-matrix/v1` record covering every synthetic HTML fixture exactly once, with public-contract snapshot labels, expected state transitions, and a single creator-attribution owner.
- Matrix validation that rejects live hosts, remote fixture resources, creator/affiliate identifiers, version drift, missing fixtures, and unsupported result values before browser tests run.
- A public-evidence-only independent-review guide and GitHub issue form for permission, signed-feed, compatibility-report, checkout-state, release, and creator-attribution boundaries.
- A manually dispatched, fail-closed GitHub release workflow that accepts only an exact clean `main` commit and synchronized version, requires explicit creator-attribution authorization, reruns every gate, verifies four checksummed artifacts, rejects tag reuse, and publishes at that full SHA.

### Changed

- The real-Chrome suite now reads happy-path versions and expectations from the machine matrix instead of a second hardcoded fixture list.
- GitHub CI actions moved to their current Node 24-backed v7 release lines.
- The deterministic reviewer kit now includes the machine support matrix and independent-review guide.

### Preserved

- The creator-tagging issue remains fixed: Comb has no affiliate identity and leaves existing creator affiliate tags, referral parameters, and attribution cookies untouched so the original creator can keep proper attribution.
- Browser-store dashboard submission remains a separate maintainer account action; v0.7 does not claim publication before a store approves the package.

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
