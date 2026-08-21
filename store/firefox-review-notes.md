# Comb v0.8 Firefox reviewer notes

Comb has one purpose: test user-provided or signature-verified coupon tokens on the user-authorized active checkout and preserve the best measurable discount without changing creator affiliate attribution.

## Creator-attribution fix

The creator-tagging issue is fixed by architecture. Comb has no affiliate identity and contains no packaged path that navigates or redirects a merchant tab, rewrites URL/history, intercepts requests, or reads/writes cookies. The popup keeps **Creator attribution protected** visible.

The Chrome and Firefox runners execute the same shared checkout contract module. The creator-owned synthetic fixture opens with `affiliate_id=creator-42&utm_source=creator`, sets `creator_attribution=creator-42`, completes a multi-code coupon transaction, and requires both values to remain byte-for-byte unchanged. A failure blocks CI and release.

## Firefox manifest and permissions

- Add-on ID: `@comb-djlacavera21`.
- Minimum Firefox desktop version: 128.0.
- Required permissions: `activeTab`, `alarms`, `scripting`, and `storage`.
- Optional origin declaration: `https://*/*`, dormant until the user enters a signed-feed URL and approves that exact origin.
- No static content script or permanent shopping-site host permission.
- `data_collection_permissions.required` is exactly `none`; optional data-collection permissions are absent.

`activeTab` and `scripting` load only the packaged checkout engine after the user opens Comb. `storage` retains merchant-scoped coupon tokens, trusted public keys, verified feeds, and approved-source settings locally. `alarms` checks only sources the user already connected.

## Data and network boundary

The Comb developer receives no checkout URL, hostname, content, coupon code, total, outcome, creator tag, identity, or payment/order data. Comb has no account, developer backend, analytics, advertising, or automatic report upload.

If the user connects an optional public feed, the selected operator can ordinarily observe connection metadata for that request. Comb sends one bounded credential-free and referrer-free JSON request, rejects redirects, and verifies the response as signed code-only data. A feed cannot contain scripts, selectors, source URLs, affiliate/referral fields, or executable configuration.

## Remote code

All JavaScript and CSS is packaged in the submitted runtime. Comb does not download or evaluate remote code. Signed feeds are inert JSON coupon records and never determine DOM selectors, navigation, attribution, or executable behavior.

## Reproducible review path

From the public source commit with Node 22 or newer, Firefox 138+, current geckodriver, and OpenSSL:

```bash
node scripts/validate-fixture-matrix.js
node scripts/validate-extension.js
node --test tests/*.test.cjs
node scripts/run-firefox-fixtures.js --require-browser
node scripts/build-store-package.js --verify
```

The Firefox command uses geckodriver and a real headless Firefox process. It runs every synthetic happy-path and safe-stop checkout contract, requires zero purchase-control clicks, and repeats the creator URL/cookie preservation assertion. It then builds and temporary-installs the exact runtime ZIP, confirms the packaged background starts with no grant for the synthetic feed origin, imports an ephemeral synthetic public trust key, and clicks the real settings form. Firefox must expose the optional-origin prompt; the runner first denies it and requires both permission and source state to remain empty.

The runner then clicks the same source form again and approves the exact origin. The packaged background first receives an envelope whose coupon code was changed without replacing its original ECDSA P-256 signature. Comb must reject that tampered envelope, remove the newly approved optional origin, and retain only the trusted public key—no feed, source, or alarm. A third form click and approval retries with the valid in-memory envelope. Both observed GETs must use `Accept: application/json` and omit `Cookie` and `Referer`; the valid result must contain exactly one verified feed and healthy source. The production source path must create `comb-signed-feed-refresh` with a 720-minute period. Sending the real `COMB_DELETE_FEED_SOURCE` settings message must retain the verified feed while clearing the source, alarm, and unused optional origin; trust-key deletion then removes the remaining synthetic feed/key.

OpenSSL generates the two-day TLS certificate and key only inside an operating-system temporary directory; the feed signing key stays in memory, cleanup deletes the TLS directory, and no private material is committed. The isolated WebDriver profile accepts that certificate and proxies HTTPS only for this synthetic test. The proxy rejects every CONNECT target except `feeds.comb.community:443`, so the test does not contact a live endpoint. Chrome separately runs the popup/settings accessibility and privacy-report browser contracts.

Current Firefox automation requires Firefox 138+ and geckodriver's `--allow-system-access` for browser-chrome prompt inspection. The driver binds only to `127.0.0.1`, uses chrome context only to identify and resolve `addon-webext-permissions`, and returns immediately to the extension content context. These are test-profile privileges, not extension permissions; Comb's declared Firefox minimum remains 128.

For a manual functional review, load the submitted runtime, pin Comb, open a checkout with a visible coupon field and payable total, and open the popup. Confirm **Creator attribution protected**, enter invented coupon tokens, and choose **Try codes**. The repository demo at `http://127.0.0.1:4173/demo/checkout.html` is sanitized and supports `SAVE10`, `WELCOME20`, `FREESHIP`, and `NOTREAL` after running `npm run demo`.

## Submission boundary

The repository ZIP is not Mozilla-signed and is not proof of AMO availability. Submit only a runtime whose version, full `main` commit, checksums, hosted Chrome/Firefox gates—including the packaged optional-origin and production-alarm contract—and publication authorization all match the canonical record. After account-level action, record AMO's official add-on/version IDs and state. Only AMO state `public` may be described as publicly available.
