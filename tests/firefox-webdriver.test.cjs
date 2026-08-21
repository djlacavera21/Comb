"use strict";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const tls = require("node:tls");

const {
  ASYNC_EVALUATE_SCRIPT,
  EXTENSION_ALARM_STATE_SCRIPT,
  EXTENSION_DELETE_KEY_SCRIPT,
  EXTENSION_DELETE_SOURCE_SCRIPT,
  EXTENSION_STARTUP_SCRIPT,
  WebDriverClient,
  createSyntheticFeedFixture,
  createSyntheticTlsMaterial,
  createSyntheticTrustKey,
  findOpenSSL,
  reservePort,
  startSyntheticFeedService
} = require("../scripts/run-firefox-fixtures.js");

const WEB_DRIVER_ELEMENT = "element-6066-11e4-a52e-4f735466cecf";

function startMockDriver(handler) {
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const source = Buffer.concat(chunks).toString("utf8");
    const body = source ? JSON.parse(source) : undefined;
    const result = await handler(request, body);
    response.writeHead(result.status || 200, { "content-type": "application/json" });
    response.end(JSON.stringify(result.payload));
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, endpoint: `http://127.0.0.1:${port}` });
    });
  });
}

async function requestThroughSyntheticProxy(proxyPort) {
  const proxySocket = net.connect(proxyPort, "127.0.0.1");
  await once(proxySocket, "connect");
  proxySocket.write(
    "CONNECT feeds.comb.community:443 HTTP/1.1\r\n" +
    "Host: feeds.comb.community:443\r\n\r\n"
  );

  let header = Buffer.alloc(0);
  await new Promise((resolve, reject) => {
    function onData(chunk) {
      header = Buffer.concat([header, chunk]);
      if (header.includes(Buffer.from("\r\n\r\n"))) {
        proxySocket.off("data", onData);
        proxySocket.off("error", reject);
        resolve();
      }
    }
    proxySocket.on("data", onData);
    proxySocket.once("error", reject);
  });
  assert.match(header.toString("latin1"), /^HTTP\/1\.1 200 Connection Established/);

  const secureSocket = tls.connect({
    socket: proxySocket,
    servername: "feeds.comb.community",
    rejectUnauthorized: false
  });
  await once(secureSocket, "secureConnect");
  const chunks = [];
  secureSocket.on("data", (chunk) => chunks.push(chunk));
  const closed = once(secureSocket, "close");
  secureSocket.write(
    "GET /releases/comb-firefox-smoke.json HTTP/1.1\r\n" +
    "Host: feeds.comb.community\r\n" +
    "Accept: application/json\r\n" +
    "Connection: close\r\n\r\n"
  );
  await closed;
  return Buffer.concat(chunks).toString("utf8");
}

