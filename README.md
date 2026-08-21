# Comb

**A privacy-first, creator-respecting, open-source coupon tester for Chrome, Edge, and Firefox.**

Comb is being built as a transparent alternative to Honey-style coupon extensions. It remains user-controlled: you open Comb on a checkout page, use your own codes or signature-verified community codes, and it tests them one at a time while preserving the best verified discount.

> Comb is early software. Review the detected cart total and coupon before placing an order. Comb never clicks a purchase, place-order, or payment button.

## Creator Attribution Guarantee

If a creator sent you to a store, the creator should keep the credit. **The creator-tagging issue is fixed in Comb:** this Honey-style replacement never appends or replaces an affiliate tag, writes an attribution cookie, opens a hidden referral tab, redirects the shopper through a Comb link, or claims last-click commission. Existing creator affiliate tags, referral parameters, and attribution cookies stay untouched so the original creator can keep proper attribution. The extension operates only on checkout controls already visible in the active tab.

This is enforced in the product, not merely promised in policy:

- the manifest has no cookie, web-request, traffic-redirection, or required shopping-site permission; optional feed-origin access is separately user-approved;
- Comb accepts coupon-code tokens, never affiliate URLs;
- the packaged-code validator rejects attribution-changing browser APIs and URL/cookie mutation patterns;
- the popup displays **Creator attribution protected** during every run;
- required real-Chrome and real-Firefox CI run the same full coupon transaction on a synthetic creator-tagged checkout and verify that both its URL tags and attribution cookie are byte-for-byte unchanged; and
- the public store copy, privacy policy, reviewer notes, and security review all carry the same exact guarantee.

See [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md) for the invariant and its limits.

## Released v0.7 baseline

- Detects coupon fields, apply buttons, totals, and existing coupons.
- Includes targeted adapters for WooCommerce classic/Blocks, BigCommerce Cornerstone, and Shopify-style checkouts plus a conservative generic adapter.
- Tests codes sequentially and compares the actual cart total after each attempt.
- Removes test coupons between attempts only when a coupon-specific control exists, then verifies that coupon markers disappeared and the original amount and currency returned.
- Reapplies the best verified code at the end.
- Stops early rather than risk stacking or replacing a discount when Comb cannot safely remove a tested code.
- Stores coupon lists locally by merchant.
- Imports ECDSA P-256 signed community coupon feeds after the user explicitly trusts the publisher's public key.
- Rejects feed tampering, expiry, rollback, same-sequence substitution, duplicate codes, affiliate fields, referral URLs, scripts, and arbitrary metadata.
- Ranks signed-feed candidates using recent verification time and aggregate success/failure counts.
- Optionally retrieves an updated signed feed from one public HTTPS origin the user approves through Chrome's runtime permission prompt.
- Pins each approved source to its original feed ID and signing key, rejects redirects, omits credentials and referrers, enforces a 2 MiB limit, and checks for valid higher sequences about twice daily.
- Keeps expired signed sequence history for rollback protection while excluding expired codes from checkout.
- Parses regional grouping, decimal separators, Arabic/Persian/full-width digits, and a broader currency set; currency changes during a run trigger a safe stop.
- Runs sanitized adapter, no-stacking, purchase-control refusal, creator URL/cookie preservation, and keyboard contracts in real headless Chrome during CI.
- Binds every synthetic HTML fixture to a strict machine-readable support record with a public-contract snapshot, expected state/click counts, and exact version.
- Saves a user-triggered compatibility report whose allowlisted schema omits merchant URLs/hostnames, page content/selectors, codes, totals/currencies, cookies, and creator tags; Comb never uploads it.
- Exercises localized MXN, EUR, CHF, AED, and USD checkouts, including right-to-left digits and separate subtotal, shipping, tax, and payable-total rows.
- Provides keyboard-visible native import controls, an announced progress bar, result focus management, and reduced-motion support.
- Validates copy-ready Chrome Web Store and Edge Add-ons listing fields, conservative local data-use disclosures, Limited Use commitments, reviewer notes, and exact image dimensions.
- Produces a deterministic runtime ZIP plus a deterministic store review kit with SHA-256 sidecars, then uploads all four files from successful CI.
- Provides a public-evidence-only independent-review path and a manual release workflow that rejects version, commit, tag, checksum, test, or creator-attribution authorization drift before publication.
- Uses the browser's temporary `activeTab` access instead of permanent access to every website.
- Includes a local demo checkout and dependency-free automated tests.

