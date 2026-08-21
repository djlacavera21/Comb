"use strict";

const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");
const { runCheckoutFixtureSuite } = require("./browser-checkout-contracts.js");
const CombFeed = require("../src/shared/feed-verifier.js");

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const requireBrowser = process.argv.includes("--require-browser");
const ADDON_ID = manifest.browser_specific_settings.gecko.id;
const EXTENSION_UUID = "c0b00000-5afe-4dad-a11e-000000000800";
const EXTENSION_OPTIONS_URL = `moz-extension://${EXTENSION_UUID}/src/options/options.html`;
const TEST_SOURCE_URL = "https://feeds.comb.community/releases/comb-firefox-smoke.json";
const TEST_ORIGIN_PATTERN = "https://feeds.comb.community/*";
const TEST_SOURCE_HOST = "feeds.comb.community";
const TEST_SOURCE_PATH = "/releases/comb-firefox-smoke.json";
const TEST_FEED_ID = "comb.firefox-smoke";
const FEED_REFRESH_ALARM = "comb-signed-feed-refresh";
const FEED_REFRESH_MINUTES = 12 * 60;
const WEB_DRIVER_ELEMENT = "element-6066-11e4-a52e-4f735466cecf";
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};
const ASYNC_EVALUATE_SCRIPT = `
  const expression = arguments[0];
  const complete = arguments[arguments.length - 1];
  Promise.resolve()
    .then(() => globalThis.eval(expression))
    .then((value) => complete({ ok: true, value }))
    .catch((error) => complete({
      ok: false,
      message: String(error && error.message ? error.message : error),
      stack: String(error && error.stack ? error.stack : "")
    }));
`;

function packagedAsyncScript(body) {
  return `
    const input = arguments;
    const complete = arguments[arguments.length - 1];
    Promise.resolve()
      .then(async () => {
        ${body}
      })
      .then((value) => complete({ ok: true, value }))
      .catch((error) => complete({
        ok: false,
        message: String(error && error.message ? error.message : error),
        stack: String(error && error.stack ? error.stack : "")
      }));
  `;
}

const EXTENSION_STARTUP_SCRIPT = packagedAsyncScript(`
  const originPattern = input[0];
  const stateResponse = await browser.runtime.sendMessage({ type: "COMB_GET_FEED_STATE" });
  const originGranted = await browser.permissions.contains({ origins: [originPattern] });
  return {
    manifest: browser.runtime.getManifest(),
    optionsUrl: browser.runtime.getURL("src/options/options.html"),
    stateResponse,
    originGranted
  };
`);

const EXTENSION_IMPORT_KEY_SCRIPT = packagedAsyncScript(`
  const response = await browser.runtime.sendMessage({
    type: "COMB_IMPORT_TRUST_KEY",
    trustKey: input[0]
  });
  if (!response || response.ok !== true) {
    throw new Error(response && response.error ? response.error : "Trust-key import failed.");
  }
  return response.result;
`);

const EXTENSION_PERMISSION_STATE_SCRIPT = packagedAsyncScript(`
  return browser.permissions.contains({ origins: [input[0]] });
`);

const EXTENSION_ALARM_STATE_SCRIPT = packagedAsyncScript(`
  const name = input[0];
  const alarm = await browser.alarms.get(name);
  const listed = (await browser.alarms.getAll()).some((candidate) => candidate.name === name);
  return { alarm: alarm || null, listed };
`);

const EXTENSION_DELETE_KEY_SCRIPT = packagedAsyncScript(`
  const response = await browser.runtime.sendMessage({
    type: "COMB_DELETE_TRUST_KEY",
    keyId: input[0]
  });
  if (!response || response.ok !== true) {
    throw new Error(response && response.error ? response.error : "Trust-key removal failed.");
  }
  return response.result;
`);

const EXTENSION_DELETE_SOURCE_SCRIPT = packagedAsyncScript(`
  const response = await browser.runtime.sendMessage({
    type: "COMB_DELETE_FEED_SOURCE",
    feedId: input[0]
  });
  if (!response || response.ok !== true) {
    throw new Error(response && response.error ? response.error : "Feed-source removal failed.");
  }
  return response.result;
`);

const OPTIONAL_PROMPT_INFO_SCRIPT = `
  const notification = PopupNotifications.getNotification(
    "addon-webext-permissions",
    gBrowser.selectedBrowser
  );
  if (!notification) return null;
  return {
    id: notification.id,
    message: String(notification.message || ""),
    panelState: String(PopupNotifications.panel.state || ""),
    mainLabel: String(notification.mainAction?.label || ""),
    secondaryActionCount: notification.secondaryActions.length,
    secondaryLabel: String(notification.secondaryActions[0]?.label || "")
  };
`;

