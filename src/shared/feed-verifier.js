(function initCombFeed(root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.CombFeed = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createCombFeed() {
  "use strict";

  const FEED_SCHEMA = "comb.coupon-feed/v1";
  const ENVELOPE_SCHEMA = "comb.signed-feed/v1";
  const TRUST_KEY_SCHEMA = "comb.trust-key/v1";
  const PRIVATE_KEY_SCHEMA = "comb.private-key/v1";
  const ALGORITHM = "ECDSA-P256-SHA256";
  const MAX_ENTRIES = 5000;
  const MAX_FEED_LIFETIME_MS = 45 * 24 * 60 * 60 * 1000;
  const MAX_OBSERVATION_AGE_MS = 365 * 24 * 60 * 60 * 1000;
  const CLOCK_SKEW_MS = 5 * 60 * 1000;

  class FeedError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "FeedError";
      this.code = code;
    }
  }

  function fail(code, message) {
    throw new FeedError(code, message);
  }

  function cleanText(value) {
    return String(value == null ? "" : value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function assertPlainObject(value, label) {
    if (!isPlainObject(value)) fail("invalid_shape", `${label} must be a plain JSON object.`);
  }

  function assertExactKeys(value, allowed, required, label) {
    const allowedSet = new Set(allowed);
    const keys = Object.keys(value);

    for (const key of keys) {
      if (!allowedSet.has(key)) {
        fail("unexpected_field", `${label} contains the unsupported field “${key}”.`);
      }
    }

    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        fail("missing_field", `${label} is missing “${key}”.`);
      }
    }
  }

  function canonicalize(value) {
    let nodes = 0;

    function serialize(current, depth) {
      nodes += 1;
      if (nodes > 100000) fail("canonical_limit", "JSON value exceeds the canonicalization node limit.");
      if (depth > 24) fail("canonical_depth", "JSON value exceeds the canonicalization depth limit.");

      if (current === null) return "null";

      if (typeof current === "string" || typeof current === "boolean") {
        return JSON.stringify(current);
      }

      if (typeof current === "number") {
        if (!Number.isFinite(current)) fail("invalid_number", "Canonical JSON cannot contain a non-finite number.");
        return JSON.stringify(current);
      }

      if (Array.isArray(current)) {
        return `[${current.map((entry) => serialize(entry, depth + 1)).join(",")}]`;
      }

      if (!isPlainObject(current)) {
        fail("invalid_json_value", "Canonical JSON accepts only null, booleans, numbers, strings, arrays, and plain objects.");
      }

      const pairs = [];
      for (const key of Object.keys(current).sort()) {
        const entry = current[key];
        if (typeof entry === "undefined" || typeof entry === "function" || typeof entry === "symbol") {
          fail("invalid_json_value", `Canonical JSON cannot encode the field “${key}”.`);
        }
        pairs.push(`${JSON.stringify(key)}:${serialize(entry, depth + 1)}`);
      }
      return `{${pairs.join(",")}}`;
    }

    return serialize(value, 0);
  }

  function cryptoProvider() {
    const provider = typeof globalThis !== "undefined" ? globalThis.crypto : null;
    if (!provider || !provider.subtle) fail("crypto_unavailable", "Web Crypto is unavailable in this environment.");
    return provider;
  }

  function utf8(value) {
    return new TextEncoder().encode(value);
  }

  function bytesToBase64Url(value) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    let base64;

    if (typeof Buffer !== "undefined") {
      base64 = Buffer.from(bytes).toString("base64");
    } else {
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      base64 = btoa(binary);
    }

    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlToBytes(value) {
    const encoded = cleanText(value);
    if (typeof value !== "string" || value !== encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
      fail("invalid_base64url", "Signature is not valid base64url data.");
    }
    const padding = "=".repeat((4 - (encoded.length % 4)) % 4);
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/") + padding;

    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(base64, "base64"));
    }

    const binary = atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  async function sha256(value) {
    const bytes = typeof value === "string" ? utf8(value) : value;
    return new Uint8Array(await cryptoProvider().subtle.digest("SHA-256", bytes));
  }

  function normalizeHostname(value) {
    const hostname = cleanText(value).toLowerCase().replace(/^www\./, "");

    if (
      !hostname ||
      hostname.length > 253 ||
      !/^[a-z0-9.-]+$/.test(hostname) ||
      hostname.startsWith(".") ||
      hostname.endsWith(".") ||
      hostname.includes("..")
    ) {
      return null;
    }

    return hostname;
  }

  function normalizeCode(value) {
    const code = cleanText(value);
    if (!code || code.length > 64) return null;
    return /^[A-Za-z0-9][A-Za-z0-9._%+\-]*$/.test(code) ? code : null;
  }

  function parseTimestamp(value, label) {
    if (typeof value !== "string") fail("invalid_timestamp", `${label} must be an ISO timestamp.`);
    const milliseconds = Date.parse(value);
    if (!Number.isFinite(milliseconds)) fail("invalid_timestamp", `${label} is not a valid timestamp.`);
    return milliseconds;
  }

  function publicKeyMaterial(jwk) {
    assertPlainObject(jwk, "Public JWK");

    if (jwk.kty !== "EC" || jwk.crv !== "P-256") {
      fail("invalid_key", "Comb feed keys must be ECDSA P-256 keys.");
    }

    if (!/^[A-Za-z0-9_-]{43}$/.test(cleanText(jwk.x)) || !/^[A-Za-z0-9_-]{43}$/.test(cleanText(jwk.y))) {
      fail("invalid_key", "Public JWK coordinates are invalid.");
    }

    return {
      crv: "P-256",
      kty: "EC",
      x: cleanText(jwk.x),
      y: cleanText(jwk.y)
    };
  }

  async function fingerprintPublicJwk(jwk) {
    const digest = await sha256(canonicalize(publicKeyMaterial(jwk)));
    return `sha256-${bytesToBase64Url(digest)}`;
  }

  async function createTrustKeyDescriptor(name, publicKeyJwk, createdAt = new Date().toISOString()) {
    const normalizedName = cleanText(name);
    if (!normalizedName || normalizedName.length > 80) fail("invalid_key_name", "Trust-key name must be 1–80 characters.");
    const material = publicKeyMaterial(publicKeyJwk);
    const keyId = await fingerprintPublicJwk(material);

    return {
      schema: TRUST_KEY_SCHEMA,
      keyId,
      name: normalizedName,
      algorithm: ALGORITHM,
      createdAt: new Date(parseTimestamp(createdAt, "Trust-key creation time")).toISOString(),
      publicKeyJwk: {
        ...material,
        ext: true,
        key_ops: ["verify"]
      }
    };
  }

  async function validateTrustKey(value) {
    assertPlainObject(value, "Trust key");
    assertExactKeys(
      value,
      ["schema", "keyId", "name", "algorithm", "createdAt", "publicKeyJwk"],
      ["schema", "keyId", "name", "algorithm", "createdAt", "publicKeyJwk"],
      "Trust key"
    );

    if (value.schema !== TRUST_KEY_SCHEMA) fail("unsupported_key_schema", "Unsupported trust-key schema.");
    if (value.algorithm !== ALGORITHM) fail("unsupported_algorithm", "Unsupported trust-key algorithm.");
    const normalized = await createTrustKeyDescriptor(value.name, value.publicKeyJwk, value.createdAt);
    if (value.keyId !== normalized.keyId) fail("key_id_mismatch", "Trust-key fingerprint does not match its public key.");
    return normalized;
  }

  function validateFeedEntry(value, index, issuedAtMs, nowMs) {
    const label = `Feed entry ${index + 1}`;
    assertPlainObject(value, label);
    assertExactKeys(
      value,
      ["merchant", "code", "lastVerifiedAt", "successCount", "failureCount"],
      ["merchant", "code", "lastVerifiedAt", "successCount", "failureCount"],
      label
    );

    const merchant = normalizeHostname(value.merchant);
    const code = normalizeCode(value.code);
    if (!merchant || merchant !== value.merchant) fail("invalid_merchant", `${label} has a non-normalized merchant hostname.`);
    if (!code || code !== value.code) fail("invalid_code", `${label} has an invalid coupon token.`);

    const lastVerifiedAtMs = parseTimestamp(value.lastVerifiedAt, `${label} verification time`);
    if (lastVerifiedAtMs > nowMs + CLOCK_SKEW_MS) fail("future_observation", `${label} is dated in the future.`);
    if (lastVerifiedAtMs > issuedAtMs + CLOCK_SKEW_MS) {
      fail("future_observation", `${label} is dated after the feed was issued.`);
    }
    if (issuedAtMs - lastVerifiedAtMs > MAX_OBSERVATION_AGE_MS) {
      fail("stale_observation", `${label} is more than one year older than the feed.`);
    }

    for (const field of ["successCount", "failureCount"]) {
      if (!Number.isSafeInteger(value[field]) || value[field] < 0 || value[field] > 1000000) {
        fail("invalid_outcome_count", `${label} has an invalid ${field}.`);
      }
    }

    return {
      merchant,
      code,
      lastVerifiedAt: new Date(lastVerifiedAtMs).toISOString(),
      successCount: value.successCount,
      failureCount: value.failureCount
    };
  }

  function validateFeedPayload(value, options = {}) {
    const nowMs = Number.isFinite(options.now) ? options.now : Date.now();
    const maxEntries = Math.max(1, Math.min(options.maxEntries || MAX_ENTRIES, MAX_ENTRIES));
    assertPlainObject(value, "Feed payload");
    assertExactKeys(
      value,
      ["schema", "feedId", "name", "sequence", "issuedAt", "expiresAt", "keyId", "entries"],
      ["schema", "feedId", "name", "sequence", "issuedAt", "expiresAt", "keyId", "entries"],
      "Feed payload"
    );

    if (value.schema !== FEED_SCHEMA) fail("unsupported_feed_schema", "Unsupported coupon-feed schema.");

    const feedId = cleanText(value.feedId).toLowerCase();
    const name = cleanText(value.name);
    if (value.feedId !== feedId || !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(feedId)) {
      fail("invalid_feed_id", "Feed ID must be 3–64 lowercase characters.");
    }
    if (!name || name.length > 80) fail("invalid_feed_name", "Feed name must be 1–80 characters.");
    if (!Number.isSafeInteger(value.sequence) || value.sequence < 1 || value.sequence > 2147483647) {
      fail("invalid_sequence", "Feed sequence must be a positive 32-bit integer.");
    }
    if (value.keyId !== cleanText(value.keyId) || !/^sha256-[A-Za-z0-9_-]{43}$/.test(value.keyId)) {
      fail("invalid_key_id", "Feed key ID is invalid.");
    }
    if (!Array.isArray(value.entries) || value.entries.length > maxEntries) {
      fail("entry_limit", `Feed must contain at most ${maxEntries} entries.`);
    }

    const issuedAtMs = parseTimestamp(value.issuedAt, "Feed issue time");
    const expiresAtMs = parseTimestamp(value.expiresAt, "Feed expiration time");
    if (issuedAtMs > nowMs + CLOCK_SKEW_MS) fail("future_feed", "Feed issue time is in the future.");
    if (expiresAtMs <= nowMs) fail("expired_feed", "Feed has expired.");
    if (expiresAtMs <= issuedAtMs) fail("invalid_lifetime", "Feed expiration must follow its issue time.");
    if (expiresAtMs - issuedAtMs > MAX_FEED_LIFETIME_MS) {
      fail("invalid_lifetime", "Feed lifetime cannot exceed 45 days.");
    }

    const entries = [];
    const seen = new Set();
    for (let index = 0; index < value.entries.length; index += 1) {
      const entry = validateFeedEntry(value.entries[index], index, issuedAtMs, nowMs);
      const identity = `${entry.merchant}\u0000${entry.code.toLocaleUpperCase("en-US")}`;
      if (seen.has(identity)) fail("duplicate_entry", `Feed contains duplicate code ${entry.code} for ${entry.merchant}.`);
      seen.add(identity);
      entries.push(entry);
    }

    return {
      schema: FEED_SCHEMA,
      feedId,
      name,
      sequence: value.sequence,
      issuedAt: new Date(issuedAtMs).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      keyId: cleanText(value.keyId),
      entries
    };
  }

  function validateEnvelopeShape(value) {
    assertPlainObject(value, "Signed feed");
    assertExactKeys(value, ["schema", "payload", "signature"], ["schema", "payload", "signature"], "Signed feed");
    if (value.schema !== ENVELOPE_SCHEMA) fail("unsupported_envelope_schema", "Unsupported signed-feed envelope.");

    assertPlainObject(value.signature, "Feed signature");
    assertExactKeys(
      value.signature,
      ["algorithm", "keyId", "value"],
      ["algorithm", "keyId", "value"],
      "Feed signature"
    );
    if (value.signature.algorithm !== ALGORITHM) fail("unsupported_algorithm", "Unsupported feed signature algorithm.");
    if (
      value.signature.keyId !== cleanText(value.signature.keyId) ||
      !/^sha256-[A-Za-z0-9_-]{43}$/.test(value.signature.keyId)
    ) {
      fail("invalid_key_id", "Signature key ID is invalid.");
    }
    const signatureBytes = base64UrlToBytes(value.signature.value);
    if (signatureBytes.length !== 64) fail("invalid_signature", "ECDSA P-256 signature must be 64 bytes.");
    return signatureBytes;
  }

  async function verifyEnvelope(envelope, trustKey, options = {}) {
    const signatureBytes = validateEnvelopeShape(envelope);
    const normalizedKey = await validateTrustKey(trustKey);
    const signatureKeyId = cleanText(envelope.signature.keyId);

    if (signatureKeyId !== normalizedKey.keyId) fail("untrusted_key", "Feed signature does not use the selected trusted key.");
    if (!isPlainObject(envelope.payload)) fail("invalid_shape", "Feed payload must be a JSON object.");

    const serializedPayload = canonicalize(envelope.payload);
    const publicKey = await cryptoProvider().subtle.importKey(
      "jwk",
      normalizedKey.publicKeyJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    const valid = await cryptoProvider().subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      signatureBytes,
      utf8(serializedPayload)
    );
    if (!valid) fail("signature_mismatch", "Feed signature verification failed.");

    const payload = validateFeedPayload(envelope.payload, options);
    if (payload.keyId !== signatureKeyId) fail("key_id_mismatch", "Feed payload key ID does not match its signature.");
    const payloadHash = `sha256-${bytesToBase64Url(await sha256(serializedPayload))}`;

    return {
      payload,
      payloadHash,
      keyId: signatureKeyId,
      verifiedAt: new Date(Number.isFinite(options.now) ? options.now : Date.now()).toISOString()
    };
  }

  async function signPayload(payload, privateKeyJwk, keyId, options = {}) {
    const normalizedPayload = validateFeedPayload(payload, options);
    if (normalizedPayload.keyId !== keyId) fail("key_id_mismatch", "Payload key ID does not match the signing key.");
    const material = publicKeyMaterial(privateKeyJwk);
    const fingerprint = await fingerprintPublicJwk(material);
    if (fingerprint !== keyId) fail("key_id_mismatch", "Private signing key does not match the declared key ID.");

    const privateKey = await cryptoProvider().subtle.importKey(
      "jwk",
      privateKeyJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
    const signature = await cryptoProvider().subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      utf8(canonicalize(normalizedPayload))
    );

    return {
      schema: ENVELOPE_SCHEMA,
      payload: normalizedPayload,
      signature: {
        algorithm: ALGORITHM,
        keyId,
        value: bytesToBase64Url(signature)
      }
    };
  }

  function scoreEntry(entry, now = Date.now()) {
    const successes = entry.successCount;
    const failures = entry.failureCount;
    const observations = successes + failures;
    const successRate = (successes + 1) / (observations + 2);
    const ageDays = Math.max(0, (now - Date.parse(entry.lastVerifiedAt)) / (24 * 60 * 60 * 1000));
    const freshness = 2 ** (-ageDays / 30);
    const confidence = Math.min(1, Math.log10(observations + 1) / 2);
    return Math.round((successRate * 0.65 + freshness * 0.25 + confidence * 0.1) * 1000) / 10;
  }

  function selectCodesForMerchant(feedRecords, rawHostname, options = {}) {
    const hostname = normalizeHostname(rawHostname);
    const now = Number.isFinite(options.now) ? options.now : Date.now();
    const limit = Math.max(1, Math.min(options.limit || 20, 20));
    if (!hostname || !Array.isArray(feedRecords)) return [];

    const bestByCode = new Map();
    for (const record of feedRecords) {
      const payload = record && record.payload;
      if (!payload || Date.parse(payload.expiresAt) <= now) continue;

      for (const entry of payload.entries || []) {
        if (entry.merchant !== hostname) continue;
        const candidate = {
          code: entry.code,
          score: scoreEntry(entry, now),
          feedId: payload.feedId,
          feedName: payload.name,
          lastVerifiedAt: entry.lastVerifiedAt,
          successCount: entry.successCount,
          failureCount: entry.failureCount
        };
        const identity = entry.code.toLocaleUpperCase("en-US");
        const existing = bestByCode.get(identity);
        if (!existing || candidate.score > existing.score) bestByCode.set(identity, candidate);
      }
    }

    return Array.from(bestByCode.values())
      .sort((left, right) => right.score - left.score || left.code.localeCompare(right.code))
      .slice(0, limit);
  }

  function classifyFeedUpdate(existingRecord, incomingVerification) {
    if (!existingRecord) return "new";

    const existingSequence = existingRecord.payload && existingRecord.payload.sequence;
    const incomingSequence = incomingVerification.payload && incomingVerification.payload.sequence;
    if (!Number.isSafeInteger(existingSequence) || !Number.isSafeInteger(incomingSequence)) {
      fail("invalid_sequence", "Stored or incoming feed sequence is invalid.");
    }
    if (incomingSequence < existingSequence) {
      fail("rollback_detected", `Feed sequence ${incomingSequence} is older than installed sequence ${existingSequence}.`);
    }
    if (incomingSequence === existingSequence) {
      if (existingRecord.payloadHash === incomingVerification.payloadHash) return "identical";
      fail("sequence_conflict", "Feed reuses an installed sequence number with different signed content.");
    }
    return "update";
  }

  return Object.freeze({
    FEED_SCHEMA,
    ENVELOPE_SCHEMA,
    TRUST_KEY_SCHEMA,
    PRIVATE_KEY_SCHEMA,
    ALGORITHM,
    MAX_ENTRIES,
    FeedError,
    canonicalize,
    bytesToBase64Url,
    base64UrlToBytes,
    normalizeHostname,
    normalizeCode,
    fingerprintPublicJwk,
    createTrustKeyDescriptor,
    validateTrustKey,
    validateFeedPayload,
    verifyEnvelope,
    signPayload,
    scoreEntry,
    selectCodesForMerchant,
    classifyFeedUpdate
  });
});
