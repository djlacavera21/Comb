(function initCombSourcePolicy(root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.CombSourcePolicy = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createCombSourcePolicy() {
  "use strict";

  const MAX_SOURCE_URL_LENGTH = 2048;
  const BLOCKED_DOMAINS = ["localhost", "home.arpa", "example.com", "example.net", "example.org"];
  const BLOCKED_SUFFIXES = [".internal", ".invalid", ".local", ".localdomain", ".localhost", ".test", ".example"];

  class SourcePolicyError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "SourcePolicyError";
      this.code = code;
    }
  }

  function fail(code, message) {
    throw new SourcePolicyError(code, message);
  }

  function isIpv4(hostname) {
    const pieces = hostname.split(".");
    return pieces.length === 4 && pieces.every((piece) => {
      if (!/^\d{1,3}$/.test(piece)) return false;
      const value = Number(piece);
      return value >= 0 && value <= 255 && String(value) === piece;
    });
  }

  function normalizeSourceUrl(value) {
    if (typeof value !== "string") fail("invalid_source_url", "Feed source must be an HTTPS URL.");
    const input = value.trim();
    if (!input || input.length > MAX_SOURCE_URL_LENGTH) {
      fail("invalid_source_url", "Feed source URL is empty or too long.");
    }

    let parsed;
    try {
      parsed = new URL(input);
    } catch (_error) {
      fail("invalid_source_url", "Feed source is not a valid URL.");
    }

    if (parsed.protocol !== "https:") fail("https_required", "Feed sources must use HTTPS.");
    if (parsed.username || parsed.password) fail("credentials_forbidden", "Feed source URLs cannot contain credentials.");
    if (parsed.port) fail("port_forbidden", "Feed source URLs must use the default HTTPS port.");
    if (parsed.search) fail("query_forbidden", "Feed source URLs cannot contain query parameters or access tokens.");
    if (parsed.hash) fail("fragment_forbidden", "Feed source URLs cannot contain fragments.");
    if (!parsed.pathname.toLowerCase().endsWith(".json")) {
      fail("json_path_required", "Feed source URL must identify a .json resource.");
    }

    const parsedHostname = parsed.hostname.toLowerCase();
    const hostname = parsedHostname.endsWith(".") ? parsedHostname.slice(0, -1) : parsedHostname;
    if (
      !hostname.includes(".") ||
      hostname.includes(":") ||
      hostname.includes("[") ||
      isIpv4(hostname) ||
      BLOCKED_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)) ||
      BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
    ) {
      fail("public_host_required", "Feed source must use a public DNS hostname, not a local or IP address.");
    }

    parsed.hostname = hostname;
    const url = parsed.toString();
    return Object.freeze({
      url,
      hostname,
      origin: parsed.origin,
      originPattern: `${parsed.origin}/*`
    });
  }

  return Object.freeze({
    MAX_SOURCE_URL_LENGTH,
    SourcePolicyError,
    normalizeSourceUrl
  });
});
