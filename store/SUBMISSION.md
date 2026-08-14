# Comb v0.5 submission checklist

This kit is a reviewer handoff. Upload `upload/comb-0.5.0.zip` to the browser store; do not upload this outer review-kit ZIP as the extension package.

## Shared checks

- Confirm the release commit and required CI workflow are green.
- Verify `upload/comb-0.5.0.zip.sha256` before upload.
- Confirm `manifest.json` is at the root of the runtime ZIP and reports version `0.5.0`.
- Use the public privacy-policy URL recorded in `listing/listing.json`.
- Copy the permission, local data-handling, optional-feed, remote-code, and creator-attribution disclosures without weakening them.
- Preserve the phrase **The creator-tagging issue is fixed** and its precise explanation that existing affiliate URL tags, referral parameters, and cookies remain untouched.

## Chrome Web Store

1. Upload the runtime ZIP from `upload/`.
2. Copy the shared name, description, category, language, homepage, support, and privacy-policy fields from `listing/listing.json`.
3. Copy `listing/chrome-description.txt` and `listing/release-notes.txt`.
4. Upload the 128×128 icon, 440×280 small promo tile, and 1280×800 screenshot from `listing/assets/`.
5. Copy the single-purpose and per-permission explanations.
6. Declare no remote code.
7. Select the three conservative local data types and complete every Limited Use certification recorded in the listing metadata.
8. Supply `listing/review-notes.md`, save the draft, preview the public listing, and submit for review.

## Microsoft Edge Add-ons

1. Import or upload the same runtime ZIP.
2. Copy the shared fields and `listing/edge-description.txt` for the `en` locale.
3. Upload the 300×300 logo, optional 440×280 small tile, and 1280×800 screenshot.
4. Copy no more than the five validated search terms from `listing/listing.json`.
5. Use `listing/review-notes.md` as certification notes and repeat the privacy disclosure exactly.
6. Preview the listing and submit for certification.

Store publication supplies the installable signature. Neither ZIP in this kit should be described as developer-signed.
