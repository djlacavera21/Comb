# Comb

**A privacy-first, creator-respecting, open-source coupon tester for Chrome and Edge.**

Comb is being built as a transparent alternative to Honey-style coupon extensions. It remains user-controlled: you open Comb on a checkout page, use your own codes or signature-verified community codes, and it tests them one at a time while preserving the best verified discount.

> Comb is early software. Review the detected cart total and coupon before placing an order. Comb never clicks a purchase, place-order, or payment button.

## Creator Attribution Guarantee

If a creator sent you to a store, the creator should keep the credit. Comb v0.4 has no affiliate program and never appends or replaces an affiliate tag, writes an attribution cookie, opens a hidden referral tab, redirects the shopper through a Comb link, or claims last-click commission. The extension operates only on the checkout controls already visible in the active tab.

This is enforced in the product, not merely promised in policy:

- the manifest has no cookie, web-request, traffic-redirection, or required shopping-site permission; optional feed-origin access is separately user-approved;
- Comb accepts coupon-code tokens, never affiliate URLs;
- the packaged-code validator rejects attribution-changing browser APIs and URL/cookie mutation patterns;
- the popup displays **Creator attribution protected** during every run.

See [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md) for the invariant and its limits.

## What works in v0.4

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
- Provides keyboard-visible native import controls, an announced progress bar, result focus management, and reduced-motion support.
- Produces a deterministic Chrome Web Store ZIP and SHA-256 sidecar, then uploads both from successful CI.
- Uses Chrome's temporary `activeTab` access instead of permanent access to every website.
- Includes a local demo checkout and dependency-free automated tests.

## Privacy model

Comb v0.4 has no backend, analytics, affiliate links, accounts, tracking, or remote code. Signed feeds are inert JSON and are never executed. Network feed updates are off until the user connects a public HTTPS URL and grants that exact origin; requests carry no cookies, credentials, referrer, checkout data, merchant history, or outcomes. Comb does not request browsing-history access or install-time access to shopping sites. Checkout-page access begins only after you click the extension while viewing a checkout and ends when that temporary `activeTab` grant expires.

See [docs/PRIVACY.md](docs/PRIVACY.md) for the precise data boundaries.

## Install the extension locally

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome, Chromium, Brave, or Edge.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this repository's root folder.
5. Open a checkout page, click the Comb icon, enter one or more codes, and select **Try codes**.

Comb cannot run on browser-internal pages such as `chrome://extensions`.

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

The project has no runtime or development dependencies and uses Node 22 or newer for its browser-test transport. The validation script checks the manifest, packaged files, permission and creator-attribution boundaries, checkout restoration guardrails, signing-key leakage, accessibility hooks, and JavaScript syntax. `npm run check` runs browser contracts when Chrome is installed; CI requires Chrome and cannot skip them.

`npm run release:build` writes `dist/comb-0.4.0.zip` and its `.sha256` sidecar, building twice to prove identical output. See [docs/RELEASE.md](docs/RELEASE.md).

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
  -> Manifest V3 service worker
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

- Comb ships with no default feed or feed server. Manual import works offline; network updates require a trusted public key, a user-supplied HTTPS URL, and Chrome's origin approval prompt.
- Feed checks are best-effort while the browser is running and may be delayed while a device sleeps.
- Checkout markup varies and can change without notice. The real-browser fixtures cover sanitized contracts, not every live merchant; the generic adapter deliberately refuses ambiguous pages.
- Some merchants block extensions, use cross-origin checkout frames, or do not expose a safe way to remove a coupon.
- Shipping-only discounts may not be measurable until an address and shipping method have been selected.
- Comb does not read protected or HttpOnly attribution cookies. Its guarantee comes from having no mechanism or financial incentive to change them—not from inspecting their value.
- Firefox packaging is planned but not included in the first Manifest V3 build.

## Roadmap

The next major target is store-submission hardening, a larger checkout/currency matrix, localization, and public security review. Any outcome reporting remains a separate, strictly opt-in future decision. See [docs/ROADMAP.md](docs/ROADMAP.md).

## Contributing

Adapter fixes and checkout fixtures are especially welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes. Never include real payment, identity, address, order, session, or creator-attribution data in a fixture or bug report.

## License

Comb is released under the [MIT License](LICENSE).