const ACCEPT_OPTIONAL_PROMPT_SCRIPT = `
  const notification = PopupNotifications.getNotification(
    "addon-webext-permissions",
    gBrowser.selectedBrowser
  );
  if (!notification || !notification.mainAction ||
      typeof notification.mainAction.callback !== "function") {
    return { accepted: false };
  }
  const label = String(notification.mainAction.label || "");
  notification.mainAction.callback();
  notification.remove();
  return { accepted: true, label };
`;

const DENY_OPTIONAL_PROMPT_SCRIPT = `
  const notification = PopupNotifications.getNotification(
    "addon-webext-permissions",
    gBrowser.selectedBrowser
  );
  if (!notification || !notification.secondaryActions[0] ||
      typeof notification.secondaryActions[0].callback !== "function") {
    return { denied: false };
  }
  const label = String(notification.secondaryActions[0].label || "");
  notification.secondaryActions[0].callback();
  notification.remove();
  return { denied: true, label };
`;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function executable(candidate) {
  if (!candidate) return false;
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch (_error) {
    return false;
  }
}

function findOnPath(names) {
  const directories = String(process.env.PATH || "").split(path.delimiter).filter(Boolean);
  for (const directory of directories) {
    for (const name of names) {
      const candidate = path.join(directory, name);
      if (executable(candidate)) return candidate;
    }
  }
  return null;
}

function findFirefox() {
  const candidates = [
    process.env.FIREFOX_PATH,
    "/usr/bin/firefox",
    "/usr/bin/firefox-esr",
    "/Applications/Firefox.app/Contents/MacOS/firefox",
    "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
    "C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe"
  ];
  return candidates.find(executable) || findOnPath(["firefox", "firefox-esr", "firefox.exe"]);
}

function findGeckodriver() {
  const candidates = [
    process.env.GECKODRIVER_PATH,
    "/usr/local/bin/geckodriver",
    "/usr/bin/geckodriver"
  ];
  return candidates.find(executable) || findOnPath(["geckodriver", "geckodriver.exe"]);
}

function findOpenSSL() {
  const candidates = [
    process.env.OPENSSL_PATH,
    "/usr/bin/openssl",
    "/usr/local/bin/openssl",
    "C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe"
  ];
  return candidates.find(executable) || findOnPath(["openssl", "openssl.exe"]);
}

function startServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, "http://127.0.0.1");
      const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
      const filePath = path.resolve(root, relativePath);
      if (!relativePath || !filePath.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
        response.end("Forbidden");
        return;
      }

      const content = await fsPromises.readFile(filePath);
      response.writeHead(200, {
        "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff"
      });
      response.end(content);
    } catch (_error) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

function createSyntheticTlsMaterial(opensslPath) {
  if (!opensslPath) throw new Error("OpenSSL is required for the synthetic Firefox HTTPS feed.");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "comb-firefox-feed-tls-"));
  const keyPath = path.join(directory, "feed-test.key.pem");
  const certificatePath = path.join(directory, "feed-test.cert.pem");
  try {
    execFileSync(opensslPath, [
      "req",
      "-x509",
      "-newkey", "rsa:2048",
      "-sha256",
      "-nodes",
      "-days", "2",
      "-subj", `/CN=${TEST_SOURCE_HOST}/O=Comb Synthetic Test Only`,
      "-addext", `subjectAltName=DNS:${TEST_SOURCE_HOST}`,
      "-addext", "keyUsage=digitalSignature,keyEncipherment",
      "-addext", "extendedKeyUsage=serverAuth",
      "-keyout", keyPath,
      "-out", certificatePath
    ], { stdio: "pipe" });
    return {
      directory,
      key: fs.readFileSync(keyPath),
      certificate: fs.readFileSync(certificatePath)
    };
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw new Error(`Could not create the synthetic Firefox TLS certificate: ${error.message}`);
  }
}

