# Comb

**A privacy-first, creator-respecting, open-source coupon tester for Chrome and Edge.**

Comb is being built as a transparent alternative to Honey-style coupon extensions. It remains local and user-controlled: you open Comb on a checkout page, use your own codes or manually imported signature-verified community codes, and it tests them one at a time while preserving the best verified discount.

> Comb is early software. Review the detected cart total and coupon before placing an order. Comb never clicks a purchase, place-order, or payment button.

## Creator Attribution Guarantee

If a creator sent you to a store, the creator should keep the credit. Comb v0.2 has no affiliate program and never appends or replaces an affiliate tag, writes an attribution cookie, opens a hidden referral tab, redirects the shopper through a Comb link, or claims last-click commission. The extension operates only on the checkout controls already visible in the active tab.

This is enforced in the product, not merely promised in policy:

- the manifest has no cookie, web-request, traffic-redirection, or permanent site-access permission;
- Comb accepts coupon-code tokens, never affiliate URLs;
- the packaged-code validator rejects attribution-changing browser APIs and URL/cookie mutation patterns;
- the popup displays **Creator attribution protected** during every run.

See [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md) for the invariant and its limits.

## What works in v0.2

- Detects coupon fields, apply buttons, totals, and existing coupons.
- Includes targeted adapters for WooCommerce and Shopify-style checkouts plus a conservative generic adapter.
- Tests codes sequentially and compares the actual cart total after each attempt.
- Removes test coupons between attempts when the checkout exposes a safe coupon-removal control.
- Reapplies the best verified code at the end.
- Stops early rather than risk stacking or replacing a discount when Comb cannot safely remove a tested code.
- Stores coupon lists locally by merchant.
- Imports ECDSA P-256 signed community coupon feeds after the user explicitly trusts the publisher's public key.
- Rejects feed tampering, expiry, rollback, same-sequence substitution, duplicate codes, affiliate fields, referral URLs, scripts, and arbitrary metadata.
- Ranks signed-feed candidates using recent verification time and aggregate success/failure counts.
- Uses Chrome's temporary `activeTab` access instead of permanent access to every website.
- Includes a local demo checkout and dependency-free automated tests.

## Privacy model

Comb v0.2 has no backend, analytics, affiliate links, accounts, tracking, or remote code. Signed feeds are inert JSON files imported manually; they are never executed. Comb does not request browsing-history access or permanent host permissions. Page access begins only after you click the extension while viewing a checkout and ends when that temporary `activeTab` grant expires.

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
```

The project has no runtime or development dependencies. The validation script checks the manifest, packaged files, permission and creator-attribution boundaries, signing-key leakage, and JavaScript syntax.

## Publish or verify a signed feed

The v0.2 flow is deliberately offline. Generate a P-256 keypair outside the repository, sign a strict coupon payload, and distribute the public key separately from the signed feed:

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
     -> temporary activeTab script injection
        -> checkout adapter + coupon test engine
     <- progress and verified totals
  <- saved local merchant codes + result
```

Detailed design notes are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Current limits

- v0.2 feed distribution is manual and offline; automatic feed updates are not enabled yet.
- Checkout markup varies and can change without notice. The generic adapter deliberately refuses ambiguous pages.
- Some merchants block extensions, use cross-origin checkout frames, or do not expose a safe way to remove a coupon.
- Shipping-only discounts may not be measurable until an address and shipping method have been selected.
- Comb does not read protected or HttpOnly attribution cookies. Its guarantee comes from having no mechanism or financial incentive to change them—not from inspecting their value.
- Firefox packaging is planned but not included in the first Manifest V3 build.

## Roadmap

The next major target is optional automatic retrieval from an explicitly approved feed origin, followed by fixture-driven browser adapter coverage. Any outcome reporting remains a separate, strictly opt-in future decision. See [docs/ROADMAP.md](docs/ROADMAP.md).

## Contributing

Adapter fixes and checkout fixtures are especially welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes. Never include real payment, identity, address, order, session, or creator-attribution data in a fixture or bug report.

## License

Comb is released under the [MIT License](LICENSE).
