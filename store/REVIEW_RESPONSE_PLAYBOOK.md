# Comb v0.7 Store-Review Response Playbook

Use this playbook to answer Chrome Web Store or Microsoft Edge Add-ons questions without weakening the reviewed product boundary. Tailor the greeting and reviewer-specific reference, but keep technical claims exact.

## Single purpose and page access

Comb tests user-provided or signature-verified coupon tokens on the active checkout and preserves the best measurable discount. `activeTab` and `scripting` are used only after the user opens the popup; there is no static content script or permanent shopping-site host access.

## Creator attribution

The creator-tagging issue is fixed by architecture. Comb has no affiliate identity and does not navigate, redirect, intercept requests, mutate URL/referral parameters, or read/write attribution cookies. Existing creator affiliate tags, referral parameters, and cookies stay untouched so the original creator can keep proper attribution. Required CI verifies a synthetic creator-tagged URL and attribution cookie remain byte-for-byte unchanged through a complete coupon run.

## Optional feed permission

The broad-looking optional HTTPS declaration enables an origin-specific browser prompt only after the user enters a public signed-feed URL. No host is granted at install time. The service worker requests the exact origin, sends one bounded credential-free/referrer-free JSON request, rejects redirects, and installs only a signature/schema/expiry/pin/rollback-valid code-only envelope.

## Local data and safe report

Checkout detection and coupon testing happen on-device. The Comb developer receives no merchant history, checkout content, totals, coupon outcomes, creator tags, identity, or payment/order data. The v0.7 compatibility report is user-triggered and saved locally; it is not uploaded. Its fixed schema omits hostname/URL, page content/selectors, coupon codes, total/currency values, cookies, and creator tags.

## Unknown checkout markup

Comb deliberately stops when it cannot identify one coupon input, one coupon-specific Apply control, and one reliable payable total, or when checkout restoration cannot be verified. It does not use purchase controls as a fallback and does not click place-order/payment controls.

## Remote code

Select **No, I am not using remote code**. All JavaScript and CSS is packaged in the submitted ZIP. Signed feeds are strict inert JSON coupon data and cannot contain scripts, URLs, selectors, or remotely evaluated configuration.

## Evidence to attach

Provide the deterministic runtime checksum, public security review, Creator Attribution Guarantee, machine support matrix, independent-review guide, publication-status record, privacy policy, manifest snapshot, required CI URL, and exact GitHub release SHA. Never send a live checkout capture or user report to a store reviewer.
