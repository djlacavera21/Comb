# Comb v0.7 submission checklist

This kit is a reviewer handoff. Upload `upload/comb-0.7.0.zip` to the browser store; do not upload this outer review-kit ZIP as the extension package.

## Shared checks

- Confirm required CI and the manually authorized GitHub release workflow are green at the same full `main` SHA.
- Confirm GitHub tag `v0.7.0` and its release target that exact SHA; never move an existing tag.
- Verify `upload/comb-0.7.0.zip.sha256` before upload and compare it with the GitHub release asset.
- Confirm `manifest.json` is at the root of the runtime ZIP and reports version `0.7.0`.
- Use the public privacy-policy URL recorded in `listing/listing.json`.
- Copy the permission, local data-handling, optional-feed, remote-code, and creator-attribution disclosures without weakening them.
- Preserve the phrase **The creator-tagging issue is fixed** and its precise explanation that existing affiliate URL tags, referral parameters, and cookies remain untouched.
- Keep the safe compatibility report described as user-triggered, local-only, and allowlisted; do not imply automatic diagnostics or telemetry.
- Keep the fixture matrix described as synthetic contract evidence, not universal live-merchant compatibility.
- Check `evidence/publication-record.json` before and after every account-level action (the source file is `store/publication-record.json`). A draft, pending review, staged build, trusted-tester build, or GitHub release is not public store availability.

## Chrome Web Store

1. Upload the runtime ZIP from `upload/`.
2. Copy the shared name, description, category, language, homepage, support, and privacy-policy fields from `listing/listing.json`.
3. Copy `listing/chrome-description.txt` and `listing/release-notes.txt`.
4. Upload the 128×128 icon, 440×280 small promo tile, and all five numbered 1280×800 screenshots from `listing/assets/` in order.
5. Copy the single-purpose and per-permission explanations.
6. Declare no remote code.
7. Select the three conservative local data types and complete every Limited Use certification recorded in the listing metadata.
8. Supply `listing/review-notes.md`, save the draft, preview the public listing, and submit for review.
9. Record the Chrome item/submission IDs and exact dashboard state. Set public availability only after the state is `published` and an official listing URL resolves.

If a reviewer asks for clarification, use `listing/review-response-playbook.md` and attach only synthetic/public evidence. Never attach a live checkout capture.

## Microsoft Edge Add-ons

1. Import or upload the same runtime ZIP.
2. Copy the shared fields and `listing/edge-description.txt` for the `en` locale.
3. Upload the 300×300 logo, optional 440×280 small tile, and all five numbered 1280×800 screenshots in order.
4. Copy no more than the five validated search terms from `listing/listing.json`.
5. Use `listing/review-notes.md` as certification notes and repeat the privacy disclosure exactly.
6. Preview the listing and submit for certification.
7. Record the Edge item/submission IDs and exact Partner Center state. Set public availability only for `in_store` or `in_store_update_in_review` with an official listing URL.

Store publication supplies the installable signature. Neither ZIP in this kit should be described as developer-signed.

Record each store's submission ID, review state, approval date, public listing URL, and deployed version separately. A GitHub release alone does not mean Comb is available in either store.
