"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

test("manifest declares one permission-equivalent Chrome and Firefox MV3 runtime", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.deepEqual(manifest.background, {
    scripts: [
      "src/shared/feed-verifier.js",
      "src/shared/source-policy.js",
      "src/background.js"
    ],
    service_worker: "src/background.js"
  });
  assert.equal(manifest.minimum_chrome_version, "121");
  assert.deepEqual(manifest.browser_specific_settings, {
    gecko: {
      id: "@comb-djlacavera21",
      strict_min_version: "128.0",
      data_collection_permissions: { required: ["none"] }
    }
  });
  assert.deepEqual(manifest.permissions, ["activeTab", "alarms", "scripting", "storage"]);
  assert.equal(Object.hasOwn(manifest, "host_permissions"), false);
  assert.deepEqual(manifest.optional_host_permissions, ["https://*/*"]);
});

test("content runner loads with Firefox browser namespace and no chrome global", () => {
  let listener;
  const context = vm.createContext({
    browser: {
      runtime: {
        async sendMessage() { return undefined; },
        onMessage: {
          addListener(candidate) { listener = candidate; }
        }
      }
    }
  });
  context.globalThis = context;
  const source = fs.readFileSync(path.join(root, "src/content/runner.js"), "utf8");
  vm.runInContext(source, context, { filename: "runner.js" });

  assert.equal(typeof listener, "function");
  let response;
  const keepAlive = listener({ type: "COMB_PING" }, {}, (value) => { response = value; });
  assert.equal(keepAlive, false);
  assert.deepEqual(JSON.parse(JSON.stringify(response)), { ready: false, version: null });
});
