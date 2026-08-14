# Comb Compatibility Reporting

Comb v0.6 adds a user-triggered compatibility report for checkouts that are not recognized or stop safely. The report is generated locally only when the user chooses **Save safe report**. Comb does not upload it, open an issue, contact the developer, or add a network permission.

## Exact report boundary

`comb.compatibility-report/v1` contains only:

- the Comb version and report timestamp;
- an allowlisted adapter identifier or `unknown`;
- an allowlisted safe-stop reason or `unknown_markup`;
- booleans for whether a coupon input, Apply control, payable total, or existing coupon was detected;
- the zero-affiliate Creator Attribution Guarantee; and
- explicit flags showing that automatic upload and sensitive fields are absent.

It never contains the merchant hostname or URL, DOM labels/selectors, page text or source, coupon tokens, amounts, currency values, cookies, affiliate/referral tags, or creator identifiers. The generator constructs a new allowlisted object; it does not redact a checkout capture. Tests inject secret-looking values into every excluded field and fail if any reaches the serialized report.

## How to report an incompatibility

1. Open Comb on the affected checkout and choose **Save safe report**.
2. Inspect `comb-compatibility-report.json`; it should match the boundary above.
3. Open the repository's **Checkout compatibility report** issue form.
4. Paste the generated JSON and supply only a generic platform/theme version if known.
5. Describe any reproduction with invented labels, products, codes, totals, and identities.

Never attach a screenshot, HAR file, checkout URL, live HTML, cookie export, console dump, order data, payment data, address, account identifier, affiliate tag, or creator identifier. If a security issue cannot be explained without sensitive data, use GitHub private vulnerability reporting and minimize it there as well.

## Executed support matrix

The required real-Chrome suite runs synthetic, local-only fixtures. A checked row means the adapter must find one unambiguous input, one safe Apply control, and one payable total; preserve the purchase control; restore the checkout between attempts; and keep creator attribution unchanged where noted.

| Contract | Adapter | Locale / currency | Required behavior |
| --- | --- | --- | --- |
| WooCommerce Blocks | `woocommerce` | en-US / USD | Apply, verified removal, best-code restoration |
| WooCommerce classic | `woocommerce` | es-MX / MXN | Localized total with shipping and tax separated |
| Shopify-style | `shopify` | en-US / USD | Apply, verified removal, best-code restoration |
| Shopify-style Swiss | `shopify` | de-CH / CHF | Apostrophe grouping and localized total |
| BigCommerce Cornerstone | `bigcommerce` | de-DE / EUR | Decimal grouping and localized total |
| Generic RTL | `generic` | ar-AE / AED | Right-to-left digits and payable-total selection |
| Generic creator-tagged | `generic` | en-US / USD | URL tags and attribution cookie unchanged byte-for-byte |
| Ambiguous Apply controls | safe stop | synthetic | Refuse purchase/control ambiguity; zero purchase clicks |
| Existing coupon | safe stop | synthetic | Refuse stacking or replacement |
| Failed removal | safe stop | synthetic | Stop after one code; do not stack |
| Restoration mismatch | safe stop | synthetic | Do not claim an unverified applied code |
| Currency drift | safe stop | synthetic | Stop before another attempt |

This matrix is evidence of bounded contracts, not a claim that every live merchant or theme is supported. A new platform/theme version becomes supported only after a sanitized synthetic fixture and safe-failure assertions land in the required suite.
