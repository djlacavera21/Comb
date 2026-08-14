"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const requireBrowser = process.argv.includes("--require-browser");
const fixtureMatrix = JSON.parse(
  fs.readFileSync(path.join(root, "tests/fixtures/support-matrix.json"), "utf8")
);
const fixturesByFile = new Map(fixtureMatrix.fixtures.map((fixture) => [fixture.file, fixture]));
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ].filter(Boolean);

  return candidates.find((candidate) => {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return true;
    } catch (_error) {
      return false;
    }
  }) || null;
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

async function waitForDevTools(profileDirectory, chromeProcess, stderrLines) {
  const activePortPath = path.join(profileDirectory, "DevToolsActivePort");
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    if (chromeProcess.exitCode != null) {
      throw new Error(`Chrome exited before DevTools was ready. ${stderrLines.join(" ")}`);
    }
    try {
      const lines = (await fsPromises.readFile(activePortPath, "utf8")).trim().split(/\r?\n/);
      const port = Number(lines[0]);
      if (Number.isInteger(port) && port > 0) return port;
    } catch (_error) {
      // Chrome creates the file after its debugging endpoint is listening.
    }
    await delay(50);
  }

  throw new Error(`Timed out waiting for Chrome DevTools. ${stderrLines.join(" ")}`);
}

