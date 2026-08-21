# Comb v0.8 Browser Store Submission Record

The copy-ready Chrome Web Store, Microsoft Edge Add-ons, and Firefox Add-ons fields live in [`../store/listing.json`](../store/listing.json). `npm run lint` validates their version, text boundaries, permissions, privacy categories, Firefox no-external-collection metadata, license source, URLs, search-term limits, and exact PNG dimensions.

Current GitHub release and browser-store states are recorded separately in [PUBLICATION_STATUS.md](PUBLICATION_STATUS.md) and [`../store/publication-record.json`](../store/publication-record.json). Neither a green candidate nor a GitHub release is evidence of browser-store availability.

## Public message

> **The creator-tagging issue is fixed.** Comb leaves existing creator affiliate tags, referral parameters, and attribution cookies untouched so the original creator can keep proper attribution.

This is backed by required real-Chrome and real-Firefox checkout transactions, not just listing copy. Both runners execute one shared contract that preserves a synthetic creator-tagged URL and attribution cookie byte-for-byte while testing multiple coupons and restoring the winner. Firefox additionally temporary-installs the exact built ZIP and requires packaged startup with no pre-granted feed origin, real prompt denial, approved tampered-feed rejection with grant rollback, a credential-free/referrer-free valid signed-feed retry, verified installation, and production 12-hour alarm/origin cleanup. Static validation independently blocks cookie, traffic interception, navigation, URL/history mutation, and affiliate-rewrite capabilities.

## Copy-ready submission files

| Field | Source |
| --- | --- |
| Shared name, short description, category, URLs, purpose, permissions, privacy, assets | [`../store/listing.json`](../store/listing.json) |
| Chrome detailed description | [`../store/chrome-description.txt`](../store/chrome-description.txt) |
| Edge localized description | [`../store/edge-description.txt`](../store/edge-description.txt) |
| Firefox detailed description | [`../store/firefox-description.txt`](../store/firefox-description.txt) |
| Firefox reviewer notes | [`../store/firefox-review-notes.md`](../store/firefox-review-notes.md) |
| Firefox custom license source | [`../LICENSE`](../LICENSE) |
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

Chrome and Edge policy forms treat on-device processing as data handling. Those submissions therefore select these categories conservatively instead of claiming “no data.” Firefox separately declares `data_collection_permissions.required: ["none"]` because Comb does not collect and transmit this locally handled data outside the extension:

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
| `icons/comb-128.png` | 128×128 | Chrome and Firefox icon; meets Edge minimum |
| `store/assets/comb-store-logo-300.png` | 300×300 | Edge recommended logo |
| `store/assets/comb-small-promo-440x280.png` | 440×280 | Chrome small promo / Edge small tile |
| `store/assets/comb-marquee-promo-1400x560.png` | 1400×560 | Chrome optional marquee promo |
| `store/assets/comb-screenshot-01-1280x800.png` | 1280×800 | Coupon workflow and protected attribution |
| `store/assets/comb-screenshot-02-1280x800.png` | 1280×800 | Creator-tagging fix with unchanged synthetic URL and cookie evidence |
| `store/assets/comb-screenshot-03-1280x800.png` | 1280×800 | Measured results and the best verified code |
| `store/assets/comb-screenshot-04-1280x800.png` | 1280×800 | Trusted keys and signature-verified community feeds |
| `store/assets/comb-screenshot-05-1280x800.png` | 1280×800 | Safe stop and privacy-bounded compatibility reporting |

Editable SVG sources sit beside the generated promotional PNGs. The same five validated PNGs and captions are used for Chrome, Edge, and Firefox so the creator-attribution message cannot drift between listings; only those PNGs are placed in the review kit.

## Official policy references rechecked 2026-08-21

- [Chrome Web Store listing fields and assets](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Chrome Web Store image requirements](https://developer.chrome.com/docs/webstore/images)
- [Chrome Web Store privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Chrome Web Store user-data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Chrome Web Store privacy policy requirements](https://developer.chrome.com/docs/webstore/program-policies/privacy)
- [Chrome Web Store publication lifecycle](https://developer.chrome.com/docs/webstore/publish)
- [Chrome Web Store item states](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/ItemState)
- [Microsoft Edge Add-ons publication fields](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)
- [Microsoft Edge Add-ons submission states](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/submission-states)
- [Microsoft Edge extension developer policies](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies)
- [Mozilla AMO add-on creation, version, and status fields](https://mozilla.github.io/addons-server/topics/api/addons)
- [Mozilla AMO extension category slugs](https://mozilla.github.io/addons-server/topics/api/categories.html)
- [Mozilla AMO license choices](https://mozilla.github.io/addons-server/topics/api/licenses.html)
- [Firefox signing and data-collection manifest metadata](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)

Store dashboards can change after this review date. Recheck the official forms before submission and update both metadata and validator together if a requirement changes.
