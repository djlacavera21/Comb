# Comb Publication Status

This page records evidence, not launch intent. [`../store/publication-record.json`](../store/publication-record.json) is the canonical machine-readable record, and `npm run lint` rejects premature release or browser-store availability claims unless the official publication status supports them.

## Current development build

- Current development version: `0.8.0`
- Development status: **Unreleased**
- Development release tag: **None**
- Browser-store submission allowed: **No**

Local builds now produce `comb-0.8.0` archives. They are development artifacts, not the immutable v0.7 release assets, and must not be uploaded to a browser-store dashboard while the machine record keeps submission disabled.

The runtime manifest includes an unsigned Firefox desktop compatibility path. Publication schema v3 now models Mozilla's official AMO add-on states and fails closed unless only `public` is described as available. Source and workflow configuration include a required shared checkout plus exact-package prompt denial, tampered-feed grant rollback, valid signed-feed installation, alarm, and origin-cleanup Firefox gate. That is still not execution evidence or AMO availability for this development commit: no Firefox submission may occur until a verified v0.8 release records the required hosted gate as green, authorizes submission, and completes Mozilla review/signing.

## Latest verified release evidence

- Version: `0.7.0`
- Branch: `main`
- Candidate commit: [`e1ab9ca18b51a8a08ff9d99cdb6b91d8a56441ee`](https://github.com/djlacavera21/Comb/commit/e1ab9ca18b51a8a08ff9d99cdb6b91d8a56441ee)
- Required CI: [successful run 31851839052](https://github.com/djlacavera21/Comb/actions/runs/31851839052)
- Verification conclusion: **Success**
- Runtime archive SHA-256: `135a6c655cd5cf4e896035a1ee694aaa289e576ca7107307dda463d52c63405f`
- Store review-kit SHA-256: `f4f551bbb57e2b67ce377ffb1f91e32ea96f5d16f5f9ddc138cc1c916ae274db`

## Official publication state

- GitHub release: **Released**
- Immutable tag and release: [`v0.7.0`](https://github.com/djlacavera21/Comb/releases/tag/v0.7.0)
- Release workflow: [successful run 31853787164](https://github.com/djlacavera21/Comb/actions/runs/31853787164)
- Published at: `2026-08-15T00:30:11Z`
- Chrome Web Store: **Not submitted**
- Microsoft Edge Add-ons: **Not submitted**
- Firefox Add-ons (AMO): **Not submitted**

Comb is not publicly available from any browser store yet. A repository build or GitHub release is not an installable browser-store signature and must never be described as store publication.

### Immutable GitHub release assets

| Asset | SHA-256 |
| --- | --- |
| [`comb-0.7.0-store-review-kit.zip`](https://github.com/djlacavera21/Comb/releases/download/v0.7.0/comb-0.7.0-store-review-kit.zip) | `f4f551bbb57e2b67ce377ffb1f91e32ea96f5d16f5f9ddc138cc1c916ae274db` |
| [`comb-0.7.0-store-review-kit.zip.sha256`](https://github.com/djlacavera21/Comb/releases/download/v0.7.0/comb-0.7.0-store-review-kit.zip.sha256) | `b4cecd81f0b0b84f58203fc49ebe4196075386af34e8557c131a39237b486daf` |
| [`comb-0.7.0.zip`](https://github.com/djlacavera21/Comb/releases/download/v0.7.0/comb-0.7.0.zip) | `135a6c655cd5cf4e896035a1ee694aaa289e576ca7107307dda463d52c63405f` |
| [`comb-0.7.0.zip.sha256`](https://github.com/djlacavera21/Comb/releases/download/v0.7.0/comb-0.7.0.zip.sha256) | `82eee052e58fcaff6d326e96bdf824727b6d6932f822050db18b8d1799e6bb5e` |

Chrome's official lifecycle distinguishes pending review, staged, public, trusted-tester, rejected, and cancelled states. Microsoft separately defines draft, review, waiting, in-store, failed, unavailable, removed, and blocked states. Mozilla's AMO API defines `incomplete`, `nominated` (awaiting review), `public` (approved), `rejected`, `disabled`, and `deleted` add-on states. The validator maps public availability only to Chrome `published`, Edge `in_store`/`in_store_update_in_review`, and Firefox `public`; every earlier or disabled state remains unavailable.

## Creator attribution boundary

**The creator-tagging issue is fixed.** Required real-Chrome and real-Firefox runners execute one shared contract that preserves a synthetic creator affiliate URL and attribution cookie byte-for-byte while testing coupons. Comb has no affiliate identity and does not append, replace, or write affiliate tags, referral parameters, or attribution cookies.

This is bounded synthetic evidence, not a claim that Comb can inspect or certify every live merchant's attribution system. Publication evidence must use repository commits, CI, synthetic fixtures, official store status, and public listing URLs only—never a live checkout capture or creator identifier.

## Updating this record

1. Treat the recorded `v0.7.0` tag, target commit, release workflow, assets, and checksums as immutable; use a new version for any changed build.
2. Do not submit `comb-0.8.0.zip` while the development status is **Unreleased** or browser-store submission is **No**.
3. After a verified v0.8 release, update the product evidence, immutable assets, checksums, development state, and submission authorization together before any dashboard upload.
4. Record each dashboard or AMO add-on/version ID, submitted version, and official state without copying private reviewer correspondence.
5. Set `publiclyAvailable` only when the official state permits it and add the official listing URL and publication timestamp.
6. Link any public review evidence through a repository issue, pull request, or commit.

Official references: [Chrome publication](https://developer.chrome.com/docs/webstore/publish), [Chrome item states](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/ItemState), [Chrome review status](https://developer.chrome.com/docs/webstore/check-review), [Microsoft Edge submission states](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/submission-states), and [Mozilla AMO add-on/version states](https://mozilla.github.io/addons-server/topics/api/addons).
