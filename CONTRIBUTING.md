# Contributing to Comb

Comb handles checkout pages, so conservative behavior, creator attribution, and privacy are release requirements rather than optional polish.

## Before opening a change

1. Create a focused branch.
2. Add or update a synthetic checkout fixture for selector changes.
3. Run `npm run check`.
4. Manually load the unpacked extension and run the demo checkout.

## Adapter rules

- Prefer stable semantic attributes over generated class names.
- Never select purchase, payment, submit-order, checkout, or cart-item removal controls.
- A removal selector must identify a coupon or discount specifically.
- If state cannot be restored safely, stop the run and explain why.
- Do not add remote scripts, remotely evaluated configuration, or hidden network calls.

## Creator-attribution rules

- Never add or replace affiliate/referral URL parameters.
- Never write, clear, inspect, or replace affiliate cookies.
- Never open background or hidden referral tabs.
- Never add a Comb affiliate identity to coupon metadata.
- A future monetization proposal must preserve pre-existing creator attribution and requires a separately reviewed architecture and prominent disclosure before any implementation.

## Signed-feed rules

- Feed schema changes require security review and new tamper/rollback tests.
- Entries remain code-only: exact merchant hostname, coupon token, verification time, and aggregate outcome counts.
- Do not add URLs, scripts, conditions that behave as executable logic, affiliate IDs, referral IDs, publisher sub-IDs, or opaque metadata.
- Never commit a feed private key. Public trust keys and signed feed fixtures are allowed only when their purpose and trust status are explicit.
- A sequence number must increase whenever signed payload content changes.
- Key rotation requires a new explicitly imported public key; v0.2 does not silently delegate trust.

## Privacy rules

Never commit real checkout captures. Fixtures must use invented names, products, domains, totals, codes, and order data. Bug reports should include only the minimum sanitized markup needed to reproduce selector behavior.

## Commit style

Use an imperative, scoped summary such as:

```text
Add WooCommerce coupon removal fixture
```