test("Firefox WebDriver client creates, evaluates in, and deletes one bounded session", async (t) => {
  const calls = [];
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "comb-firefox-webdriver-test-"));
  const addonPath = path.join(temporaryDirectory, "comb.zip");
  fs.writeFileSync(addonPath, "synthetic Firefox archive");
  t.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));
  const { server, endpoint } = await startMockDriver((request, body) => {
    calls.push({ method: request.method, url: request.url, body });
    if (request.method === "POST" && request.url === "/session") {
      return {
        payload: {
          value: {
            sessionId: "comb-firefox-test",
            capabilities: { browserName: "firefox", browserVersion: "148.0" }
          }
        }
      };
    }
    if (request.method === "POST" && request.url === "/session/comb-firefox-test/timeouts") {
      return { payload: { value: null } };
    }
    if (request.method === "POST" && request.url === "/session/comb-firefox-test/execute/async") {
      assert.equal(body.script, ASYNC_EVALUATE_SCRIPT);
      assert.deepEqual(body.args, ["({ creatorAttributionProtected: true })"]);
      return { payload: { value: { ok: true, value: { creatorAttributionProtected: true } } } };
    }
    if (request.method === "POST" && request.url === "/session/comb-firefox-test/execute/sync") {
      assert.equal(body.script, "return document.title;");
      assert.deepEqual(body.args, []);
      return { payload: { value: "Comb" } };
    }
    if (request.method === "POST" && request.url === "/session/comb-firefox-test/moz/context") {
      assert.deepEqual(body, { context: "chrome" });
      return { payload: { value: null } };
    }
    if (request.method === "POST" && request.url === "/session/comb-firefox-test/moz/addon/install") {
      assert.deepEqual(body, { path: addonPath, temporary: true });
      return { payload: { value: "@comb-djlacavera21" } };
    }
    if (request.method === "POST" && request.url === "/session/comb-firefox-test/element") {
      if (body.value === "#sourceUrlInput") {
        return { payload: { value: { [WEB_DRIVER_ELEMENT]: "comb-source" } } };
      }
      assert.deepEqual(body, { using: "css selector", value: "#connectSourceButton" });
      return { payload: { value: { [WEB_DRIVER_ELEMENT]: "comb-connect" } } };
    }
    if (request.method === "POST" &&
        request.url === "/session/comb-firefox-test/element/comb-source/value") {
      assert.deepEqual(body, { text: "https://feeds.comb.community/releases/smoke.json" });
      return { payload: { value: null } };
    }
    if (request.method === "POST" &&
        request.url === "/session/comb-firefox-test/element/comb-connect/click") {
      assert.deepEqual(body, {});
      return { payload: { value: null } };
    }
    if (request.method === "POST" && request.url === "/session/comb-firefox-test/moz/addon/uninstall") {
      assert.deepEqual(body, { id: "@comb-djlacavera21" });
      return { payload: { value: null } };
    }
    if (request.method === "DELETE" && request.url === "/session/comb-firefox-test") {
      return { payload: { value: null } };
    }
    return {
      status: 404,
      payload: { value: { error: "unknown command", message: "unexpected mock route" } }
    };
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const client = new WebDriverClient(endpoint);
  const capabilities = await client.createSession("/opt/firefox/firefox", {
    acceptInsecureCerts: true,
    prefs: {
      "extensions.webextensions.uuids": '{"@comb-djlacavera21":"fixture-uuid"}',
      "network.proxy.ssl_port": 43123
    }
  });
  assert.equal(capabilities.browserVersion, "148.0");
  assert.deepEqual(
    await client.evaluate("({ creatorAttributionProtected: true })"),
    { creatorAttributionProtected: true }
  );
  assert.equal(await client.executeScript("return document.title;"), "Comb");
  await client.setContext("chrome");
  assert.equal(await client.installAddon(addonPath), "@comb-djlacavera21");
  await client.sendKeys("#sourceUrlInput", "https://feeds.comb.community/releases/smoke.json");
  await client.click("#connectSourceButton");
  await client.uninstallAddon("@comb-djlacavera21");
  await client.deleteSession();

  assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
    "POST /session",
    "POST /session/comb-firefox-test/timeouts",
    "POST /session/comb-firefox-test/execute/async",
    "POST /session/comb-firefox-test/execute/sync",
    "POST /session/comb-firefox-test/moz/context",
    "POST /session/comb-firefox-test/moz/addon/install",
    "POST /session/comb-firefox-test/element",
    "POST /session/comb-firefox-test/element/comb-source/value",
    "POST /session/comb-firefox-test/element",
    "POST /session/comb-firefox-test/element/comb-connect/click",
    "POST /session/comb-firefox-test/moz/addon/uninstall",
    "DELETE /session/comb-firefox-test"
  ]);
  assert.deepEqual(calls[0].body.capabilities.alwaysMatch["moz:firefoxOptions"].args, ["-headless"]);
  assert.equal(calls[0].body.capabilities.alwaysMatch.acceptInsecureCerts, true);
  assert.equal(
    calls[0].body.capabilities.alwaysMatch["moz:firefoxOptions"].prefs[
      "extensions.webextensions.uuids"
    ],
    '{"@comb-djlacavera21":"fixture-uuid"}'
  );
  assert.equal(
    calls[0].body.capabilities.alwaysMatch["moz:firefoxOptions"].prefs["network.proxy.ssl_port"],
    43123
  );
  assert.deepEqual(calls[1].body, { implicit: 0, pageLoad: 15_000, script: 40_000 });
});

