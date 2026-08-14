# Comb v0.7 Public Security and Creator-Attribution Review

Review date: August 14, 2026<br>
Scope: Comb v0.7 runtime, permissions, checkout transaction, signed-feed updater, compatibility-report boundary, machine support matrix, store disclosures, and release tooling<br>
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
| Can a support report leak live checkout values automatically? | No. Reports are user-triggered local downloads built from a new allowlisted object; there is no upload path. | Unit secret-injection test, real-Chrome serialization contract, static schema/disclosure checks. |
| Can fixture claims drift away from executed browser coverage? | No checked-in HTML fixture may be omitted or duplicated, and browser happy paths read their expectations directly from the versioned matrix. | Matrix validator, negative unit tests, and required real-Chrome suite. |
| Can a release tag point somewhere other than the authorized green `main` commit? | The manual workflow accepts only one full SHA equal to checked-out `HEAD` and current `origin/main`, rejects version/tag drift, and passes that SHA to release creation after rerunning every gate. | Release-candidate unit tests, workflow static checks, artifact checksum verifier, and publication post-check. |

## Creator Attribution Guarantee regression

The tagging issue is treated as a release-blocking product contract, not marketing copy. The required browser suite:

1. opens a sanitized checkout with `affiliate_id=creator-42&utm_source=creator` in the URL;
2. sets a synthetic `creator_attribution=creator-42` cookie;
3. runs three coupon attempts and reapplies the best verified code;
4. asserts that the exact URL and cookie strings are unchanged; and
5. asserts the checkout purchase control received zero clicks.

Static validation separately rejects packaged cookie APIs, `document.cookie`, URL/history mutation, navigation, tab creation/update, request interception, declarative rewriting, dynamic code evaluation, and remote package resources. Both layers must pass. This demonstrates the Comb implementation boundary; it does not make claims about a merchant's private accounting rules when a merchant independently associates a coupon token with a campaign.

## v0.7 verification matrix

| Boundary | Coverage |
| --- | --- |
| Checkout platforms | Twelve exact synthetic contracts in `tests/fixtures/support-matrix.json`: WooCommerce Blocks, localized WooCommerce classic, BigCommerce Cornerstone, two Shopify-style themes, conservative generic pages, and five safe-stop cases. |
| Locale/currency | `en-US` USD, `es-MX` MXN, `de-DE` EUR, `de-CH` CHF, and right-to-left `ar-AE` AED with localized digits. |
| Totals | Payable total distinguished from subtotal, tax, shipping, savings, and item-count text. |
| Safe failure | Ambiguous controls, pre-existing coupon, failed removal, marker-only removal without total restoration, and mid-run currency drift. |
| Attribution | Synthetic creator query tags and attribution cookie remain unchanged through a full coupon transaction. |
| UI access | Popup/settings keyboard order, visible focus, accessible names, native import controls, progress semantics, and reduced motion. |
| Compatibility intake | Allowlisted adapter/reason/boolean report; secret-looking URL, hostname, page, code, total, currency, cookie, affiliate, and creator values excluded. |
| Feed trust | Signature, expiry, strict schema, bounded size/lifetime, signer/feed pinning, rollback/substitution, origin policy, and serialized mutations. |
| Store handoff | Copy-ready Chrome/Edge metadata, conservative on-device data categories, Limited Use commitments, exact assets, and deterministic reviewer kit. |
| Independent review | Commit-pinned, public-evidence-only guide and issue form; live checkout uploads and inflated audit/certification claims are explicitly rejected. |
| Release publication | Manual full-SHA/version/creator-attribution authorization, current-`main` equality, absent tag, complete gate rerun, exact four-asset checksum verification, and post-publication tag/asset checks. |

## Reproduce the review

Use Node 22 or newer and a Chrome-family browser:

```bash
npm run lint
npm test
node scripts/run-browser-fixtures.js --require-browser
npm run release:build
```

The first command validates the machine support matrix, runtime, workflow boundary, and submission disclosures. Unit tests cover the checkout engine, feed verifier, approved-source policy, background update state, support matrix, release candidate, and release assets. The browser command runs the executed checkout/attribution/accessibility contracts. The final command builds the runtime package and outer review kit twice and requires byte equality before writing SHA-256 sidecars.

## Residual risks and limits

- Merchant markup can change after release. Sanitized fixtures model contracts, not every live checkout.
- A merchant can block extension injection, place checkout controls in inaccessible cross-origin frames, or expose no safe coupon-removal path. Comb stops rather than bypassing those controls.
- Shipping discounts may remain unmeasurable before an address and method are chosen.
- Comb cannot see protected/HttpOnly attribution cookies. Protection comes from lacking mutation/navigation mechanisms and affiliate incentive, not from reading the cookie.
- A user can hand-edit a downloaded report or accidentally add sensitive text to an issue. The issue form requires a privacy acknowledgement and forbids live captures, but public sharing remains the user's separate action.
- An optional feed operator can observe ordinary network metadata for a user-requested connection. Comb cannot hide the user's IP from that selected server.
- Local browser storage inherits the confidentiality and device-access properties of the user's browser profile.
- Dependency-free static scanning and synthetic browser tests reduce attack surface but do not prove absence of all defects.
- A manual GitHub release run can prove repository/tag/artifact consistency but does not publish the extension in a browser store; Chrome and Edge review remain separate account actions.

Independent reviewers can follow [INDEPENDENT_REVIEW.md](INDEPENDENT_REVIEW.md). Security reports must be sanitized: follow [../SECURITY.md](../SECURITY.md) and never publish active checkout URLs, cookies, addresses, payment data, order details, or creator identifiers.
