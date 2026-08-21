# Comb v0.8 submission checklist

This kit is a reviewer handoff. The only possible extension upload inside it is `upload/comb-0.8.0.zip`; never upload the outer review-kit ZIP as the extension package.

> **Submission stop:** the checked-in publication record currently marks v0.8 **Unreleased** and browser-store submission **No**. Do not upload either ZIP until a verified v0.8 release is recorded and that authorization changes to **Yes**.

## Shared checks

- Confirm required CI and the manually authorized GitHub release workflow are green at the same full `main` SHA.
- Confirm GitHub tag `v0.8.0` and its release target that exact SHA; never move an existing tag.
- Verify `upload/comb-0.8.0.zip.sha256` before upload and compare it with the GitHub release asset.
- Confirm `manifest.json` is at the root of the runtime ZIP and reports version `0.8.0`.
- Confirm `development.status` is `released`, `development.releaseTag` is `v0.8.0`, and `development.browserStoreSubmissionAllowed` is `true` in the canonical publication record.
- Use the public privacy-policy URL recorded in `listing/listing.json`.
- Copy the permission, local data-handling, optional-feed, remote-code, and creator-attribution disclosures without weakening them.
- Preserve the phrase **The creator-tagging issue is fixed** and its precise explanation that existing affiliate URL tags, referral parameters, and cookies remain untouched.
- Keep the safe compatibility report described as user-triggered, local-only, and allowlisted; do not imply automatic diagnostics or telemetry.
- Keep the fixture matrix described as synthetic contract evidence, not universal live-merchant compatibility.
- Check `evidence/publication-record.json` before and after every account-level action (the source file is `store/publication-record.json`). A draft, pending review, staged build, trusted-tester build, AMO `incomplete`/`nominated` state, or GitHub release is not public store availability.

## Chrome Web Store

1. Upload the runtime ZIP from `upload/`.
2. Copy the shared name, description, category, language, homepage, support, and privacy-policy fields from `listing/listing.json`.
3. Copy `listing/chrome-description.txt` and `listing/release-notes.txt`.
4. Upload the 128×128 icon, 440×280 small promo tile, optional 1400×560 marquee promo tile, and all five numbered 1280×800 screenshots from `listing/assets/` in order.
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

## Firefox Add-ons (AMO)

1. Confirm the required hosted Firefox job passed `node scripts/run-firefox-fixtures.js --require-browser` at the exact release SHA, including its shared checkout/attribution matrix, exact-runtime temporary install, optional-origin denial, approved tampered-feed grant rollback, valid signed-feed retry/install, and production 720-minute alarm/origin cleanup.
2. Upload only the runtime ZIP through AMO's listed-extension flow; the manifest add-on ID must remain `@comb-djlacavera21`.
3. Copy the name/shared summary and the detailed text from `listing/firefox-description.txt`; use locale `en-US`, category slug `shopping`, and slug `comb-private-coupon-tester` if available.
4. Select a custom **MIT License** using `listing/LICENSE`, declare no required payment, and preserve `data_collection_permissions.required: ["none"]` with no optional data-collection category.
5. Upload the 128×128 icon and all five numbered 1280×800 screenshots in order using the captions in `listing/listing.json`.
6. Copy `listing/firefox-review-notes.md`, including the shared Chrome/Firefox creator URL/cookie contract, exact optional-origin explanation, and packaged prompt/alarm reproduction path.
7. Do not describe the repository ZIP as signed. AMO review/signing supplies the installable Firefox package.
8. Record the AMO add-on GUID/ID, version ID, submitted version, and exact official state. Only state `public`, with an official `addons.mozilla.org` listing URL, may set public availability to true.

Store publication supplies the installable signature. Neither ZIP in this kit should be described as developer-signed.

Record each store's submission ID, review state, approval date, public listing URL, and deployed version separately. A GitHub release alone does not mean Comb is available in any browser store.
