# Comb v0.5 Public Security and Creator-Attribution Review

Review date: August 14, 2026  
Scope: Comb v0.5 runtime, permissions, checkout transaction, signed-feed updater, store disclosures, and release tooling  
Status: scoped repository self-review complete; no unresolved critical or high-severity finding identified in this scope

This is a transparent maintainer self-review, **not an external audit**, certification, penetration test, or guarantee that every merchant checkout will behave correctly. Store reviewers and independent contributors should verify the evidence below rather than relying on the status line.

## Release conclusions

| Question | Conclusion | Enforced evidence |
| --- | --- | --- |
| Can Comb replace a creator affiliate tag? | No packaged path navigates, redirects, edits URL/history, or intercepts requests. | Static forbidden-API scan plus creator URL and cookie real-Chrome contract. |
| Can Comb overwrite an attribution cookie? | No cookie permission or packaged cookie API/read/write path exists. | Manifest check, source scan, and byte-for-byte synthetic cookie assertion. |
| Can a feed introduce affiliate behavior or remote code? | No. Feed objects are signature-verified strict data with coupon tokens only. | Schema/tamper/rollback tests and single packaged fetch boundary. |
| Can Comb silently observe shopping sites? | No required host permission or content script exists. Checkout access follows an explicit toolbar invocation through `activeTab`. | Manifest and injection-boundary validation. |
| Can Comb place an order? | No order API exists and dangerous control labels are rejected. | Unit scoring tests and every checkout fixture's zero `dangerClicks` assertion. |
| Can one test coupon stack onto the next? | A new attempt starts only after coupon markers disappear and the original amount/currency return. | Removal-failure and restoration-mismatch stop contracts. |
| Do store disclosures cover local processing? | Yes. They conservatively declare displayed financial total, merchant hostname, and checkout/coupon website content even when kept on-device. | `store/listing.json`, privacy policy, and automated store validator. |
| Are release files reviewable? | Yes. The runtime ZIP has an exact allowlist, normalized metadata, a SHA-256 sidecar, and a repeated-build equality check. | Runtime builder plus deterministic outer review kit. |

## Creator Attribution Guarantee regression

The tagging issue is treated as a release-blocking product contract, not marketing copy. The required browser suite:

1. opens a sanitized checkout with `affiliate_id=creator-42&utm_source=creator` in the URL;
2. sets a synthetic `creator_attribution=creator-42` cookie;
3. runs three coupon attempts and reapplies the best verified code;
4. asserts that the exact URL and cookie strings are unchanged; and
5. asserts the checkout purchase control received zero clicks.

Static validation separately rejects packaged cookie APIs, `document.cookie`, URL/history mutation, navigation, tab creation/update, request interception, declarative rewriting, dynamic code evaluation, and remote package resources. Both layers must pass. This demonstrates the Comb implementation boundary; it does not make claims about a merchant's private accounting rules when a merchant independently associates a coupon token with a campaign.

## v0.5 verification matrix

| Boundary | Coverage |
| --- | --- |
| Checkout platforms | WooCommerce Blocks, localized WooCommerce classic, BigCommerce Cornerstone, two Shopify-style themes, and conservative generic pages. |
| Locale/currency | `en-US` USD, `es-MX` MXN, `de-DE` EUR, `de-CH` CHF, and right-to-left `ar-AE` AED with localized digits. |
| Totals | Payable total distinguished from subtotal, tax, shipping, savings, and item-count text. |
| Safe failure | Ambiguous controls, pre-existing coupon, failed removal, marker-only removal without total restoration, and mid-run currency drift. |
| Attribution | Synthetic creator query tags and attribution cookie remain unchanged through a full coupon transaction. |
| UI access | Popup/settings keyboard order, visible focus, accessible names, native import controls, progress semantics, and reduced motion. |
| Feed trust | Signature, expiry, strict schema, bounded size/lifetime, signer/feed pinning, rollback/substitution, origin policy, and serialized mutations. |
| Store handoff | Copy-ready Chrome/Edge metadata, conservative on-device data categories, Limited Use commitments, exact assets, and deterministic reviewer kit. |

## Reproduce the review

Use Node 22 or newer and a Chrome-family browser:

```bash
npm run lint
npm test
node scripts/run-browser-fixtures.js --require-browser
npm run release:build
```

The first command validates the runtime and submission disclosures. Unit tests cover the checkout engine, feed verifier, approved-source policy, and background update state. The browser command runs the executed checkout/attribution/accessibility contracts. The final command builds the runtime package and outer review kit twice and requires byte equality before writing SHA-256 sidecars.

## Residual risks and limits

- Merchant markup can change after release. Sanitized fixtures model contracts, not every live checkout.
- A merchant can block extension injection, place checkout controls in inaccessible cross-origin frames, or expose no safe coupon-removal path. Comb stops rather than bypassing those controls.
- Shipping discounts may remain unmeasurable before an address and method are chosen.
- Comb cannot see protected/HttpOnly attribution cookies. Protection comes from lacking mutation/navigation mechanisms and affiliate incentive, not from reading the cookie.
- An optional feed operator can observe ordinary network metadata for a user-requested connection. Comb cannot hide the user's IP from that selected server.
- Local browser storage inherits the confidentiality and device-access properties of the user's browser profile.
- Dependency-free static scanning and synthetic browser tests reduce attack surface but do not prove absence of all defects.

Security reports must be sanitized. Follow [../SECURITY.md](../SECURITY.md) and never publish active checkout URLs, cookies, addresses, payment data, order details, or creator identifiers.
