# Comb v0.6 Release Build

Comb produces two deterministic archives using only Node.js built-ins:

1. a minimal runtime ZIP to upload to Chrome Web Store or Microsoft Edge Add-ons; and
2. an outer reviewer kit containing that runtime ZIP, checksums, exact listing metadata, store graphics, privacy policy, and security evidence.

Use Node 22 or newer from a clean, reviewed commit:

```bash
npm run check
npm run release:build
```

Successful output is:

```text
dist/comb-0.6.0.zip
dist/comb-0.6.0.zip.sha256
dist/comb-0.6.0-store-review-kit.zip
dist/comb-0.6.0-store-review-kit.zip.sha256
```

Upload `comb-0.6.0.zip` as the extension. The outer review kit is a handoff artifact and must not be uploaded as the extension package.

Verify both sidecars from the output directory:

```bash
cd dist
sha256sum -c comb-0.6.0.zip.sha256
sha256sum -c comb-0.6.0-store-review-kit.zip.sha256
```

## Runtime reproducibility boundary

The runtime archive contains only the exact packaged files declared in `scripts/build-release.js`, sorted by archive path. `manifest.json` is at its root. The writer fixes file modes, omits platform-specific metadata, and gives every entry the same timestamp. It builds the bytes twice and fails unless they are identical.

## Reviewer-kit boundary

`scripts/build-store-package.js` first validates store metadata and PNG dimensions, then runs the verified runtime build. It packages the runtime ZIP/sidecar with:

- shared Chrome/Edge listing metadata and copy;
- the 128×128 icon, 300×300 Edge logo, 440×280 tile, and 1280×800 screenshot;
- reviewer/certification instructions;
- the public privacy policy, Creator Attribution Guarantee, v0.6 security review, compatibility matrix, support triage, changelog, and store-response playbook; and
- a manifest snapshot.

The outer ZIP is also built twice and gets its own SHA-256 sidecar. Its `README.md` makes the upload boundary explicit.

## Timestamp control

By default, both archive timestamps come from the current Git commit. Release automation can supply Unix seconds explicitly:

```bash
SOURCE_DATE_EPOCH=1723593600 npm run release:build
```

The same source tree, Node version, and `SOURCE_DATE_EPOCH` produce the same ZIP bytes and SHA-256 digests. GitHub Actions runs runtime/store validation, unit tests, and required real-Chrome contracts before building and uploading all four artifacts.

## Signing and publication

The generated ZIPs are store-upload and review artifacts; they are not directly distributed signed extension packages. Browser-store publication supplies the installable signature. Do not describe either local ZIP as signed and never distribute private feed-signing keys with Comb.

After required CI succeeds on the release commit, create the immutable source tag `v0.6.0` at that exact commit and record the runtime/reviewer-kit SHA-256 values in the release handoff. Never move a published release tag; a changed source tree requires a new semantic version and changelog entry.

Before submission, confirm the workflow is green, verify both checksums, inspect the runtime ZIP file list, and preview the public store copy against [`STORE_LISTING.md`](STORE_LISTING.md). Follow the exact dashboard sequence in [`../store/SUBMISSION.md`](../store/SUBMISSION.md).