async function findPageTarget(port) {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch (_error) {
      // The endpoint can become reachable a moment after DevToolsActivePort appears.
    }
    await delay(50);
  }

  throw new Error("Chrome did not expose a debuggable page target.");
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => this.onMessage(event.data));
    socket.addEventListener("close", () => this.failPending(new Error("Chrome DevTools disconnected.")));
    socket.addEventListener("error", () => this.failPending(new Error("Chrome DevTools socket failed.")));
  }

  static connect(url) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error("Timed out connecting to Chrome DevTools."));
      }, 10_000);
      socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve(new CdpClient(socket));
      }, { once: true });
      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("Could not connect to Chrome DevTools."));
      }, { once: true });
    });
  }

  onMessage(rawMessage) {
    let message;
    try {
      message = JSON.parse(String(rawMessage));
    } catch (_error) {
      return;
    }

    if (!message.id || !this.pending.has(message.id)) return;
    const pending = this.pending.get(message.id);
    this.pending.delete(message.id);
    clearTimeout(pending.timeout);
    if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
    else pending.resolve(message.result || {});
  }

  failPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }

  send(method, params = {}, timeoutMs = 20_000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out.`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression, timeoutMs = 20_000) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  }, timeoutMs);
  if (response.exceptionDetails) {
    const description = response.exceptionDetails.exception && response.exceptionDetails.exception.description;
    throw new Error(description || response.exceptionDetails.text || "Browser evaluation failed.");
  }
  return response.result ? response.result.value : undefined;
}

async function openUrl(client, url, readyExpression) {
  await client.send("Page.navigate", { url });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const ready = await evaluate(client, readyExpression).catch(() => false);
    if (ready) return;
    await delay(50);
  }
  throw new Error(`Fixture did not become ready: ${url}`);
}

function openPage(client, url) {
  return openUrl(
    client,
    url,
    "document.readyState === 'complete' && Boolean(globalThis.CombCheckout) && Boolean(globalThis.fixtureState)"
  );
}

async function browserRun(client, codes) {
  return evaluate(client, `globalThis.CombCheckout.runCoupons(document, ${JSON.stringify(codes)}, {
    settle: { minimumMs: 250, maximumMs: 600, quietMs: 150 }
  })`, 30_000);
}

function assertFixtureState(state, expected) {
  assert.equal(state.applyClicks, expected.applyClicks, "synthetic Apply click count changed");
  assert.equal(state.removeClicks, expected.removeClicks, "synthetic removal click count changed");
  if (expected.zeroPurchaseClicks) {
    assert.equal(state.dangerClicks, 0, "purchase controls must never be clicked");
  }
}

function assertSafeStopResult(result, specification) {
  const expected = specification.expected;
  assert.equal(result.status, expected.status, `${specification.file} status contract changed`);
  assert.equal(result.reason, expected.reason, `${specification.file} reason contract changed`);
  assert.equal(result.scan.adapter, specification.adapter, `${specification.file} adapter contract changed`);
  assert.equal(result.scan.detected, expected.detected, `${specification.file} detection contract changed`);
  assert.equal(result.scan.engineVersion, fixtureMatrix.engineVersion);
  assert.equal(result.scan.total.currency, specification.currency);
  assert.ok(Math.abs(result.scan.total.amount - specification.baseline) < 0.01);
  if (expected.tested === null) {
    assert.equal(result.results.length, 0, `${specification.file} must stop before a coupon attempt`);
  } else {
    assert.equal(result.tested, expected.tested, `${specification.file} attempt count changed`);
  }
  assert.equal(result.best?.code || null, expected.bestCode);
  assert.equal(result.bestCandidate?.code || null, expected.bestCandidateCode);
  if (expected.savings !== null) {
    const measured = result.best?.savings ?? result.bestCandidate?.savings;
    assert.ok(Math.abs(measured - expected.savings) < 0.01);
  }
}

async function verifyHappyFixture(client, baseUrl, specification) {
  const expected = specification.expected;
  const attributionQuery = expected.creatorAttributionPreserved
    ? "?affiliate_id=creator-42&utm_source=creator"
    : "";
  await openPage(client, `${baseUrl}/tests/fixtures/${specification.file}${attributionQuery}`);
  const attributionBefore = expected.creatorAttributionPreserved
    ? await evaluate(client, `(() => {
        document.cookie = "creator_attribution=creator-42; Path=/; SameSite=Lax";
        return { href: location.href, cookie: document.cookie };
      })()`)
    : null;
  const scan = await evaluate(client, "globalThis.CombCheckout.scanCheckout(document)");
  assert.equal(scan.detected, expected.detected, `${specification.file} detection contract changed`);
  assert.equal(scan.adapter, specification.adapter);
  assert.equal(scan.engineVersion, fixtureMatrix.engineVersion);
  assert.equal(scan.total.currency, specification.currency);
  assert.ok(Math.abs(scan.total.amount - specification.baseline) < 0.01);
  assert.equal(scan.existingCouponCount, 0);

  const result = await browserRun(client, ["SHIPFREE", "BEST20", "NOTREAL"]);
  assert.equal(result.status, expected.status);
  assert.equal(result.reason, expected.reason);
  assert.equal(result.best.code, expected.bestCode);
  assert.equal(result.tested, expected.tested);
  assert.ok(Math.abs(result.finalTotal - (specification.baseline - expected.savings)) < 0.01);
  const state = await evaluate(client, "globalThis.fixtureState");
  assertFixtureState(state, expected);
  assert.equal(state.appliedCode, expected.bestCode);
  if (expected.creatorAttributionPreserved) {
    const attributionAfter = await evaluate(client, "({ href: location.href, cookie: document.cookie })");
    assert.deepEqual(attributionAfter, attributionBefore, "creator URL tags and attribution cookie must remain unchanged");
    process.stdout.write("✓ creator URL and cookie attribution preservation\n");
  }
}

async function runFixtureSuite(client, baseUrl) {
  const happyFixtures = fixtureMatrix.fixtures.filter((fixture) => fixture.contract === "happy-path");
  const expectedSafeStopFiles = [
    "ambiguous.html",
    "currency-drift.html",
    "existing-coupon.html",
    "removal-failure.html",
    "restoration-mismatch.html"
  ];
  assert.deepEqual(
    fixtureMatrix.fixtures
      .filter((fixture) => fixture.contract === "safe-stop")
      .map((fixture) => fixture.file)
      .sort(),
    expectedSafeStopFiles,
    "every matrix safe-stop contract must have an executed specialized assertion"
  );

  for (const specification of happyFixtures) {
    await verifyHappyFixture(client, baseUrl, specification);
    process.stdout.write(`✓ ${specification.adapter} browser contract\n`);
  }

  const ambiguous = fixturesByFile.get("ambiguous.html");
  await openPage(client, `${baseUrl}/tests/fixtures/${ambiguous.file}`);
  const ambiguousScan = await evaluate(client, "globalThis.CombCheckout.scanCheckout(document)");
  assert.equal(ambiguousScan.detected, ambiguous.expected.detected);
  assert.equal(ambiguousScan.reason, ambiguous.expected.reason);
  const ambiguousRun = await browserRun(client, ["SAVE10"]);
  assertSafeStopResult(ambiguousRun, ambiguous);
  assertFixtureState(await evaluate(client, "globalThis.fixtureState"), ambiguous.expected);
  process.stdout.write("✓ ambiguous purchase control refusal\n");

  const existing = fixturesByFile.get("existing-coupon.html");
  await openPage(client, `${baseUrl}/tests/fixtures/${existing.file}`);
  const existingRun = await browserRun(client, ["SAVE10"]);
  assertSafeStopResult(existingRun, existing);
  assertFixtureState(await evaluate(client, "globalThis.fixtureState"), existing.expected);
  process.stdout.write("✓ existing-coupon safety gate\n");

  const removalFailure = fixturesByFile.get("removal-failure.html");
  await openPage(client, `${baseUrl}/tests/fixtures/${removalFailure.file}`);
  const failedRemoval = await browserRun(client, ["SAVE10", "BEST20"]);
  assertSafeStopResult(failedRemoval, removalFailure);
  const failureState = await evaluate(client, "globalThis.fixtureState");
  assertFixtureState(failureState, removalFailure.expected);
  assert.equal(failureState.appliedCode, removalFailure.expected.bestCode);
  process.stdout.write("✓ failed-removal stop and no stacking\n");

  const restorationMismatch = fixturesByFile.get("restoration-mismatch.html");
  await openPage(client, `${baseUrl}/tests/fixtures/${restorationMismatch.file}`);
  const incompleteRestoration = await browserRun(client, ["SAVE10", "BEST20"]);
  assertSafeStopResult(incompleteRestoration, restorationMismatch);
  assert.equal(incompleteRestoration.best, null, "an unverified partial removal must not be reported as applied");
  assert.equal(incompleteRestoration.bestCandidate.code, restorationMismatch.expected.bestCandidateCode);
  const incompleteState = await evaluate(client, "globalThis.fixtureState");
  assertFixtureState(incompleteState, restorationMismatch.expected);
  assert.equal(incompleteState.appliedCode, null);
  process.stdout.write("✓ marker removal without baseline restoration stops safely\n");

  const currencyDriftFixture = fixturesByFile.get("currency-drift.html");
  await openPage(client, `${baseUrl}/tests/fixtures/${currencyDriftFixture.file}`);
  const currencyDrift = await browserRun(client, ["NOTREAL", "BEST20"]);
  assertSafeStopResult(currencyDrift, currencyDriftFixture);
  const driftState = await evaluate(client, "globalThis.fixtureState");
  assertFixtureState(driftState, currencyDriftFixture.expected);
  process.stdout.write("✓ checkout currency drift stop\n");
}

const chromeUiStub = `(() => {
  const feedState = {
    version: 2,
    trustedKeys: [{
      keyId: "sha256-accessibility-fixture",
      name: "Accessibility Fixture Publisher",
      algorithm: "ECDSA_P256_SHA256",
      createdAt: "2026-01-01T00:00:00.000Z"
    }],
    feeds: [],
    sources: []
  };
  globalThis.chrome = {
    runtime: {
      onMessage: { addListener() {} },
      openOptionsPage() {},
      getManifest() { return { version: "${fixtureMatrix.engineVersion}" }; },
      async sendMessage(message) {
        if (message.type === "COMB_GET_LIBRARY") {
          return { ok: true, result: { version: 1, merchants: {} } };
        }
        if (message.type === "COMB_GET_FEED_STATE") {
          return { ok: true, result: feedState };
        }
        if (message.type === "COMB_INIT") {
          return {
            ok: true,
            result: {
              tabId: 1,
              hostname: "fixture.local",
              localCodes: ["SAVE10"],
              communityCodes: [],
              codes: ["SAVE10"],
              scan: {
                detected: true,
                adapter: "generic",
                adapterLabel: "Generic checkout",
                existingCouponCount: 0,
                total: { amount: 132.95, currency: "USD" }
              }
            }
          };
        }
        return { ok: true, result: {} };
      }
    },
    tabs: { async query() { return [{ id: 1 }]; } },
    permissions: {
      async request() { return true; },
      async remove() { return true; }
    }
  };
})();`;

const accessibleControlAudit = `(() => {
  function visible(element) {
    const style = getComputedStyle(element);
    return !element.hidden && style.display !== "none" && style.visibility !== "hidden";
  }
  function accessibleName(element) {
    const labelledBy = String(element.getAttribute("aria-labelledby") || "")
      .split(/\\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent || "")
      .join(" ");
    const labels = element.labels ? Array.from(element.labels).map((label) => label.textContent || "").join(" ") : "";
    return [
      element.getAttribute("aria-label"),
      labelledBy,
      labels,
      element.textContent,
      element.value,
      element.title
    ].filter(Boolean).join(" ").trim();
  }
  return Array.from(document.querySelectorAll("button, input, textarea, select, a[href]"))
    .filter((element) => visible(element) && !element.disabled && element.type !== "hidden")
    .filter((element) => !accessibleName(element))
    .map((element) => element.id || element.outerHTML.slice(0, 100));
})()`;

async function pressTab(client) {
  const key = {
    key: "Tab",
    code: "Tab",
    windowsVirtualKeyCode: 9,
    nativeVirtualKeyCode: 9
  };
  await client.send("Input.dispatchKeyEvent", { type: "keyDown", ...key });
  await client.send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
  return evaluate(client, `({
    id: document.activeElement && document.activeElement.id,
    ariaLabel: document.activeElement && document.activeElement.getAttribute("aria-label"),
    outlineStyle: getComputedStyle(document.activeElement).outlineStyle,
    outlineWidth: getComputedStyle(document.activeElement).outlineWidth
  })`);
}

async function verifyUiAccessibility(client, baseUrl) {
  await client.send("Page.addScriptToEvaluateOnNewDocument", { source: chromeUiStub });

  await openUrl(
    client,
    `${baseUrl}/src/popup/popup.html`,
    "document.readyState === 'complete' && !document.querySelector('#codesInput').disabled"
  );
  assert.deepEqual(await evaluate(client, accessibleControlAudit), []);
  const safeReport = await evaluate(client, `globalThis.CombCompatibilityReport.stringifyCompatibilityReport({
    detected: false,
    adapter: "generic",
    reason: "coupon_apply_button_not_found",
    input: { id: "coupon-creator-42", label: "alex@example.test" },
    total: { amount: 132.95, currency: "USD" },
    hostname: "fixture.local",
    codes: ["SAVE10"],
    attribution: { affiliateId: "creator-secret" }
  }, {
    extensionVersion: fixtureMatrix.engineVersion,
    generatedAt: "2026-08-14T12:00:00.000Z"
  })`);
  const parsedReport = JSON.parse(safeReport);
  assert.equal(parsedReport.schema, "comb.compatibility-report/v1");
  assert.equal(parsedReport.compatibility.adapter, "generic");
  assert.equal(parsedReport.creatorAttribution.protected, true);
  assert.equal(parsedReport.privacy.automaticUpload, false);
  assert.equal(parsedReport.privacy.sharingRequiresSeparateUserAction, true);
  for (const secret of ["fixture.local", "132.95", "USD", "SAVE10", "creator-secret", "alex@example.test", "coupon-creator-42"]) {
    assert.equal(safeReport.includes(secret), false, `safe report leaked ${secret}`);
  }
  process.stdout.write("✓ privacy-safe compatibility report contract\n");
  await evaluate(client, "document.activeElement && document.activeElement.blur()");
  const popupFocusOrder = [];
  for (let index = 0; index < 5; index += 1) popupFocusOrder.push(await pressTab(client));
  assert.deepEqual(
    popupFocusOrder.map((entry) => entry.id),
    ["optionsButton", "codesInput", "runButton", "reportButton", "privacyButton"]
  );
  for (const entry of popupFocusOrder) {
    assert.notEqual(entry.outlineStyle, "none", `${entry.id} must show keyboard focus`);
    assert.notEqual(entry.outlineWidth, "0px", `${entry.id} must show keyboard focus`);
  }
  assert.equal(
    await evaluate(client, "document.querySelector('#progressTrack').getAttribute('role')"),
    "progressbar"
  );
  process.stdout.write("✓ popup keyboard and accessible-name contract\n");

  await openUrl(
    client,
    `${baseUrl}/src/options/options.html`,
    "document.readyState === 'complete' && document.querySelector('#feedSummaryCount').textContent.includes('1 key')"
  );
  assert.deepEqual(await evaluate(client, accessibleControlAudit), []);
  assert.equal(
    await evaluate(client, "Array.from(document.querySelectorAll('input[type=file]')).every((input) => input.tabIndex === -1)"),
    true
  );
  await evaluate(client, "document.activeElement && document.activeElement.blur()");
  const optionsFocusOrder = [];
  for (let index = 0; index < 6; index += 1) optionsFocusOrder.push(await pressTab(client));
  assert.deepEqual(optionsFocusOrder.map((entry) => entry.id), [
    "trustKeyButton",
    "",
    "signedFeedButton",
    "sourceUrlInput",
    "connectSourceButton",
    "importButton"
  ]);
  assert.match(optionsFocusOrder[1].ariaLabel, /^Remove trusted key /);
  for (const entry of optionsFocusOrder) {
    assert.notEqual(entry.outlineStyle, "none", `${entry.id || entry.ariaLabel} must show keyboard focus`);
    assert.notEqual(entry.outlineWidth, "0px", `${entry.id || entry.ariaLabel} must show keyboard focus`);
  }
  process.stdout.write("✓ settings keyboard and file-import contract\n");
}

function waitForProcessExit(chromeProcess, timeoutMs) {
  if (chromeProcess.exitCode != null || chromeProcess.signalCode != null) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    const timeout = setTimeout(() => {
      chromeProcess.off("exit", onExit);
      resolve(false);
    }, timeoutMs);
    chromeProcess.once("exit", onExit);
  });
}

async function stopChrome(chromeProcess) {
  if (!chromeProcess || chromeProcess.exitCode != null || chromeProcess.signalCode != null) return;
  chromeProcess.kill("SIGTERM");
  if (await waitForProcessExit(chromeProcess, 5_000)) return;
  chromeProcess.kill("SIGKILL");
  await waitForProcessExit(chromeProcess, 2_000);
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) {
    const message = "Chrome was not found; browser fixtures did not run.";
    if (requireBrowser) throw new Error(message);
    process.stdout.write(`SKIP: ${message} CI runs this suite with a required browser.\n`);
    return;
  }

  const profileDirectory = await fsPromises.mkdtemp(path.join(os.tmpdir(), "comb-browser-fixtures-"));
  let server;
  let chromeProcess;
  let client;
  const stderrLines = [];

  try {
    const startedServer = await startServer();
    server = startedServer.server;
    const chromeArguments = [
      "--headless",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-sync",
      "--metrics-recording-only",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDirectory}`,
      "about:blank"
    ];
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      chromeArguments.unshift("--no-sandbox");
    }
    chromeProcess = spawn(chromePath, chromeArguments, { stdio: ["ignore", "ignore", "pipe"] });
    chromeProcess.stderr.setEncoding("utf8");
    chromeProcess.stderr.on("data", (chunk) => {
      stderrLines.push(String(chunk).replace(/\s+/g, " ").trim().slice(0, 500));
      if (stderrLines.length > 8) stderrLines.shift();
    });

    const port = await waitForDevTools(profileDirectory, chromeProcess, stderrLines);
    const target = await findPageTarget(port);
    client = await CdpClient.connect(target.webSocketDebuggerUrl);
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await runFixtureSuite(client, startedServer.baseUrl);
    await verifyUiAccessibility(client, startedServer.baseUrl);
    process.stdout.write("Comb real-browser fixture suite passed.\n");
  } finally {
    if (client) client.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await stopChrome(chromeProcess);
    await fsPromises.rm(profileDirectory, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 250
    });
  }
}

main().catch((error) => {
  process.stderr.write(`Comb browser fixtures failed: ${error.stack || error}\n`);
  process.exitCode = 1;
});
