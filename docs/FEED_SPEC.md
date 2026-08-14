# Comb Signed Coupon Feed v1

Comb v0.7 accepts manually imported or permission-gated, signature-verified coupon data without adding a backend, required host permissions, or executable configuration. This document defines the `comb.coupon-feed/v1`, `comb.signed-feed/v1`, and `comb.trust-key/v1` formats implemented by `src/shared/feed-verifier.js`, plus the separate approved-source policy implemented by `src/shared/source-policy.js`.

## Security and attribution boundary

A feed can provide only an exact merchant hostname, coupon token, observation time, and aggregate success/failure counts. Every object uses an exact allowlist of fields. URLs, affiliate IDs, referral IDs, publisher sub-IDs, cookies, redirect instructions, DOM selectors, scripts, and arbitrary metadata are rejected before installation.

A valid signature proves that the payload came from the holder of a trusted signing key; it does not prove that a coupon works. Comb ranks candidates conservatively and tests them only through its existing user-initiated checkout boundary. Feed data cannot navigate, make a request, edit a URL, write a cookie, or submit an order.

## Limits

| Constraint | v1 limit |
| --- | --- |
| Signature | ECDSA P-256 with SHA-256 |
| Signed-feed file | 2 MiB UTF-8 JSON |
| Trusted keys | 20 |
| Installed feeds | 20 |
| Approved update sources | 20 |
| Entries per feed | 5,000 |
| Feed lifetime | 45 days maximum |
| Observation age at issue time | 365 days maximum |
| Coupon token | 1–64 characters matching `[A-Za-z0-9][A-Za-z0-9._%+-]*` |
| Merchant scope | One normalized hostname, without `www.` or wildcards |
| Clock tolerance | 5 minutes for issue and observation times |

## Public trust key

Users import a public trust descriptor before importing a feed. Its exact fields are:

| Field | Meaning |
| --- | --- |
| `schema` | `comb.trust-key/v1` |
| `keyId` | Public-key fingerprint described below |
| `name` | Human-readable publisher name, 1–80 characters |
| `algorithm` | `ECDSA-P256-SHA256` |
| `createdAt` | Valid timestamp |
| `publicKeyJwk` | EC P-256 public JWK with `x` and `y` coordinates |

The `keyId` is `sha256-` plus unpadded base64url of SHA-256 over the canonical JSON UTF-8 bytes of:

```json
{"crv":"P-256","kty":"EC","x":"<x-coordinate>","y":"<y-coordinate>"}
```

Comb recalculates this fingerprint during import. The public descriptor is safe to distribute; the private key is not.

## Coupon-feed payload

The payload has these exact fields:

| Field | Rule |
| --- | --- |
| `schema` | `comb.coupon-feed/v1` |
| `feedId` | Stable 3–64 character lowercase identifier matching `[a-z0-9][a-z0-9._-]{2,63}` |
| `name` | Human-readable feed name, 1–80 characters |
| `sequence` | Positive 32-bit integer; increase whenever content changes |
| `issuedAt` | Valid timestamp, no more than five minutes in the future |
| `expiresAt` | After `issuedAt`, in the future, and no more than 45 days later |
| `keyId` | Fingerprint of the signing public key |
| `entries` | Array of at most 5,000 exact entry objects |

Each entry has these exact fields:

| Field | Rule |
| --- | --- |
| `merchant` | Lowercase normalized hostname; no scheme, path, port, wildcard, or leading `www.` |
| `code` | Coupon token matching the limit above; merchant/code pairs are unique case-insensitively |
| `lastVerifiedAt` | Observation timestamp no later than the issue time plus clock tolerance and no more than one year older |
| `successCount` | Integer from 0 through 1,000,000 |
| `failureCount` | Integer from 0 through 1,000,000 |

The synthetic shape reference is in `examples/community-feed.payload.example.json`. Because real feeds expire, use `scripts/create-example-feed-payload.js` to create a fresh working copy before testing the signing flow.

## Canonical payload and signature

The signature covers the UTF-8 bytes of the payload object's canonical JSON representation:

- object keys are sorted lexicographically at every depth;
- arrays preserve their order;
- strings, booleans, finite numbers, and `null` use JSON encoding;
- whitespace is omitted; and
- undefined values, non-finite numbers, non-JSON objects, excessive depth, and excessive node counts are rejected.