function listenLoopback(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

function trackSockets(server) {
  const sockets = new Set();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  return sockets;
}

async function closeTrackedServer(server, sockets) {
  if (!server) return;
  for (const socket of sockets || []) socket.destroy();
  if (!server.listening) return;
  await new Promise((resolve) => server.close(resolve));
}

async function startSyntheticFeedService(envelope, tlsMaterial) {
  let body = Buffer.from(JSON.stringify(envelope), "utf8");
  const requests = [];
  const tlsServer = https.createServer({
    key: tlsMaterial.key,
    cert: tlsMaterial.certificate
  }, (request, response) => {
    const record = {
      method: request.method,
      url: request.url,
      headers: { ...request.headers }
    };
    requests.push(record);
    if (
      request.method !== "GET" ||
      request.url !== TEST_SOURCE_PATH ||
      String(request.headers.host || "").toLowerCase() !== TEST_SOURCE_HOST
    ) {
      response.writeHead(404, {
        "content-type": "text/plain; charset=utf-8",
        connection: "close"
      });
      response.end("Synthetic feed not found.");
      return;
    }
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "content-length": body.length,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      connection: "close"
    });
    response.end(body);
  });
  const tlsSockets = trackSockets(tlsServer);
  const tlsPort = await listenLoopback(tlsServer);

  const proxyServer = http.createServer((_request, response) => {
    response.writeHead(405, { connection: "close" });
    response.end();
  });
  const proxySockets = trackSockets(proxyServer);
  proxyServer.on("connect", (request, clientSocket, head) => {
    const target = String(request.url || "").toLowerCase();
    if (target !== `${TEST_SOURCE_HOST}:443`) {
      clientSocket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }

    const upstream = net.connect(tlsPort, "127.0.0.1");
    upstream.once("connect", () => {
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head && head.length) upstream.write(head);
      clientSocket.pipe(upstream);
      upstream.pipe(clientSocket);
    });
    upstream.once("error", () => clientSocket.destroy());
    clientSocket.once("error", () => upstream.destroy());
  });
  const proxyPort = await listenLoopback(proxyServer);

  return {
    proxyPort,
    requests,
    setEnvelope(nextEnvelope) {
      body = Buffer.from(JSON.stringify(nextEnvelope), "utf8");
    },
    resetRequests() {
      requests.length = 0;
    },
    async close() {
      await closeTrackedServer(proxyServer, proxySockets);
      await closeTrackedServer(tlsServer, tlsSockets);
    }
  };
}

function reservePort() {
  const probe = net.createServer();
  return new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForWebDriver(port, driverProcess, stderrLines) {
  const endpoint = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (driverProcess.exitCode != null) {
      throw new Error(`geckodriver exited before becoming ready. ${stderrLines.join(" ")}`);
    }
    try {
      const response = await fetch(`${endpoint}/status`, {
        signal: AbortSignal.timeout(500)
      });
      const payload = await response.json();
      if (response.ok && payload?.value?.ready === true) return endpoint;
    } catch (_error) {
      // geckodriver can accept the process before its HTTP endpoint is ready.
    }
    await delay(50);
  }
  throw new Error(`Timed out waiting for geckodriver. ${stderrLines.join(" ")}`);
}

class WebDriverClient {
  constructor(endpoint) {
    this.endpoint = endpoint;
    this.sessionId = null;
    this.capabilities = null;
  }

