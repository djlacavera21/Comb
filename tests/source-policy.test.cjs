"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const policy = require("../src/shared/source-policy.js");

test("source policy normalizes a public HTTPS feed URL and exact origin grant", () => {
  assert.deepEqual(
    policy.normalizeSourceUrl("https://Feeds.Comb.Community/releases/comb.json"),
    {
      url: "https://feeds.comb.community/releases/comb.json",
      hostname: "feeds.comb.community",
      origin: "https://feeds.comb.community",
      originPattern: "https://feeds.comb.community/*"
    }
  );
});

test("source policy rejects insecure, local, IP, and credential-bearing URLs", () => {
  const unsafe = [
    "http://feeds.example.org/feed.json",
    "https://localhost/feed.json",
    "https://localhost./feed.json",
    "https://router.localdomain/feed.json",
    "https://home.arpa/feed.json",
    "https://127.0.0.1/feed.json",
    "https://127.1/feed.json",
    "https://0x7f000001/feed.json",
    "https://[::1]/feed.json",
    "https://feeds.example.org/feed.json",
    "https://user:secret@feeds.comb.community/feed.json",
    "https://feeds.comb.community:8443/feed.json"
  ];

  for (const value of unsafe) {
    assert.throws(() => policy.normalizeSourceUrl(value), policy.SourcePolicyError, value);
  }
});

test("source policy rejects query tokens and fragments", () => {
  assert.throws(
    () => policy.normalizeSourceUrl("https://feeds.comb.community/feed.json?token=secret"),
    (error) => error.code === "query_forbidden"
  );
  assert.throws(
    () => policy.normalizeSourceUrl("https://feeds.comb.community/feed.json#latest"),
    (error) => error.code === "fragment_forbidden"
  );
  assert.throws(
    () => policy.normalizeSourceUrl("https://feeds.comb.community/click/latest"),
    (error) => error.code === "json_path_required"
  );
});