## v0.8 development

- Adds a Magento Open Source / Adobe Commerce adapter for the public Luma cart and checkout coupon contracts. Narrow form markers take priority over the overlapping WooCommerce `coupon_code` field, and synthetic Italian/French EUR contracts verify removal, baseline restoration, best-code reapplication, and zero purchase clicks.
- Adds a searchable, local-only community coupon catalog in Comb settings. Users can search installed signature-verified feeds by merchant, code, publisher, or public-key fingerprint; filter active and expired data; and inspect ranking, freshness, aggregate outcomes, sequence, expiry, and publisher provenance.
- Keeps catalog queries inside the extension. Searching does not contact a feed operator, upload a term, add a browsing-history database, or introduce affiliate URLs, remote code, or outcome telemetry.
- Adds the optional 1400×560 Chrome marquee artwork alongside the complete five-screenshot store set.
- Adds one permission-equivalent Manifest V3 runtime for Chrome 121+, Edge, and Firefox 128+ desktop, with a dual background declaration and native `browser`/`chrome` API selection.
- Adds a no-npm-dependency geckodriver runner that executes the same checkout, safe-stop, purchase-control, and creator URL/cookie contracts in real Firefox. It also builds and temporary-installs the exact runtime ZIP, verifies background startup with no pre-granted feed origin, drives prompt denial, rejects a deliberately tampered signed feed after approval while rolling back its new origin grant, then approves and installs the valid in-memory feed through an isolated synthetic HTTPS endpoint. The gate checks that both requests omit cookies and referrers and proves the production alarm and unused origin grant are cleared with the source. Verification and release CI require the complete gate.
- Upgrades the fail-closed publication record with official AMO states and adds validated Firefox listing, license, screenshot, privacy, and reviewer materials. Firefox remains unsigned and unavailable until the hosted gate succeeds at a releasable commit and Mozilla review/signing completes.

## Privacy model

The current Comb build has no backend, analytics, affiliate links, accounts, tracking, or remote code. It does handle limited data on-device: the current merchant hostname, coupon tokens, visible coupon controls/messages, and displayed payable amount/currency. The developer receives none of that checkout data. Store disclosures conservatively select the corresponding Web history, Website content, and Financial/payment categories even though the processing stays local.

The optional **Save safe report** action creates a local JSON file only after a user chooses it. It extracts coarse allowlisted detection signals rather than redacting a checkout capture, and it makes no request. See [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).

Signed feeds are inert JSON and are never executed. Network feed updates are off until the user connects a public HTTPS URL and grants that exact origin; requests carry no cookies, credentials, referrer, checkout data, merchant history, or outcomes. Comb does not request browsing-history access or install-time access to shopping sites. Checkout-page access begins only after you click the extension while viewing a checkout and ends when that temporary `activeTab` grant expires.

See [docs/PRIVACY.md](docs/PRIVACY.md) for the precise data boundaries.

## Publication status