  async request(method, relativePath, body, timeoutMs = 20_000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${this.endpoint}${relativePath}`, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
      const source = await response.text();
      let payload;
      try {
        payload = source ? JSON.parse(source) : { value: null };
      } catch (_error) {
        throw new Error(`WebDriver returned non-JSON HTTP ${response.status}: ${source.slice(0, 300)}`);
      }
      if (!response.ok || payload?.value?.error) {
        const detail = payload?.value || {};
        throw new Error(
          `${detail.error || `HTTP ${response.status}`}: ${detail.message || "WebDriver command failed"}` +
          `${detail.stacktrace ? `\n${detail.stacktrace}` : ""}`
        );
      }
      return payload.value;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(`${method} ${relativePath} timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async createSession(firefoxPath, options = {}) {
    const requestedPrefs = options.prefs && typeof options.prefs === "object"
      ? options.prefs
      : {};
    const result = await this.request("POST", "/session", {
      capabilities: {
        alwaysMatch: {
          browserName: "firefox",
          acceptInsecureCerts: options.acceptInsecureCerts === true,
          "moz:firefoxOptions": {
            binary: firefoxPath,
            args: ["-headless"],
            prefs: {
              "app.update.auto": false,
              "browser.shell.checkDefaultBrowser": false,
              "datareporting.healthreport.uploadEnabled": false,
              "datareporting.policy.dataSubmissionEnabled": false,
              "toolkit.telemetry.reportingpolicy.firstRun": false,
              ...requestedPrefs
            }
          }
        }
      }
    }, 30_000);
    if (!result?.sessionId) throw new Error("geckodriver did not return a Firefox session ID");
    this.sessionId = result.sessionId;
    this.capabilities = result.capabilities || {};
    await this.request("POST", `/session/${this.sessionId}/timeouts`, {
      implicit: 0,
      pageLoad: 15_000,
      script: 40_000
    });
    return this.capabilities;
  }

  async setContext(context) {
    if (!this.sessionId) throw new Error("Firefox WebDriver session is not initialized");
    if (!new Set(["content", "chrome"]).has(context)) {
      throw new TypeError("Firefox WebDriver context must be content or chrome");
    }
    await this.request("POST", `/session/${this.sessionId}/moz/context`, { context });
  }

  async installAddon(addonPath) {
    if (!this.sessionId) throw new Error("Firefox WebDriver session is not initialized");
    const absolutePath = path.resolve(addonPath);
    if (!fs.existsSync(absolutePath)) throw new Error(`Firefox add-on archive is missing: ${absolutePath}`);
    const addonId = await this.request(
      "POST",
      `/session/${this.sessionId}/moz/addon/install`,
      { path: absolutePath, temporary: true },
      30_000
    );
    if (typeof addonId !== "string" || !addonId) {
      throw new Error("geckodriver did not return the installed Firefox add-on ID");
    }
    return addonId;
  }

  async uninstallAddon(addonId) {
    if (!this.sessionId || !addonId) return;
    await this.request(
      "POST",
      `/session/${this.sessionId}/moz/addon/uninstall`,
      { id: addonId },
      15_000
    ).catch(() => undefined);
  }

  async navigate(url) {
    if (!this.sessionId) throw new Error("Firefox WebDriver session is not initialized");
    await this.request("POST", `/session/${this.sessionId}/url`, { url }, 20_000);
  }

  async executeScript(script, args = [], timeoutMs = 20_000) {
    if (!this.sessionId) throw new Error("Firefox WebDriver session is not initialized");
    return this.request(
      "POST",
      `/session/${this.sessionId}/execute/sync`,
      { script, args },
      timeoutMs
    );
  }

  async executeAsyncScript(script, args = [], timeoutMs = 20_000) {
    if (!this.sessionId) throw new Error("Firefox WebDriver session is not initialized");
    return this.request(
      "POST",
      `/session/${this.sessionId}/execute/async`,
      { script, args },
      Math.max(timeoutMs + 5_000, 25_000)
    );
  }

  async evaluate(expression, timeoutMs = 20_000) {
    const result = await this.executeAsyncScript(ASYNC_EVALUATE_SCRIPT, [expression], timeoutMs);
    if (!result || result.ok !== true) {
      throw new Error(result?.stack || result?.message || "Firefox evaluation failed");
    }
    return result.value;
  }

  async findElement(selector) {
    if (!this.sessionId) throw new Error("Firefox WebDriver session is not initialized");
    const element = await this.request(
      "POST",
      `/session/${this.sessionId}/element`,
      { using: "css selector", value: selector }
    );
    const elementId = element?.[WEB_DRIVER_ELEMENT] || element?.ELEMENT;
    if (typeof elementId !== "string" || !elementId) {
      throw new Error(`Firefox did not return an element for ${selector}`);
    }
    return elementId;
  }

  async sendKeys(selector, value) {
    const elementId = await this.findElement(selector);
    await this.request(
      "POST",
      `/session/${this.sessionId}/element/${encodeURIComponent(elementId)}/value`,
      { text: String(value) }
    );
  }

  async click(selector) {
    const elementId = await this.findElement(selector);
    await this.request(
      "POST",
      `/session/${this.sessionId}/element/${encodeURIComponent(elementId)}/click`,
      {}
    );
  }

  async deleteSession() {
    if (!this.sessionId) return;
    const sessionId = this.sessionId;
    this.sessionId = null;
    await this.request("DELETE", `/session/${sessionId}`, undefined, 10_000).catch(() => undefined);
  }
}

async function openPage(client, url) {
  await client.navigate(url);
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const ready = await client.evaluate(
      "document.readyState === 'complete' && Boolean(globalThis.CombCheckout) && Boolean(globalThis.fixtureState)"
    ).catch(() => false);
    if (ready) return;
    await delay(50);
  }
  throw new Error(`Firefox fixture did not become ready: ${url}`);
}

function unwrapPackagedResult(result, label) {
  if (!result || result.ok !== true) {
    throw new Error(result?.stack || result?.message || `${label} failed`);
  }
  return result.value;
}

async function openExtensionPage(client) {
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      await client.navigate(EXTENSION_OPTIONS_URL);
      const ready = await client.executeScript(`
        return document.readyState === "complete" &&
          typeof browser === "object" &&
          Boolean(document.querySelector("#sourceUrlInput")) &&
          Boolean(document.querySelector("#connectSourceButton"));
      `);
      if (ready) return;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(
    `Packaged Firefox options page did not become ready: ${EXTENSION_OPTIONS_URL}` +
    `${lastError ? ` (${lastError.message})` : ""}`
  );
}