test("packaged Firefox scripts preserve the permission and alarm boundaries", async () => {
  const trustKey = await createSyntheticTrustKey();
  assert.equal(trustKey.schema, "comb.trust-key/v1");
  assert.match(trustKey.keyId, /^sha256-[A-Za-z0-9_-]{43}$/);
  assert.match(EXTENSION_STARTUP_SCRIPT, /browser\.permissions\.contains/);
  assert.match(EXTENSION_STARTUP_SCRIPT, /COMB_GET_FEED_STATE/);
  assert.match(EXTENSION_ALARM_STATE_SCRIPT, /browser\.alarms\.get/);
  assert.match(EXTENSION_ALARM_STATE_SCRIPT, /browser\.alarms\.getAll/);
  assert.match(EXTENSION_DELETE_SOURCE_SCRIPT, /COMB_DELETE_FEED_SOURCE/);
  assert.match(EXTENSION_DELETE_KEY_SCRIPT, /COMB_DELETE_TRUST_KEY/);
});

test("synthetic Firefox HTTPS proxy switches between valid and tampered in-memory envelopes", async (t) => {
  const opensslPath = findOpenSSL();
  if (!opensslPath) {
    t.skip("OpenSSL is not installed");
    return;
  }

  const feedFixture = await createSyntheticFeedFixture();
  const tlsMaterial = createSyntheticTlsMaterial(opensslPath);
  const service = await startSyntheticFeedService(feedFixture.envelope, tlsMaterial);
  t.after(async () => {
    await service.close();
    fs.rmSync(tlsMaterial.directory, { recursive: true, force: true });
  });

  const response = await requestThroughSyntheticProxy(service.proxyPort);
  assert.match(response, /^HTTP\/1\.1 200 OK/m);
  const body = JSON.parse(response.slice(response.indexOf("\r\n\r\n") + 4));
  assert.equal(body.schema, "comb.signed-feed/v1");
  assert.equal(body.payload.feedId, "comb.firefox-smoke");
  assert.equal(body.signature.keyId, feedFixture.trustKey.keyId);
  assert.equal(service.requests.length, 1);
  assert.equal(service.requests[0].headers.cookie, undefined);
  assert.equal(service.requests[0].headers.referer, undefined);

  const tamperedEnvelope = structuredClone(feedFixture.envelope);
  tamperedEnvelope.payload.entries[0].code = "TAMPERED10";
  service.setEnvelope(tamperedEnvelope);
  service.resetRequests();

  const tamperedResponse = await requestThroughSyntheticProxy(service.proxyPort);
  assert.match(tamperedResponse, /^HTTP\/1\.1 200 OK/m);
  const tamperedBody = JSON.parse(
    tamperedResponse.slice(tamperedResponse.indexOf("\r\n\r\n") + 4)
  );
  assert.equal(tamperedBody.payload.entries[0].code, "TAMPERED10");
  assert.equal(tamperedBody.signature.value, body.signature.value);
  assert.equal(service.requests.length, 1);
  assert.equal(service.requests[0].headers.cookie, undefined);
  assert.equal(service.requests[0].headers.referer, undefined);
});

test("Firefox WebDriver client exposes protocol errors without accepting a result", async (t) => {
  const { server, endpoint } = await startMockDriver(() => ({
    status: 500,
    payload: {
      value: {
        error: "session not created",
        message: "synthetic Firefox startup failure"
      }
    }
  }));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const client = new WebDriverClient(endpoint);
  await assert.rejects(
    client.createSession("/opt/firefox/firefox"),
    /session not created: synthetic Firefox startup failure/
  );
});

test("Firefox runner reserves a loopback driver port", async () => {
  const port = await reservePort();
  assert.ok(Number.isInteger(port));
  assert.ok(port > 0 && port <= 65_535);
});
