# Comb Firefox Compatibility Boundary

Comb v0.8 contains one permission-equivalent Manifest V3 runtime for Chrome-family browsers and Firefox desktop. Chrome 121+ starts `src/background.js` as an extension service worker. Firefox 128+ loads the same background file as an event-page script after the packaged feed verifier and source policy. Runtime, popup, settings, and content scripts select Firefox's promise-based `browser` API when present and otherwise use Chromium's `chrome` API.

This is a development compatibility target, not a publication claim. Comb has not been signed by Mozilla or submitted to addons.mozilla.org (AMO). Publication schema v3 records Mozilla's official AMO add-on states and treats only `public` as availability. The source contains required real-Firefox checkout and packaged-extension gates, but a future release must still show the complete gate green at its exact public commit before any Mozilla submission or compatibility claim.

## Unchanged safety boundary

- Required permissions remain exactly `activeTab`, `alarms`, `scripting`, and `storage`.
- There is no permanent shopping-site `host_permissions` entry or static content script.
- Checkout injection still follows an explicit extension action and temporary `activeTab` grant.
- The optional HTTPS declaration remains dormant until the user enters a signed-feed URL and approves that exact origin.
- Firefox metadata declares `data_collection_permissions.required: ["none"]` because Comb does not collect and transmit user data outside the extension. A user-selected feed server can still observe ordinary connection metadata for the explicitly requested public JSON file, as documented in [PRIVACY.md](PRIVACY.md).
- No Firefox-specific cookie, navigation, request-interception, affiliate, or remote-code capability is added. The Creator Attribution Guarantee is identical across browser namespaces.

## Current verification

Static validation pins the dual background declaration, Firefox add-on ID, Firefox 128 minimum, Chrome 121 minimum, no-data-collection declaration, unchanged permission set, and API-namespace adapters. Unit tests execute the background as a Firefox-style document with only the `browser` namespace and load the content runner without a `chrome` global.

`scripts/browser-checkout-contracts.js` is the single checkout contract implementation for both browser runners. `scripts/run-firefox-fixtures.js` drives a real headless Firefox process through Mozilla's W3C WebDriver proxy and executes every happy-path and safe-stop matrix row, zero-purchase-click assertion, and creator URL/cookie preservation check. It then invokes the deterministic runtime builder, temporary-installs that exact ZIP through geckodriver's add-on command, and opens the packaged settings page at a deterministic profile UUID.

The packaged smoke contract verifies all of the following in the real extension context:

1. the manifest version, packaged options URL, and background `COMB_GET_FEED_STATE` response are available after startup;
2. the test HTTPS origin is not granted at installation;
3. a synthetic public trust key enables the actual source form;
4. a WebDriver click invokes the real `permissions.request` user-gesture path, Firefox exposes `addon-webext-permissions`, and choosing the denial action leaves the origin ungranted and records no source;
5. a second settings-form click exposes the same prompt, and approving it grants only the exact synthetic HTTPS origin;
6. the packaged background makes one credential-free/referrer-free GET for a deliberately tampered envelope, rejects its invalid signature, removes the newly granted origin, and leaves no feed, source, or alarm;
7. a third settings-form click and approval retries the same exact origin with the valid in-memory ECDSA P-256 envelope;
8. the valid request sends `Accept: application/json`, omits cookies and referrers, records one healthy feed/source, and creates `comb-signed-feed-refresh` with a 720-minute period; and
9. deleting the source through `COMB_DELETE_FEED_SOURCE` clears the alarm and unused origin grant while retaining the verified feed, after which trust-key deletion removes the remaining synthetic feed/key.

The runner creates a fresh signing key/envelope in memory and derives its tampered response by changing one coupon code without replacing the original signature. The same local HTTPS service switches back to the valid envelope for the retry. A two-day TLS certificate lives only in the operating system's temporary directory. Firefox routes only HTTPS traffic through an isolated loopback proxy that accepts the single `feeds.comb.community:443` test tunnel; no DNS lookup or external feed request occurs. The WebDriver profile sets `acceptInsecureCerts` solely to trust that short-lived local certificate, primes the certificate with a synthetic navigation, and deletes the certificate/key directory during cleanup. This proves packaged permission rollback plus the fetch, signature, storage, alarm, and removal paths without committing private material or depending on a live operator. It does not certify the availability or TLS configuration of any third-party feed service.

Verification and release workflows install current Firefox plus geckodriver, confirm OpenSSL is present, and invoke the runner with `--require-browser`, so a missing prerequisite, browser prompt, invalid-signature rollback, valid signed-feed result, alarm, or permission cleanup fails rather than skips. Chrome separately retains the popup/settings keyboard and safe-report browser checks.

Firefox 138 introduced geckodriver's explicit system-access requirement for browser-chrome automation. The runner therefore requires Firefox 138+ for this hosted packaged gate, starts geckodriver only on `127.0.0.1` with `--allow-system-access`, enters chrome context only to identify and resolve the permission prompt, and immediately returns to content context. The synthetic HTTPS proxy is also loopback-only and rejects every CONNECT target except the one test hostname. Never expose either endpoint to another host. Comb itself uses no system access, proxy, or insecure-certificate override and keeps its Firefox 128 minimum; those privileges belong only to the isolated test profile.

Firefox listing copy, five screenshots, MIT license source, reviewer notes, privacy metadata, and AMO state mapping are validated into the deterministic reviewer kit. Before AMO submission, the exact releasable `main` commit must have a green hosted result for the checkout and packaged-extension contracts, the v0.8 publication record must authorize submission, and Mozilla must review and sign the installable package.

To run the complete gate locally when Firefox 138+, current geckodriver, and OpenSSL are installed:

```bash
FIREFOX_PATH=/path/to/firefox GECKODRIVER_PATH=/path/to/geckodriver \
  node scripts/run-firefox-fixtures.js --require-browser
```

## Temporary local inspection

1. Run `npm run release:build` and extract `dist/comb-0.8.0.zip`, or use a clean repository checkout.
2. In Firefox 128 or newer, open `about:debugging`, choose **This Firefox**, and select **Load Temporary Add-on**. Firefox 138+ is required only for the automated system-context prompt check above.
3. Select the extracted `manifest.json`.
4. Use only synthetic fixtures or the local demo; confirm the origin prompt/alarm behavior without connecting a sensitive or private endpoint.
5. Do not treat temporary loading or an unsigned ZIP as store publication or completed compatibility certification.

Official implementation references: [cross-browser MV3 backgrounds](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background), [`activeTab` with `scripting`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting), [runtime permission requests](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/permissions/request), [alarms](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/alarms), [Firefox signing/data-collection metadata](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings), [geckodriver commands](https://searchfox.org/firefox-main/source/testing/geckodriver/src/command.rs), [geckodriver capabilities](https://firefox-source-docs.mozilla.org/testing/geckodriver/Usage.html), [geckodriver flags](https://firefox-source-docs.mozilla.org/testing/geckodriver/Flags.html), [Firefox proxy test preferences](https://searchfox.org/firefox-main/source/netwerk/test/unit/test_proxyconnect.js), and [official AMO add-on/version states](https://mozilla.github.io/addons-server/topics/api/addons).