async function createSyntheticFeedFixture(now = Date.now()) {
  const keyPair = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicKeyJwk = await webcrypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKeyJwk = await webcrypto.subtle.exportKey("jwk", keyPair.privateKey);
  const trustKey = await CombFeed.createTrustKeyDescriptor(
    "Firefox packaged smoke fixture",
    publicKeyJwk,
    new Date(now - 5 * 60_000).toISOString()
  );
  const payload = {
    schema: CombFeed.FEED_SCHEMA,
    feedId: TEST_FEED_ID,
    name: "Comb Firefox Synthetic Feed",
    sequence: 1,
    issuedAt: new Date(now - 60_000).toISOString(),
    expiresAt: new Date(now + 14 * 24 * 60 * 60_000).toISOString(),
    keyId: trustKey.keyId,
    entries: [{
      merchant: "shop.example",
      code: "CREATOR10",
      lastVerifiedAt: new Date(now - 2 * 60_000).toISOString(),
      successCount: 8,
      failureCount: 1
    }]
  };
  const envelope = await CombFeed.signPayload(payload, privateKeyJwk, trustKey.keyId, { now });
  return { trustKey, envelope };
}

async function createSyntheticTrustKey() {
  return (await createSyntheticFeedFixture()).trustKey;
}

async function waitForOptionalPermissionPrompt(client) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const prompt = await client.executeScript(OPTIONAL_PROMPT_INFO_SCRIPT).catch(() => null);
    if (prompt) return prompt;
    await delay(50);
  }
  throw new Error("Firefox did not expose the optional-origin permission prompt");
}

async function waitForOptionsStatus(client, pattern) {
  const deadline = Date.now() + 10_000;
  let lastStatus = "";
  while (Date.now() < deadline) {
    lastStatus = await client.executeScript(
      'return String(document.querySelector("#pageStatus")?.textContent || "");'
    ).catch(() => "");
    if (pattern.test(lastStatus)) return lastStatus;
    await delay(50);
  }
  throw new Error(
    `Firefox options status did not match ${pattern}; last status was ${JSON.stringify(lastStatus)}`
  );
}

async function waitForPackagedAlarm(client, present) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const result = await client.executeAsyncScript(
      EXTENSION_ALARM_STATE_SCRIPT,
      [FEED_REFRESH_ALARM]
    ).then((value) => unwrapPackagedResult(value, "packaged Firefox alarm state"))
      .catch(() => null);
    if (result && Boolean(result.alarm) === present && result.listed === present) return result;
    await delay(50);
  }
  throw new Error(`Packaged Firefox alarm did not become ${present ? "scheduled" : "cleared"}`);
}

function assertSingleBoundedFeedRequest(feedService, label) {
  const feedRequests = feedService.requests.filter(
    (request) => request.method === "GET" && request.url === TEST_SOURCE_PATH
  );
  assert.equal(feedRequests.length, 1, `${label} must make one bounded request`);
  const [feedRequest] = feedRequests;
  assert.equal(feedRequest.method, "GET");
  assert.equal(feedRequest.url, TEST_SOURCE_PATH);
  assert.equal(feedRequest.headers.host, TEST_SOURCE_HOST);
  assert.equal(feedRequest.headers.accept, "application/json");
  assert.equal(feedRequest.headers.cookie, undefined, `${label} must omit cookies`);
  assert.equal(feedRequest.headers.referer, undefined, `${label} must omit the referrer`);
  return feedRequest;
}