The current source is v0.8 development: it is unreleased and explicitly blocked from browser-store submission. The earlier verified v0.7 build remains published as the immutable GitHub release [`v0.7.0`](https://github.com/djlacavera21/Comb/releases/tag/v0.7.0), pinned to the green source commit after the creator-attribution release gate and real-Chrome preservation contract passed. Neither version has been submitted to Chrome Web Store, Microsoft Edge Add-ons, or Firefox Add-ons, so Comb is not yet publicly available from any browser store. [docs/PUBLICATION_STATUS.md](docs/PUBLICATION_STATUS.md) and the machine-validated [`store/publication-record.json`](store/publication-record.json) keep the development build, latest verified release, four historical asset checksums, and official store states separate.

## Install the extension locally

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome, Chromium, Brave, or Edge.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this repository's root folder.
5. Open a checkout page, click the Comb icon, enter one or more codes, and select **Try codes**.

Comb cannot run on browser-internal pages such as `chrome://extensions`.

Firefox temporary-install instructions and the explicit pre-AMO limitations are in [docs/FIREFOX.md](docs/FIREFOX.md).

## Run the safe demo

```bash
npm run demo
```

Then open `http://127.0.0.1:4173/demo/checkout.html`, click Comb, and try:

```text
SAVE10
WELCOME20
FREESHIP
NOTREAL
```

`WELCOME20` should win on the demo cart.

## Verify the project

```bash
npm test
npm run check
npm run release:build
```

The project has no npm runtime or development dependencies and uses Node 22 or newer for its Chrome DevTools and Firefox WebDriver transports. The validation script checks the manifest, packaged files, permission and creator-attribution boundaries, checkout restoration guardrails, signing-key leakage, accessibility hooks, and JavaScript syntax. `npm run check` runs Chrome and Firefox contracts when their local browser/driver binaries are installed; CI installs and requires both and cannot skip either gate. The complete packaged Firefox gate requires Firefox 138+, current geckodriver, and OpenSSL for a short-lived test-only certificate. Those automation requirements do not raise the extension's Firefox 128 minimum or add a runtime dependency.

`npm run release:build` writes `dist/comb-0.8.0.zip`, `dist/comb-0.8.0-store-review-kit.zip`, and their `.sha256` sidecars. Both archives are built twice to prove identical output. These remain development artifacts until the publication record identifies a verified v0.8 release and allows store submission; when authorized, only the minimal runtime ZIP is the extension upload. See [docs/RELEASE.md](docs/RELEASE.md).

## Publish or verify a signed feed

The publisher workflow remains offline. Generate a P-256 keypair outside the repository, sign a strict coupon payload, and distribute the public key separately from the signed feed:

```bash
node scripts/create-example-feed-payload.js /tmp/community.payload.json
node scripts/generate-feed-keypair.js /secure/path/comb-community "Comb Community"
node scripts/sign-feed.js /tmp/community.payload.json /secure/path/comb-community.private.json /tmp/community.signed.json
node scripts/verify-feed.js /tmp/community.signed.json /secure/path/comb-community.public.json
```

Keep the private key offline and outside source control. Import the `.public.json` trust key in Comb settings before importing the signed feed. The full wire format and rotation rules are in [docs/FEED_SPEC.md](docs/FEED_SPEC.md).

## Architecture

```text
Popup (user gesture)
  -> Manifest V3 background runtime
     -> local trust store -> signature + expiry + rollback verification
        -> ranked, affiliate-neutral community codes
     -> optional approved HTTPS origin -> bounded JSON -> same verifier
     -> temporary activeTab script injection
        -> checkout adapter + coupon test engine
     <- progress and verified totals
  <- saved local merchant codes + result
```

Detailed design notes are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Current limits

- Comb ships with no default feed or feed server. Manual import works offline; network updates require a trusted public key, a user-supplied HTTPS URL, and the browser's origin approval prompt.
- Feed checks are best-effort while the browser is running and may be delayed while a device sleeps.
- Checkout markup varies and can change without notice. The real-browser fixtures cover sanitized contracts, not every live merchant; the generic adapter deliberately refuses ambiguous pages.
- Some merchants block extensions, use cross-origin checkout frames, or do not expose a safe way to remove a coupon.
- Shipping-only discounts may not be measurable until an address and shipping method have been selected.
- Comb does not read protected or HttpOnly attribution cookies. Its guarantee comes from having no mechanism or financial incentive to change them—not from inspecting their value.
- The real-Firefox checkout and packaged-extension gates, AMO listing materials, and publication-state mapping are implemented, but this local source tree has not established a green hosted Firefox result for its exact commit. A verified release, explicit publication authorization, Mozilla review, and Mozilla signing remain pre-submission/publication gates.

## Roadmap

The machine support matrix, independent-review path, and controlled GitHub release workflow are shipped in v0.7. Browser-store dashboard submission and approval remain the next account-level milestone; Comb will not claim public availability before that occurs. Privacy-safe reports can inform new contracts only through the independently authored process in [docs/SYNTHETIC_FIXTURES.md](docs/SYNTHETIC_FIXTURES.md). Any outcome reporting remains a separate, strictly opt-in future decision. See [docs/ROADMAP.md](docs/ROADMAP.md).

## Contributing

Adapter fixes, synthetic checkout fixtures, and independent boundary reviews are especially welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md), and [docs/INDEPENDENT_REVIEW.md](docs/INDEPENDENT_REVIEW.md) before submitting changes. Never include real payment, identity, address, order, session, or creator-attribution data in a fixture or bug report.

## License

Comb is released under the [MIT License](LICENSE).
