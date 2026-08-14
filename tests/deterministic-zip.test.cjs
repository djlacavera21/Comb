"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createArchive, sha256 } = require("../scripts/deterministic-zip.js");

test("deterministic ZIP bytes do not depend on input order", () => {
  const epoch = 1_700_000_000;
  const first = createArchive([
    { name: "z-last.txt", content: Buffer.from("last") },
    { name: "a-first.txt", content: Buffer.from("first") }
  ], epoch);
  const second = createArchive([
    { name: "a-first.txt", content: Buffer.from("first") },
    { name: "z-last.txt", content: Buffer.from("last") }
  ], epoch);

  assert.deepEqual(first, second);
  assert.equal(sha256(first), sha256(second));
});

test("deterministic ZIP rejects traversal and duplicate paths", () => {
  assert.throws(
    () => createArchive([{ name: "../escape.txt", content: Buffer.alloc(0) }], 1_700_000_000),
    /Unsafe archive path/
  );
  assert.throws(
    () => createArchive([
      { name: "same.txt", content: Buffer.from("one") },
      { name: "same.txt", content: Buffer.from("two") }
    ], 1_700_000_000),
    /Duplicate archive path/
  );
});