async function verifyPackagedExtension(client, runtimePath, feedFixture, feedService) {
  let addonId;
  try {
    addonId = await client.installAddon(runtimePath);
    assert.equal(addonId, ADDON_ID, "installed package add-on ID changed");
    await openExtensionPage(client);

    const startup = unwrapPackagedResult(
      await client.executeAsyncScript(EXTENSION_STARTUP_SCRIPT, [TEST_ORIGIN_PATTERN]),
      "packaged Firefox startup"
    );
    assert.equal(startup.manifest.version, manifest.version);
    assert.equal(startup.optionsUrl, EXTENSION_OPTIONS_URL);
    assert.equal(startup.originGranted, false, "optional feed origin must not be pre-granted");
    assert.equal(startup.stateResponse?.ok, true, "packaged background did not answer settings");
    assert.equal(startup.stateResponse.result.version, 2);
    assert.deepEqual(startup.stateResponse.result.trustedKeys, []);
    assert.deepEqual(startup.stateResponse.result.feeds, []);
    assert.deepEqual(startup.stateResponse.result.sources, []);
    process.stdout.write("✓ packaged Firefox runtime installation and background startup\n");

    const { trustKey } = feedFixture;
    const importedState = unwrapPackagedResult(
      await client.executeAsyncScript(EXTENSION_IMPORT_KEY_SCRIPT, [trustKey]),
      "packaged trust-key import"
    );
    assert.equal(importedState.trustedKeys.length, 1);
    assert.equal(importedState.trustedKeys[0].keyId, trustKey.keyId);

    await openExtensionPage(client);
    const controls = await client.executeScript(`
      return {
        sourceDisabled: document.querySelector("#sourceUrlInput").disabled,
        buttonDisabled: document.querySelector("#connectSourceButton").disabled
      };
    `);
    assert.deepEqual(controls, { sourceDisabled: false, buttonDisabled: false });
    await client.sendKeys("#sourceUrlInput", TEST_SOURCE_URL);
    await client.click("#connectSourceButton");

    await client.setContext("chrome");
    let prompt;
    let denial;
    try {
      prompt = await waitForOptionalPermissionPrompt(client);
      denial = await client.executeScript(DENY_OPTIONAL_PROMPT_SCRIPT);
    } finally {
      await client.setContext("content");
    }
    assert.equal(prompt.id, "addon-webext-permissions");
    assert.ok(prompt.secondaryActionCount >= 1, "optional-origin prompt must expose a denial action");
    assert.ok(prompt.secondaryLabel, "optional-origin denial action must have a visible label");
    assert.equal(denial.denied, true, "optional-origin prompt denial did not run");
    await waitForOptionsStatus(client, /browser did not grant access to that feed origin/i);

    const permissionAfterDenial = unwrapPackagedResult(
      await client.executeAsyncScript(EXTENSION_PERMISSION_STATE_SCRIPT, [TEST_ORIGIN_PATTERN]),
      "optional-origin denial state"
    );
    assert.equal(permissionAfterDenial, false, "denied optional origin must remain ungranted");
    const stateAfterDenial = unwrapPackagedResult(
      await client.executeAsyncScript(EXTENSION_STARTUP_SCRIPT, [TEST_ORIGIN_PATTERN]),
      "post-denial packaged state"
    );
    assert.deepEqual(stateAfterDenial.stateResponse.result.sources, []);
    process.stdout.write("✓ packaged Firefox optional-origin prompt and denial cleanup\n");

    feedService.resetRequests();
    await client.navigate(TEST_SOURCE_URL);
    const certificateProbeRequests = feedService.requests.filter(
      (request) => request.method === "GET" && request.url === TEST_SOURCE_PATH
    );
    assert.equal(certificateProbeRequests.length, 1, "synthetic HTTPS certificate probe changed");
    feedService.resetRequests();

    const tamperedEnvelope = structuredClone(feedFixture.envelope);
    tamperedEnvelope.payload.entries[0].code = "TAMPERED10";
    feedService.setEnvelope(tamperedEnvelope);

    await openExtensionPage(client);
    await client.sendKeys("#sourceUrlInput", TEST_SOURCE_URL);
    await client.click("#connectSourceButton");

    await client.setContext("chrome");
    let invalidFeedPrompt;
    let invalidFeedAcceptance;
    try {
      invalidFeedPrompt = await waitForOptionalPermissionPrompt(client);
      invalidFeedAcceptance = await client.executeScript(ACCEPT_OPTIONAL_PROMPT_SCRIPT);
    } finally {
      await client.setContext("content");
    }
    assert.equal(invalidFeedPrompt.id, "addon-webext-permissions");
    assert.ok(invalidFeedPrompt.mainLabel, "invalid-feed approval must have a visible label");
    assert.equal(invalidFeedAcceptance.accepted, true, "invalid-feed prompt approval did not run");
    await waitForOptionsStatus(
      client,
      /source connection failed: feed signature verification failed/i
    );
    assertSingleBoundedFeedRequest(feedService, "tampered packaged source");

    const stateAfterInvalidFeed = unwrapPackagedResult(
      await client.executeAsyncScript(EXTENSION_STARTUP_SCRIPT, [TEST_ORIGIN_PATTERN]),
      "post-invalid-feed packaged state"
    );
    assert.equal(
      stateAfterInvalidFeed.originGranted,
      false,
      "signature failure must remove the newly approved optional origin"
    );
    assert.equal(stateAfterInvalidFeed.stateResponse.result.trustedKeys.length, 1);
    assert.deepEqual(stateAfterInvalidFeed.stateResponse.result.feeds, []);
    assert.deepEqual(stateAfterInvalidFeed.stateResponse.result.sources, []);
    await waitForPackagedAlarm(client, false);
    process.stdout.write("✓ packaged Firefox invalid-feed origin rollback\n");

    feedService.setEnvelope(feedFixture.envelope);
    feedService.resetRequests();

    await openExtensionPage(client);
    await client.sendKeys("#sourceUrlInput", TEST_SOURCE_URL);
    await client.click("#connectSourceButton");

    await client.setContext("chrome");
    let acceptancePrompt;
    let acceptance;
    try {
      acceptancePrompt = await waitForOptionalPermissionPrompt(client);
      acceptance = await client.executeScript(ACCEPT_OPTIONAL_PROMPT_SCRIPT);
    } finally {
      await client.setContext("content");
    }
    assert.equal(acceptancePrompt.id, "addon-webext-permissions");
    assert.ok(acceptancePrompt.mainLabel, "optional-origin approval action must have a visible label");
    assert.equal(acceptance.accepted, true, "optional-origin prompt approval did not run");
    await waitForOptionsStatus(client, /source approved, signature verified/i);

    const connected = unwrapPackagedResult(
      await client.executeAsyncScript(EXTENSION_STARTUP_SCRIPT, [TEST_ORIGIN_PATTERN]),
      "packaged Firefox connected-source state"
    );
    assert.equal(connected.originGranted, true, "approved optional origin must be granted");
    assert.equal(connected.stateResponse.result.trustedKeys.length, 1);
    assert.equal(connected.stateResponse.result.feeds.length, 1);
    assert.equal(connected.stateResponse.result.feeds[0].feedId, TEST_FEED_ID);
    assert.equal(connected.stateResponse.result.feeds[0].entryCount, 1);
    assert.equal(connected.stateResponse.result.sources.length, 1);
    assert.equal(connected.stateResponse.result.sources[0].feedId, TEST_FEED_ID);
    assert.equal(connected.stateResponse.result.sources[0].url, TEST_SOURCE_URL);
    assert.equal(connected.stateResponse.result.sources[0].status, "ok");

    assertSingleBoundedFeedRequest(feedService, "valid packaged source");

    const alarmResult = await waitForPackagedAlarm(client, true);
    assert.equal(alarmResult.alarm.name, FEED_REFRESH_ALARM);
    assert.equal(alarmResult.alarm.periodInMinutes, FEED_REFRESH_MINUTES);
    assert.equal(alarmResult.listed, true);

    const sourceDeletion = unwrapPackagedResult(
      await client.executeAsyncScript(EXTENSION_DELETE_SOURCE_SCRIPT, [TEST_FEED_ID]),
      "packaged Firefox approved-source cleanup"
    );
    assert.deepEqual(sourceDeletion.state.sources, []);
    assert.equal(sourceDeletion.state.feeds.length, 1, "source removal must retain its verified feed");
    assert.equal(sourceDeletion.removedOriginPattern, TEST_ORIGIN_PATTERN);
    assert.equal(sourceDeletion.originStillUsed, false);
    assert.equal(sourceDeletion.permissionRemoved, true);
    await waitForPackagedAlarm(client, false);
    const permissionAfterRemoval = unwrapPackagedResult(
      await client.executeAsyncScript(EXTENSION_PERMISSION_STATE_SCRIPT, [TEST_ORIGIN_PATTERN]),
      "packaged Firefox removed-origin state"
    );
    assert.equal(permissionAfterRemoval, false, "source cleanup must remove its unused origin grant");

    const keyDeletion = unwrapPackagedResult(
      await client.executeAsyncScript(EXTENSION_DELETE_KEY_SCRIPT, [trustKey.keyId]),
      "packaged Firefox trust-key cleanup"
    );
    assert.deepEqual(keyDeletion.state.trustedKeys, []);
    assert.deepEqual(keyDeletion.state.feeds, []);
    assert.deepEqual(keyDeletion.state.sources, []);
    process.stdout.write("✓ packaged Firefox signed-feed acceptance and bounded request\n");
    process.stdout.write("✓ packaged Firefox production alarm, source, and origin cleanup\n");
  } finally {
    await client.setContext("content").catch(() => undefined);
    await client.uninstallAddon(addonId);
  }
}

