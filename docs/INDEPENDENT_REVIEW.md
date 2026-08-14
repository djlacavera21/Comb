# Independent Review Guide

Comb invites independent review of a specific public commit. The goal is reproducible scrutiny of the implementation boundary, especially the guarantee that Comb does not replace creator affiliate attribution. A submitted review is evidence from its named reviewer and scope; it is not automatically an audit, certification, penetration test, or endorsement.

## Safe review boundary

Use only the public repository, synthetic fixtures, and invented values. Do not inspect, record, or publish a live checkout URL, hostname, page source, screenshot, HAR file, cookie, coupon token, total, address, identity, payment/order detail, affiliate tag, or creator identifier.

If a security-sensitive finding cannot be described safely, follow [../SECURITY.md](../SECURITY.md). Request a private channel without posting the finding or any checkout detail. The public independent-review form is not a vulnerability intake.

## Pin the evidence

Record the full 40-character commit SHA before reviewing:

```bash
git rev-parse HEAD
git status --short
```

The status output should be empty. A review must identify this commit so later code changes cannot be mistaken for the reviewed source.

## Reproduce the release gates

Use Node 22 or newer and a Chrome-family browser:

```bash
npm run lint
npm test
node scripts/run-browser-fixtures.js --require-browser
npm run release:build
```

Record the environment and result of each command. The release build validates and creates the runtime plus reviewer-kit archives twice, requiring byte-identical output before writing SHA-256 sidecars.

## Evidence map

| Boundary | Primary implementation | Required evidence |
| --- | --- | --- |
| Permissions and page access | `manifest.json`, `src/background.js`, `scripts/validate-extension.js` | No required host permission or static content script; injection follows an explicit toolbar action. |
| Creator attribution | `docs/ATTRIBUTION.md`, `src/content/checkout-engine.js`, `scripts/run-browser-fixtures.js` | Static URL/cookie/navigation prohibitions plus the real-Chrome creator URL and cookie byte-preservation contract. |
| Signed feeds | `src/shared/feed-verifier.js`, `src/shared/source-policy.js`, feed/background unit tests | Strict signed code-only data, signer/feed pinning, rollback protection, exact approved origin, no credentials/referrer/redirect. |
| Compatibility reports | `src/shared/compatibility-report.js`, compatibility-report tests, compatibility issue form | A newly constructed allowlisted object; no URL/host, page content, codes, totals/currency, cookies, affiliate tags, or creator identifiers; no automatic upload. |
| Checkout state safety | `src/content/checkout-engine.js`, `tests/fixtures/support-matrix.json` | Every fixture executes one versioned synthetic contract; unknown markup, existing coupons, removal mismatch, and currency drift stop safely with zero purchase clicks. |
| Release publication | `.github/workflows/verify.yml`, `.github/workflows/release.yml`, `scripts/validate-release-candidate.js` | Manually supplied full SHA and version must equal the checked-out `main` commit and all product versions; every gate reruns before tag/release creation. |

## Creator-attribution review questions

Treat the tagging fix as a release-blocking contract:

1. Does any packaged path add or replace an affiliate, referral, click, or publisher identifier?
2. Can packaged code navigate, rewrite URL/history, create/update a merchant tab, intercept traffic, or mutate a cookie?
3. Can signed-feed or compatibility-report data carry executable or affiliate behavior?
4. Does the real-Chrome `generic.html` contract preserve the exact creator-tagged URL and attribution cookie through a complete coupon run?
5. Does every synthetic checkout contract leave its purchase control untouched?

The expected answer is no to the first three and yes to the final two. A contrary result blocks release.

## Reporting a public conclusion

Open the repository's **Independent boundary review** issue form. Include the reviewed commit, environment, commands, scope, public paths/test names, and conclusion. Use invented examples only. A no-finding result applies only to the stated scope and commit; it does not prove the absence of all defects.

Maintainers should link accepted public reviews from release evidence without rewriting the reviewer’s scope or inflating the claim. Findings must receive a regression test or documented rationale before closure, and creator-attribution, unauthorized transmission, purchase-action, or checkout-state findings block release until resolved.
