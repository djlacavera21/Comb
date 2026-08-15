# Comb Support Triage

Support work must preserve the checkout, user privacy, and the Creator Attribution Guarantee before optimizing detection coverage.

## Intake gates

Close or move a report out of a public issue immediately if it contains live checkout data. Ask the reporter to remove the material from Git history where possible and continue only with a synthetic reproduction. Do not copy sensitive content into comments, fixtures, or local notes.

A valid compatibility issue includes the generated `comb.compatibility-report/v1` object, Comb/browser versions, a generic platform/theme version when known, and invented reproduction notes. It must not include screenshots, checkout captures, URLs, hostnames, page source, cookies, codes, totals, identities, payments, orders, affiliate tags, or creator identifiers.

## Priority lanes

| Priority | Trigger | First response |
| --- | --- | --- |
| P0 private security | Code execution, secret exposure, unauthorized transmission, or purchase action | Request/enable a private channel before collecting details; do not reproduce on a live checkout |
| P0 attribution | Any evidence Comb changed a URL tag, referral parameter, cookie, or opened a competing referral path | Stop release; preserve the report privately; rerun static and creator-tagged browser contracts |
| P1 state safety | Coupon stacking, removal without baseline restoration, currency drift ignored, or purchase control touched | Stop the affected adapter; add a synthetic failing contract before a fix |
| P2 compatibility | Unknown markup or conservative false negative with no checkout mutation | Classify adapter/theme version; add a sanitized fixture; retain safe stop until verified |
| P3 usability | Copy, focus, layout, or non-destructive reporting issue | Reproduce in popup/settings browser contract and fix without expanding permissions |

## Adapter change gate

Every compatibility fix needs a synthetic fixture with invented data, an expected adapter ID, total/currency assertions, apply/removal counts, zero purchase clicks, and a safe-failure case for nearby ambiguous markup. If attribution-sensitive code changes, the creator-tagged URL/cookie contract must remain byte-for-byte unchanged.

Do not accept a selector learned only from a live capture. Prefer public platform semantics or synthetic markup that demonstrates the smallest stable contract. Use the report-to-proposal separation in [SYNTHETIC_FIXTURES.md](SYNTHETIC_FIXTURES.md); only allowlisted coarse signals may cross into the independently authored fixture process. Unknown theme versions remain unsupported until the fixture passes locally and in required CI.