function waitForProcessExit(childProcess, timeoutMs) {
  if (!childProcess || childProcess.exitCode != null || childProcess.signalCode != null) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    const timeout = setTimeout(() => {
      childProcess.off("exit", onExit);
      resolve(false);
    }, timeoutMs);
    childProcess.once("exit", onExit);
  });
}

async function stopProcess(childProcess) {
  if (!childProcess || childProcess.exitCode != null || childProcess.signalCode != null) return;
  childProcess.kill("SIGTERM");
  if (await waitForProcessExit(childProcess, 5_000)) return;
  childProcess.kill("SIGKILL");
  await waitForProcessExit(childProcess, 2_000);
}

async function main() {
  const firefoxPath = findFirefox();
  const geckodriverPath = findGeckodriver();
  const opensslPath = findOpenSSL();
  if (!firefoxPath || !geckodriverPath || !opensslPath) {
    const missing = [
      !firefoxPath ? "Firefox" : null,
      !geckodriverPath ? "geckodriver" : null,
      !opensslPath ? "OpenSSL" : null
    ].filter(Boolean).join(", ").replace(/, ([^,]+)$/, " and $1");
    const message = `${missing} not found; Firefox fixtures did not run.`;
    if (requireBrowser) throw new Error(message);
    process.stdout.write(`SKIP: ${message} CI installs and requires all three.\n`);
    return;
  }

  let server;
  let feedService;
  let tlsMaterial;
  let driverProcess;
  let client;
  const stderrLines = [];
  try {
    const feedFixture = await createSyntheticFeedFixture();
    tlsMaterial = createSyntheticTlsMaterial(opensslPath);
    feedService = await startSyntheticFeedService(feedFixture.envelope, tlsMaterial);
    const startedServer = await startServer();
    server = startedServer.server;
    const port = await reservePort();
    driverProcess = spawn(
      geckodriverPath,
      ["--allow-system-access", "--host", "127.0.0.1", "--port", String(port)],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
    driverProcess.stderr.setEncoding("utf8");
    driverProcess.stderr.on("data", (chunk) => {
      stderrLines.push(String(chunk).replace(/\s+/g, " ").trim().slice(0, 500));
      if (stderrLines.length > 8) stderrLines.shift();
    });

    const endpoint = await waitForWebDriver(port, driverProcess, stderrLines);
    client = new WebDriverClient(endpoint);
    const capabilities = await client.createSession(firefoxPath, {
      acceptInsecureCerts: true,
      prefs: {
        "extensions.webextensions.uuids": JSON.stringify({ [ADDON_ID]: EXTENSION_UUID }),
        "network.captive-portal-service.enabled": false,
        "network.connectivity-service.enabled": false,
        "network.proxy.allow_hijacking_localhost": true,
        "network.proxy.no_proxies_on": "localhost, 127.0.0.1",
        "network.proxy.ssl": "127.0.0.1",
        "network.proxy.ssl_port": feedService.proxyPort,
        "network.proxy.type": 1
      }
    });
    await runCheckoutFixtureSuite({
      baseUrl: startedServer.baseUrl,
      evaluate: (expression, timeoutMs) => client.evaluate(expression, timeoutMs),
      openPage: (url) => openPage(client, url)
    });
    process.stdout.write(
      `Comb real-Firefox checkout suite passed in Firefox ${capabilities.browserVersion || "unknown"}.\n`
    );

    const firefoxMajor = Number.parseInt(String(capabilities.browserVersion || ""), 10);
    if (!Number.isInteger(firefoxMajor) || firefoxMajor < 138) {
      const message = "Firefox 138+ is required for packaged permission-prompt system access.";
      if (requireBrowser) throw new Error(message);
      process.stdout.write(`SKIP: ${message}\n`);
    } else {
      execFileSync(process.execPath, ["scripts/build-release.js", "--verify"], {
        cwd: root,
        stdio: "inherit"
      });
      await verifyPackagedExtension(
        client,
        path.join(root, "dist", `comb-${manifest.version}.zip`),
        feedFixture,
        feedService
      );
      process.stdout.write(
        `Comb packaged Firefox extension suite passed in Firefox ${capabilities.browserVersion}.\n`
      );
    }
  } finally {
    if (client) await client.deleteSession();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (feedService) await feedService.close();
    await stopProcess(driverProcess);
    if (tlsMaterial) fs.rmSync(tlsMaterial.directory, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Comb Firefox fixtures failed: ${error.stack || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  ASYNC_EVALUATE_SCRIPT,
  EXTENSION_ALARM_STATE_SCRIPT,
  EXTENSION_DELETE_KEY_SCRIPT,
  EXTENSION_DELETE_SOURCE_SCRIPT,
  EXTENSION_STARTUP_SCRIPT,
  WebDriverClient,
  createSyntheticFeedFixture,
  createSyntheticTlsMaterial,
  createSyntheticTrustKey,
  findFirefox,
  findGeckodriver,
  findOpenSSL,
  openPage,
  reservePort,
  startSyntheticFeedService,
  unwrapPackagedResult,
  waitForWebDriver
};
