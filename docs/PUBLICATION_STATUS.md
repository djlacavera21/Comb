# Comb Publication Status

This page records evidence, not launch intent. [`../store/publication-record.json`](../store/publication-record.json) is the canonical machine-readable record, and `npm run lint` rejects premature release or browser-store availability claims unless the official publication status supports them.

## Current verified candidate

- Version: `0.7.0`
- Branch: `main`
- Candidate commit: [`e1ab9ca18b51a8a08ff9d99cdb6b91d8a56441ee`](https://github.com/djlacavera21/Comb/commit/e1ab9ca18b51a8a08ff9d99cdb6b91d8a56441ee)
- Required CI: [successful run 31851839052](https://github.com/djlacavera21/Comb/actions/runs/31851839052)
- Verification conclusion: **Success**
- Runtime archive SHA-256: `135a6c655cd5cf4e896035a1ee694aaa289e576ca7107307dda463d52c63405f`
- Store review-kit SHA-256: `f4f551bbb57e2b67ce377ffb1f91e32ea96f5d16f5f9ddc138cc1c916ae274db`

## Current publication state

- GitHub release: **Released**
- Immutable tag and release: [`v0.7.0`](https://github.com/djlacavera21/Comb/releases/tag/v0.7.0)
- Release workflow: [successful run 31853787164](https://github.com/djlacavera21/Comb/actions/runs/31853787164)
- Published at: `2026-08-15T00:30:11Z`
- Chrome Web Store: **Not submitted**
- Microsoft Edge Add-ons: **Not submitted**

Comb is not publicly available from either browser store yet. A repository build or GitHub release is not an installable browser-store signature and must never be described as store publication.

### Immutable GitHub release assets

| Asset | SHA-256 |
| --- | --- |
| [`comb-0.7.0-store-review-kit.zip`](https://github.com/djlacavera21/Comb/releases/download/v0.7.0/comb-0.7.0-store-review-kit.zip) | `f4f551bbb57e2b67ce377ffb1f91e32ea96f5d16f5f9ddc138cc1c916ae274db` |
| [`comb-0.7.0-store-review-kit.zip.sha256`](https://github.com/djlacavera21/Comb/releases/download/v0.7.0/comb-0.7.0-store-review-kit.zip.sha256) | `b4cecd81f0b0b84f58203fc49ebe4196075386af34e8557c131a39237b486daf` |
| [`comb-0.7.0.zip`](https://github.com/djlacavera21/Comb/releases/download/v0.7.0/comb-0.7.0.zip) | `135a6c655cd5cf4e896035a1ee694aaa289e576ca7107307dda463d52c63405f` |
| [`comb-0.7.0.zip.sha256`](https://github.com/djlacavera21/Comb/releases/download/v0.7.0/comb-0.7.0.zip.sha256) | `82eee052e58fcaff6d326e96bdf824727b6d6932f822050db18b8d1799e6bb5e` |

Chrome's official lifecycle distinguishes pending review, staged, public, trusted-tester, rejected, and cancelled states. Microsoft separately defines draft, review, waiting, in-store, failed, unavailable, removed, and blocked states. The validator maps public availability only to Chrome `published` and Edge `in_store`/`in_store_update_in_review`; every earlier state remains unavailable.

## Creator attribution boundary

**The creator-tagging issue is fixed.** The required real-Chrome contract preserves a synthetic creator affiliate URL and attribution cookie byte-for-byte while testing coupons. Comb has no affiliate identity and does not append, replace, or write affiliate tags, referral parameters, or attribution cookies.

This is bounded synthetic evidence, not a claim that Comb can inspect or certify every live merchant's attribution system. Publication evidence must use repository commits, CI, synthetic fixtures, official store status, and public listing URLs only—never a live checkout capture or creator identifier.

## Updating this record

1. Treat the recorded `v0.7.0` tag, target commit, release workflow, assets, and checksums as immutable; use a new version for any changed build.
2. Submit only the recorded `comb-0.7.0.zip` runtime asset to each browser-store dashboard after verifying its SHA-256.
3. Record each dashboard item/submission ID, submitted version, and official state without copying private reviewer correspondence.
4. Set `publiclyAvailable` only when the official state permits it and add the official listing URL and publication timestamp.
5. Link any public review evidence through a repository issue, pull request, or commit.

Official references: [Chrome publication](https://developer.chrome.com/docs/webstore/publish), [Chrome item states](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/ItemState), [Chrome review status](https://developer.chrome.com/docs/webstore/check-review), [Microsoft Edge submission states](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/submission-states).
