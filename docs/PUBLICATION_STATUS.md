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

- GitHub release: **Not released**
- Chrome Web Store: **Not submitted**
- Microsoft Edge Add-ons: **Not submitted**

Comb is not publicly available from either browser store yet. A repository build or GitHub release is not an installable browser-store signature and must never be described as store publication.

Chrome's official lifecycle distinguishes pending review, staged, public, trusted-tester, rejected, and cancelled states. Microsoft separately defines draft, review, waiting, in-store, failed, unavailable, removed, and blocked states. The validator maps public availability only to Chrome `published` and Edge `in_store`/`in_store_update_in_review`; every earlier state remains unavailable.

## Creator attribution boundary

**The creator-tagging issue is fixed.** The required real-Chrome contract preserves a synthetic creator affiliate URL and attribution cookie byte-for-byte while testing coupons. Comb has no affiliate identity and does not append, replace, or write affiliate tags, referral parameters, or attribution cookies.

This is bounded synthetic evidence, not a claim that Comb can inspect or certify every live merchant's attribution system. Publication evidence must use repository commits, CI, synthetic fixtures, official store status, and public listing URLs only—never a live checkout capture or creator identifier.

## Updating this record

1. Run the manually authorized release workflow at the exact current green `main` SHA.
2. Record the release-workflow run, immutable tag, target commit, release URL, timestamp, and SHA-256 of all four release assets.
3. Record each dashboard item/submission ID, submitted version, and official state without copying private reviewer correspondence.
4. Set `publiclyAvailable` only when the official state permits it and add the official listing URL and publication timestamp.
5. Link any public review evidence through a repository issue, pull request, or commit.

Official references: [Chrome publication](https://developer.chrome.com/docs/webstore/publish), [Chrome item states](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/ItemState), [Chrome review status](https://developer.chrome.com/docs/webstore/check-review), [Microsoft Edge submission states](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/submission-states).