The signature is a 64-byte P-256 `r || s` value encoded as unpadded base64url. The envelope has exactly this shape:

```json
{
  "schema": "comb.signed-feed/v1",
  "payload": { "...": "the complete coupon-feed payload" },
  "signature": {
    "algorithm": "ECDSA-P256-SHA256",
    "keyId": "sha256-<public-key-fingerprint>",
    "value": "<base64url-signature>"
  }
}
```

Comb verifies the signature first, then validates and normalizes the payload. On later reads it verifies the stored envelope again; malformed, orphaned, hash-mismatched, or signature-mismatched records are quarantined. Expired records remain only as signed sequence history for rollback protection and do not supply codes.

## Updates, rollback, and key rotation

The tuple of installed `feedId` and signing `keyId` identifies an update stream.

- A higher sequence replaces the installed payload.
- The same sequence and same payload hash is an idempotent import.
- A lower sequence is rejected as a rollback.
- The same sequence with different content is rejected as a substitution.
- A different trusted key cannot replace an installed feed ID, even with a higher sequence.

For key rotation, distribute the new public trust key separately. The user must explicitly import that key, remove the old installed feed, and import the replacement. Removing a feed intentionally clears its local rollback history, so publishers and users should verify the new key fingerprint out of band.

An approved source must be removed before its installed feed can be removed. For a source-backed key rotation, remove the source, remove the old feed, import and verify the new public key, then reconnect and verify the endpoint explicitly.

## Approved-source layer

Source configuration is not part of any signed feed object. Feed URLs never reach the coupon candidate list or checkout engine and cannot carry affiliate metadata. v0.7 accepts a source only when all of these are true:

- the user enters the URL in Comb settings and submits Chrome's origin permission prompt;
- the URL uses public HTTPS on the default port with a DNS hostname;
- it identifies a `.json` resource and has no embedded credentials, query string, fragment, IP address, or local/reserved hostname;
- the extension currently holds the exact origin grant derived from that URL;
- the request returns HTTP 200 directly, without a redirect, within 15 seconds;
- no more than 2 MiB of response bytes decode as UTF-8 JSON; and
- the envelope passes the complete trust, signature, schema, expiry, and sequence contract above.

Requests use `credentials: "omit"`, `referrerPolicy: "no-referrer"`, and `cache: "no-store"`. Comb adds no user identifier and sends no checkout information or coupon outcomes. Ordinary network metadata, including the connection IP address and common request headers, may still be visible to the feed operator.

The first verified response pins the source to its `feedId` and `keyId`. Later responses that change either identity are rejected even if the new key is otherwise trusted. Valid higher sequences update the installed feed; an identical signed payload is a no-op. Comb checks connected sources approximately every 12 hours while Chrome can run the alarm, and users can check manually at any time.

Removing the last source for an origin clears its scheduled work and asks Chrome to remove that optional host grant. The last verified feed remains installed and usable until expiry unless the user removes it separately.

## Candidate ranking

Comb deduplicates coupon tokens case-insensitively for the exact current merchant and keeps the strongest candidate. Its v1 score combines a smoothed success rate (65%), a 30-day freshness half-life (25%), and observation-count confidence (10%). At most 20 merged local and signed-feed codes reach a checkout run, with local codes taking precedence.

Outcome counts are publisher-provided evidence, not telemetry from the extension. Comb v0.7 uploads no outcomes.

## Publisher workflow

Use the dependency-free tools from the repository root:

```bash
node scripts/create-example-feed-payload.js /tmp/community.payload.json
node scripts/generate-feed-keypair.js /secure/path/comb-community "Comb Community"
node scripts/sign-feed.js /tmp/community.payload.json /secure/path/comb-community.private.json /tmp/community.signed.json
node scripts/verify-feed.js /tmp/community.signed.json /secure/path/comb-community.public.json
```

The key generator refuses to create a private key inside the repository and refuses to overwrite existing files. Keep private descriptors offline with restricted file access, publish the `.public.json` descriptor through an authenticated channel, increase the sequence for every changed payload, and issue a fresh feed before the previous one expires.
