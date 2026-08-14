# Chrome Web Store Listing Draft

## Name

Comb — Private Coupon Tester

## Short description

Try coupon codes locally, keep the best verified discount, and preserve creator attribution.

## Detailed description

Comb is an open-source, privacy-first coupon tester. Open it on a checkout page, enter coupon codes, and Comb will test them one at a time against the payable total. When the checkout exposes a safe coupon-removal control, Comb restores the best verified code at the end.

### Creator Attribution Guarantee

If a creator sent you to a store, the creator should keep the credit. Comb v0.3 has no affiliate program. It does not append or replace affiliate tags, change attribution cookies, redirect you through a Comb link, open hidden merchant tabs, or claim last-click commission. Signed community feeds contain coupon tokens only; their schema rejects affiliate and referral metadata.

### Privacy by architecture

- No account.
- No analytics or advertising SDK.
- No browsing-history permission.
- No install-time access to shopping sites.
- No remote code, Comb server, default feed, analytics, or outcome upload in v0.3.
- Merchant coupon lists stay in local extension storage and can be exported or erased.
- Community feeds can be imported manually and become eligible only after their signature verifies against a public key the user explicitly trusts.
- Optional updates remain off until the user supplies a public HTTPS feed URL and grants that exact origin through Chrome's runtime prompt.
- Connected-source requests omit credentials and referrers, reject redirects, carry no checkout data, and must pass the same signature and code-only schema checks.

### Safe checkout boundary

Comb selects only coupon-specific fields and Apply/Remove controls. It does not click payment, purchase, checkout, or place-order controls. If a page is ambiguous or a tested coupon cannot be removed safely, Comb stops and asks the shopper to review the checkout.

Comb is early software. Always review the coupon, payable total, and checkout before placing an order.

## Single purpose

Comb tests user-provided or signature-verified coupon codes on the current checkout and preserves the best measurable discount without changing creator affiliate attribution.

## Permission justifications

| Permission | Justification |
| --- | --- |
| `activeTab` | Temporarily inspect the checkout only after the user clicks Comb. |
| `alarms` | Check only the signed-feed sources a user has explicitly connected, approximately twice daily while the browser can run the task. |
| `scripting` | Inject the packaged, local coupon engine into that temporarily authorized tab. |
| `storage` | Save local coupon lists, trusted public keys, signed feeds, and approved-source settings on the device. |
| Optional HTTPS origin | Retrieve inert signed-feed JSON from one public origin only after the user approves Chrome's runtime prompt. No origin is granted at installation. |

## Data-use disclosure

Comb v0.3 does not collect or upload checkout data. It stores merchant hostnames, user-entered coupon tokens, explicitly trusted public keys, signed coupon-feed data, and approved source settings locally. During a run it temporarily reads coupon-control labels, coupon-specific result messages, and displayed totals inside the active tab. It does not read payment details, addresses, identities, cookies, browsing history, or merchant network traffic.

If the user connects a source, Comb makes a credential-free HTTPS `GET` to that exact URL on connection, on **Check now**, and approximately twice daily. It sends no merchant history, checkout URL, coupon outcomes, creator tags, or identity. The feed operator can ordinarily observe network-level details such as request time and IP address.

## v0.3 release notes

- Local sequential coupon testing.
- WooCommerce, Shopify-style, and conservative generic adapters.
- Best-code restoration and existing-coupon safety gate.
- Local coupon library with JSON export/import.
- Explicit public-key trust and local ECDSA P-256 signature verification.
- Strict, expiring code-only feeds with rollback, substitution, cross-publisher, and tamper protection.
- Freshness and outcome-based community-code ranking with manual offline import.
- Runtime-approved HTTPS feed sources with no default server or install-time origin grant.
- Credential-free, referrer-free, redirect-free, 2 MiB-bounded source checks.
- Signer/feed-ID pinning, scheduled higher-sequence updates, and origin permission cleanup.
- Expired-feed sequence retention closes a rollback window without exposing expired codes.
- Creator Attribution Guarantee with automated build enforcement.
- Synthetic checkout demo, offline feed-signing tools, and dependency-free verification suite.
