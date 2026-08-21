# Comb v0.8 Release Candidate and Publication

Comb produces two deterministic archives using only Node.js built-ins:

1. a minimal runtime ZIP whose manifest supports Chrome 121+, Edge, and Firefox 128+ desktop with one permission set; and
2. an outer reviewer kit containing that runtime ZIP, checksums, exact Chrome/Edge/Firefox listing metadata, store graphics, privacy policy, machine support matrix, browser-runner evidence, and review materials.

## Build and verify locally

Use Node 22 or newer from a clean, reviewed commit:

```bash
npm run check
npm run release:build
node scripts/verify-release-artifacts.js --version 0.8.0
```

Successful output is exactly:

```text
dist/comb-0.8.0.zip
dist/comb-0.8.0.zip.sha256
dist/comb-0.8.0-store-review-kit.zip
dist/comb-0.8.0-store-review-kit.zip.sha256
```

Only `comb-0.8.0.zip` can become a browser-store upload after the publication record marks v0.8 released and explicitly allows submission. An AMO upload additionally requires the complete hosted Firefox gate—shared checkout/attribution plus exact-ZIP startup, optional-origin denial, approved tampered-feed grant rollback, valid signed-feed installation, and production alarm/origin cleanup—to be green at that exact release commit. AMO review supplies Mozilla's signed installable package. The outer review kit is a handoff artifact and must never be uploaded as the extension package.

Verify both sidecars from the output directory:

```bash
cd dist
sha256sum -c comb-0.8.0.zip.sha256
sha256sum -c comb-0.8.0-store-review-kit.zip.sha256
```

## Controlled GitHub publication

`.github/workflows/release.yml` is manual only. It is deliberately separate from push and pull-request verification and has the repository write permission needed to create one tag and release. Running it is a publication action and requires repository write access.

Before dispatch, identify the full 40-character SHA from a successful **Verify Comb** run on current `main`. In GitHub Actions, choose **Publish verified Comb release**, enter:

- version `0.8.0` without the `v` prefix;
- the full green `main` commit SHA; and
- the checked creator-attribution publication authorization.

The equivalent GitHub CLI command is:

```bash
gh workflow run release.yml --ref main \
  -f version=0.8.0 \
  -f commit_sha=FULL_GREEN_MAIN_SHA \
  -f confirm_creator_attribution=true
```

The workflow fails before publication unless all of these remain true:

1. the authorization checkbox is true;
2. the version is exact `X.Y.Z` and the commit is a full lowercase SHA;
3. checked-out `HEAD` and refreshed `origin/main` both equal the authorized SHA;
4. the worktree is clean and package, manifest, engine, listing, and fixture-matrix versions all match;
5. changelog, release notes, submission checklist, and this release record name the same version;
6. `v0.8.0` does not already exist locally or remotely;
7. matrix/runtime/store validation, all unit tests, required real-Chrome contracts, and the complete real-Firefox checkout/package contracts pass;
8. both deterministic archives rebuild successfully and all four exact files match their SHA-256 sidecars; and
9. release creation targets the authorized full SHA.

After `gh release create` succeeds, the workflow verifies the published tag name, target SHA, non-draft state, and exact four asset names. It does not submit to Chrome or Edge.

Comb treats a published `vX.Y.Z` tag as immutable and the workflow refuses reuse. Never move or replace a release tag; any changed source or artifact requires a new semantic version and changelog entry. Repository owners should enable GitHub immutable releases when available for the repository.

## Runtime reproducibility boundary

The runtime archive contains only the exact packaged files declared in `scripts/build-release.js`, sorted by archive path. `manifest.json` is at its root and maps the same background code to Chrome's service worker and Firefox's ordered event-page scripts. The writer fixes file modes, omits platform-specific metadata, and gives every entry the same timestamp. It builds the bytes twice and fails unless they are identical.

## Reviewer-kit boundary

`scripts/build-store-package.js` first validates store metadata and PNG dimensions, then runs the verified runtime build. It packages the runtime ZIP/sidecar with:

- shared Chrome/Edge/Firefox listing metadata, MIT license source, and copy;
- the 128×128 icon, 300×300 Edge logo, 440×280 tile, 1400×560 Chrome marquee tile, and five numbered 1280×800 screenshots;
- reviewer/certification instructions and the store-response playbook;
- the public privacy policy, Creator Attribution Guarantee, security review, compatibility guide, machine support matrix, independent-review guide, support triage, and changelog;
- snapshots of verification/release workflows, the shared browser contract, both real-browser runners, the Firefox WebDriver/proxy unit contract, and matrix/candidate/artifact validators; and
- a manifest snapshot.

The outer ZIP is also built twice and gets its own SHA-256 sidecar. Its `README.md` makes the upload boundary explicit.

## Timestamp control

By default, both archive timestamps come from the current Git commit. Release automation can supply Unix seconds explicitly:

```bash
SOURCE_DATE_EPOCH=1723593600 npm run release:build
```

The same source tree, Node version, and `SOURCE_DATE_EPOCH` produce the same ZIP bytes and SHA-256 digests.

## Browser-store submission

Browser-store publication supplies the installable signature. Do not describe either repository-built ZIP as signed. After the GitHub release is green, verify its four assets against the workflow output, inspect the runtime ZIP file list, preview the public store copy against [STORE_LISTING.md](STORE_LISTING.md), and follow [../store/SUBMISSION.md](../store/SUBMISSION.md) in each developer dashboard.

Store approval, rejection, listing URL, and rollout state must be recorded separately. A GitHub release is not evidence that Comb is available in Chrome Web Store, Microsoft Edge Add-ons, or addons.mozilla.org. Firefox-specific pre-publication work is defined in [FIREFOX.md](FIREFOX.md).
