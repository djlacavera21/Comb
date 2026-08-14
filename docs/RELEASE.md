# Comb Release Build

Comb produces a deterministic Chrome Web Store upload archive using only Node.js built-ins. Use Node 22 or newer from a clean, reviewed commit:

```bash
npm run check
npm run release:build
```

The build validates the extension, constructs the archive twice in memory, and fails unless both byte streams are identical. Successful output is:

```text
dist/comb-0.4.0.zip
dist/comb-0.4.0.zip.sha256
```

Verify the sidecar from the output directory:

```bash
cd dist
sha256sum -c comb-0.4.0.zip.sha256
```

## Reproducibility boundary

The archive contains only the exact runtime files declared in `scripts/build-release.js`, sorted by archive path. `manifest.json` is at the archive root. The writer fixes file modes, omits platform-specific metadata, and gives every entry the same timestamp.

By default, the timestamp comes from the current Git commit. Release automation can supply a Unix timestamp explicitly:

```bash
SOURCE_DATE_EPOCH=1723593600 npm run release:build
```

The same source tree, Node version, and `SOURCE_DATE_EPOCH` produce the same ZIP bytes and SHA-256 digest. GitHub Actions runs the verified build after unit and required real-Chrome contracts, then uploads the ZIP and checksum together as a workflow artifact.

## Signing and publication

The generated ZIP is a store-upload artifact; it is not a directly distributed signed extension package. Upload the verified ZIP through the Chrome Web Store developer workflow. Chrome Web Store publication supplies the extension's installable signature. Do not claim the local ZIP is signed, and do not distribute private signing keys with Comb.

Before submission, confirm that the store listing and privacy disclosures match the reviewed source, the workflow is green, and the checksum matches the artifact being uploaded.
