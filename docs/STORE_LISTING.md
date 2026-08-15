# Comb v0.7 Browser Store Submission Record

The copy-ready Chrome Web Store and Microsoft Edge Add-ons fields live in [`../store/listing.json`](../store/listing.json). `npm run lint` validates their version, text boundaries, permissions, privacy categories, Limited Use commitments, URLs, search-term limits, and exact PNG dimensions.

Current GitHub release and browser-store states are recorded separately in [PUBLICATION_STATUS.md](PUBLICATION_STATUS.md) and [`../store/publication-record.json`](../store/publication-record.json). Neither a green candidate nor a GitHub release is evidence of browser-store availability.

## Public message

> **The creator-tagging issue is fixed.** Comb leaves existing creator affiliate tags, referral parameters, and attribution cookies untouched so the original creator can keep proper attribution.

This is backed by a required real-Chrome checkout transaction, not just listing copy. The test preserves a synthetic creator-tagged URL and attribution cookie byte-for-byte while testing multiple coupons and restoring the winner. Static validation independently blocks cookie, traffic interception, navigation, URL/history mutation, and affiliate-rewrite capabilities.

## Copy-ready submission files

| Field | Source |
| --- | --- |
| Shared name, short description, category, URLs, purpose, permissions, privacy, assets | [`../store/listing.json`](../store/listing.json) |
| Chrome detailed description | [`../store/chrome-description.txt`](../store/chrome-description.txt) |
| Edge localized description | [`../store/edge-description.txt`](../store/edge-description.txt) |
| Release notes | [`../store/release-notes.txt`](../store/release-notes.txt) |
| Certification/reviewer notes | [`../store/review-notes.md`](../store/review-notes.md) |
| Submission sequence | [`../store/SUBMISSION.md`](../store/SUBMISSION.md) |
| Store-review response playbook | [`../store/REVIEW_RESPONSE_PLAYBOOK.md`](../store/REVIEW_RESPONSE_PLAYBOOK.md) |
| Public privacy policy | [`PRIVACY.md`](PRIVACY.md) |
| Public security review | [`SECURITY_REVIEW.md`](SECURITY_REVIEW.md) |
| Compatibility-report boundary | [`COMPATIBILITY.md`](COMPATIBILITY.md) |
| Independent-review guide | [`INDEPENDENT_REVIEW.md`](INDEPENDENT_REVIEW.md) |

## Single purpose

Comb tests user-provided or signature-verified coupon codes on the current checkout and preserves the best measurable discount without changing creator affiliate attribution.

## Permission justifications

| Permission | Justification |
| --- | --- |
| `activeTab` | Temporarily inspect the checkout only after the user invokes Comb on that tab. |
| `alarms` | Run best-effort checks only for signed-feed sources the user explicitly connected. |
| `scripting` | Inject Comb's packaged coupon engine into that temporarily authorized tab. |
| `storage` | Keep merchant coupon lists, trusted public keys, verified feeds, and source settings on the device. |
| Optional HTTPS origin | Request one exact public feed origin at runtime only after the user enters its URL and approves the browser prompt. No site is granted at installation. |

Select **No remote code**. Signed community feeds are strict, bounded, signature-verified JSON. They cannot contain scripts, selectors, source URLs, referral metadata, or executable configuration.

## Data-use disclosure

Store policy treats on-device processing as data handling. The submission therefore selects these categories conservatively instead of claiming “no data”:

| Dashboard category | Local scope | Sent to Comb developer? |
| --- | --- | --- |
| Financial and payment information | Displayed payable amount and currency only, for the active run. | No |
| Web history | Current merchant hostname used to scope a saved local list; no browser-history API. | No |
| Website content | Coupon tokens, coupon-control labels, coupon-specific messages, and displayed total. | No |

If the user connects an optional public feed URL, that user-selected operator can ordinarily see the requested path, request time, IP address, and common network headers. Comb omits credentials and referrers and sends no checkout URL, merchant history, outcome, creator tag, identity, or payment data. The policy names that operator rather than hiding the network boundary.

All Limited Use commitments in `store/listing.json` remain release-blocking: no sale/unapproved transfer, unrelated use, credit/lending use, personalized advertising, or human reading outside narrow user-request/security/legal cases.

The popup's **Save safe report** action creates a local allowlisted JSON file only after a user gesture. It makes no request and omits merchant URL/hostname, page content/selectors, codes, totals/currency values, cookies, and creator tags. The developer receives none of it unless a user separately chooses to share the safe JSON.

## Validated upload assets

| Asset | Dimensions | Store use |
| --- | ---: | --- |
| `icons/comb-128.png` | 128×128 | Chrome icon; meets Edge minimum |
| `store/assets/comb-store-logo-300.png` | 300×300 | Edge recommended logo |
| `store/assets/comb-small-promo-440x280.png` | 440×280 | Chrome small promo / Edge small tile |
| `store/assets/comb-screenshot-01-1280x800.png` | 1280×800 | Chrome and Edge screenshot |

Editable SVG sources sit beside the generated promotional PNGs. Only the validated PNGs are placed in the review kit.

## Official policy references rechecked 2026-08-15

- [Chrome Web Store listing fields and assets](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Chrome Web Store privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Chrome Web Store user-data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Chrome Web Store privacy policy requirements](https://developer.chrome.com/docs/webstore/program-policies/privacy)
- [Chrome Web Store publication lifecycle](https://developer.chrome.com/docs/webstore/publish)
- [Chrome Web Store item states](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/ItemState)
- [Microsoft Edge Add-ons publication fields](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)
- [Microsoft Edge Add-ons submission states](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/submission-states)
- [Microsoft Edge extension developer policies](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies)

Store dashboards can change after this review date. Recheck the official forms before submission and update both metadata and validator together if a requirement changes.
