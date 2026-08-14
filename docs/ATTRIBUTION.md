# Creator Attribution Guarantee

## Why Comb makes this explicit

Creator lawsuits and public reporting alleged that Honey replaced pre-existing affiliate identifiers with its own near checkout, potentially moving commission away from the creator who made the referral. Those are litigated allegations, not a premise Comb needs a court to resolve. Comb fixes the underlying trust problem structurally: it has no affiliate identity and no code path capable of creating a competing referral event. See the [consolidated complaint](https://www.cohenmilstein.com/wp-content/uploads/2025/01/Second-Amended-Consolidated-Complaint-In-re-PayPal-Honey-Browser-Extension-01052026.pdf) for the allegations and the [Chrome Web Store affiliate policy](https://developer.chrome.com/docs/webstore/program-policies/affiliate-ads) for the platform rule.

The result is simple: using Comb does not make Comb the last affiliate click.

## The invariant

Comb must not take referral credit away from the creator, publisher, organization, or person who sent the shopper to a merchant.

For v0.1, this is a strict zero-affiliate design:

- Comb has no affiliate ID and earns no checkout commission.
- Comb never changes the page URL or its query parameters.
- Comb never creates, changes, or deletes cookies.
- Comb never opens a merchant or affiliate URL in another tab, frame, popup, or background request.
- Comb never intercepts or redirects merchant traffic.
- Comb only enters a user-visible coupon token into the merchant's existing coupon field after an explicit click on **Try codes**.

This preserves the shopper's existing referral path because Comb does not create a later competing referral event.

## Product disclosure

The popup displays **Creator attribution protected** on every checkout. The README and eventual store listing use the same plain-language guarantee. Comb will not hide monetization in terms of service or a privacy-policy footnote.

## Mechanical enforcement

`scripts/validate-extension.js` fails the build if:

- the manifest requests `cookies`, `webRequest`, `webRequestBlocking`, `declarativeNetRequest`, or permanent host access;
- packaged source uses URL-navigation or history-rewrite APIs;
- packaged source reads or writes `document.cookie`;
- packaged source opens a new tab/window or calls a redirect API;
- affiliate/referral mutation logic appears in executable source.

Repository review remains necessary—the validator is a guardrail, not a proof—but a future change cannot casually introduce these behaviors while keeping CI green.

## Coupon-code nuance

A merchant may internally associate a public coupon code with a campaign. Comb cannot control a merchant's private attribution rules. To prevent Comb itself from becoming the competing affiliate:

- v0.1 codes are supplied by the shopper and stored locally;
- entries are code tokens, not URLs;
- Comb attaches no publisher, sub-ID, click ID, network ID, or commission metadata;
- future community-feed entries must remain non-executable and affiliate-neutral.

## Future monetization rule

Comb must never silently switch from this guarantee to last-click affiliate monetization. Any future revenue model must be separately designed so pre-existing creator attribution stands down unconditionally. It would require:

1. a public architecture proposal;
2. prominent pre-install and in-product disclosure;
3. explicit per-event user action where required;
4. a verifiable direct user benefit;
5. no replacement of a pre-existing creator or publisher ID;
6. compliance with current browser-store affiliate policies.

Until all six conditions are met and independently reviewable, the codebase remains zero-affiliate.
