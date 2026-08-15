# Comb Compatibility Reporting

Comb v0.7 provides a user-triggered compatibility report for checkouts that are not recognized or stop safely. The report is generated locally only when the user chooses **Save safe report**. Comb does not upload it, open an issue, contact the developer, or add a network permission.

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

Never attach a screenshot, HAR file, checkout URL, live HTML, cookie export, console dump, order data, payment data, address, account identifier, affiliate tag, or creator identifier. If a security issue cannot be explained without sensitive data, follow [../SECURITY.md](../SECURITY.md): request a private channel without posting any details, and minimize the report after a private channel exists.

## Executed support matrix

[`../tests/fixtures/support-matrix.json`](../tests/fixtures/support-matrix.json) is the canonical machine-readable matrix. Validation requires every synthetic HTML fixture to appear exactly once, rejects remote resources and live hosts, pins the engine version, and permits only `generic.html` to own the creator-attribution preservation assertion. The required real-Chrome suite reads the matrix rather than maintaining a separate happy-path list.

The public platform and theme values are version labels for the public-contract snapshot and synthetic fixture—not claims that every deployment of that product version is supported. A passing row means the adapter must satisfy the listed local contract, preserve the purchase control, and keep creator attribution unchanged where noted.

The matrix `baseline` is the payable total visible when Comb scans the fixture. It matches the fixture's invented cart baseline except for the existing-coupon contract, which intentionally starts with an invented $10 discount and therefore exposes $122.95. Validation also derives `BEST20`, `SAVE10`, and `SHIPFREE` savings from the fixture baseline/shipping values so expected results cannot silently drift from the synthetic markup.

| Fixture contract | Adapter | Public snapshot / synthetic theme | Locale / currency | Required behavior |
| --- | --- | --- | --- | --- |
| WooCommerce Blocks | `woocommerce` | `public-contract-2026-08` / `blocks-synthetic-v1` | en-US / USD | Apply, verified removal, best-code restoration |
| WooCommerce classic | `woocommerce` | `public-contract-2026-08` / `classic-synthetic-v1` | es-MX / MXN | Localized total with shipping and tax separated |
| Shopify-style | `shopify` | `public-contract-2026-08` / `one-page-synthetic-v1` | en-US / USD | Apply, verified removal, best-code restoration |
| Shopify-style Swiss | `shopify` | `public-contract-2026-08` / `one-page-swiss-synthetic-v1` | de-CH / CHF | Localized payable total and restoration |
| BigCommerce Cornerstone | `bigcommerce` | `public-contract-2026-08` / `cornerstone-synthetic-v1` | de-DE / EUR | Decimal grouping and localized total |
| Generic RTL | `generic` | `comb-generic-contract-v1` / `rtl-arabic-synthetic-v1` | ar-AE / AED | Right-to-left digits and payable-total selection |
| Generic creator-tagged | `generic` | `comb-generic-contract-v1` / `creator-attribution-synthetic-v1` | en-US / USD | URL tags and attribution cookie unchanged byte-for-byte |
| Ambiguous Apply controls | `generic` safe stop | `comb-safety-contract-v1` / `ambiguous-controls-synthetic-v1` | en-US / USD | Refuse purchase/control ambiguity; zero purchase clicks |
| Existing coupon | `generic` safe stop | `comb-safety-contract-v1` / `existing-coupon-synthetic-v1` | en-US / USD | Refuse stacking or replacement |
| Failed removal | `generic` safe stop | `comb-safety-contract-v1` / `removal-failure-synthetic-v1` | en-US / USD | Stop after one code; do not stack |
| Restoration mismatch | `generic` safe stop | `comb-safety-contract-v1` / `restoration-mismatch-synthetic-v1` | en-US / USD | Do not claim an unverified applied code |
| Currency drift | `generic` safe stop | `comb-safety-contract-v1` / `currency-drift-synthetic-v1` | en-US / USD | Stop before another attempt |

This matrix is evidence of bounded contracts, not a claim that every live merchant or theme is supported. A new public platform/theme snapshot becomes supported only after a privacy-safe report informs an independently written synthetic fixture and its safety assertions land in the required suite. Live checkout captures never become fixtures.

The exact report-to-proposal separation process and offline scaffold are documented in [SYNTHETIC_FIXTURES.md](SYNTHETIC_FIXTURES.md). The scaffold accepts only the allowlisted report schema, discards its timestamp, emits invented placeholder values, and never generates or derives HTML.
