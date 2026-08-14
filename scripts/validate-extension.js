"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const errors = [];

function fail(message) {
  errors.push(message);
}

function walk(directory) {
  const output = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && [".git", "node_modules", "dist"].includes(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walk(absolutePath));
    else output.push(absolutePath);
  }

  return output;
}

if (manifest.manifest_version !== 3) fail("manifest_version must be 3");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (manifest.version !== packageJson.version) fail("manifest and package versions must match");
if (!/^0\.2\./.test(manifest.version)) fail("manifest version must match the v0.2 milestone");

const expectedPermissions = ["activeTab", "scripting", "storage"];
const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];

for (const permission of expectedPermissions) {
  if (!permissions.includes(permission)) fail(`missing required permission: ${permission}`);
}

for (const permission of permissions) {
  if (!expectedPermissions.includes(permission)) fail(`unexpected permission: ${permission}`);
}

if (Array.isArray(manifest.host_permissions) && manifest.host_permissions.length) {
  fail("v0.2 must not declare permanent host permissions");
}

if (manifest.content_scripts) {
  fail("v0.2 must inject only after a user gesture, not through static content scripts");
}

const requiredFiles = [
  manifest.background && manifest.background.service_worker,
  manifest.action && manifest.action.default_popup,
  manifest.options_page,
  ...Object.values((manifest.action && manifest.action.default_icon) || {}),
  ...Object.values(manifest.icons || {})
].filter(Boolean);

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) fail(`manifest file is missing: ${relativePath}`);
}

const sourceFiles = walk(path.join(root, "src"));
const executableFiles = sourceFiles.filter((file) => file.endsWith(".js"));
const packageFiles = sourceFiles.filter((file) => /\.(?:html|css|js)$/.test(file));
const forbiddenRuntimePatterns = [
  ["cookie API", /chrome\s*\.\s*cookies\b/],
  ["cookie mutation", /document\s*\.\s*cookie\b/],
  ["request interception", /chrome\s*\.\s*webRequest\b/],
  ["declarative request rewriting", /chrome\s*\.\s*declarativeNetRequest\b/],
  ["new-window referral path", /\bwindow\s*\.\s*open\s*\(/],
  ["tab creation or navigation", /chrome\s*\.\s*tabs\s*\.\s*(?:create|update)\s*\(/],
  ["page navigation", /\blocation\s*\.\s*(?:assign|replace)\s*\(/],
  ["page URL assignment", /\blocation\s*\.\s*(?:href|search)\s*=/],
  ["history rewrite", /\bhistory\s*\.\s*(?:pushState|replaceState)\s*\(/],
  ["remote fetch", /\bfetch\s*\(/],
  ["XML HTTP client", /\bXMLHttpRequest\b/],
  ["web socket client", /\bWebSocket\b/]
];

for (const file of executableFiles) {
  const source = fs.readFileSync(file, "utf8");
  const relativePath = path.relative(root, file);

  for (const [label, pattern] of forbiddenRuntimePatterns) {
    if (pattern.test(source)) fail(`${relativePath} contains forbidden ${label} behavior`);
  }

  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    fail(`${relativePath} has invalid JavaScript: ${String(error.stderr || error.message).trim()}`);
  }
}

for (const file of packageFiles) {
  const source = fs.readFileSync(file, "utf8");
  if (/\b(?:src|href)=["']https?:\/\//i.test(source)) {
    fail(`${path.relative(root, file)} loads a remote package resource`);
  }
}

if (packageJson.dependencies && Object.keys(packageJson.dependencies).length) {
  fail("v0.2 must remain dependency-free");
}

if (packageJson.devDependencies && Object.keys(packageJson.devDependencies).length) {
  fail("v0.2 must remain dependency-free");
}

if (!fs.existsSync(path.join(root, "src/shared/feed-verifier.js"))) {
  fail("signed-feed verifier is missing");
}

const checkoutEngineSource = fs.readFileSync(path.join(root, "src/content/checkout-engine.js"), "utf8");
const checkoutEngineVersion = checkoutEngineSource.match(/const VERSION = "([^"]+)";/);
if (!checkoutEngineVersion || checkoutEngineVersion[1] !== manifest.version) {
  fail("checkout engine and manifest versions must match");
}

for (const file of walk(root).filter((entry) => entry.endsWith(".json") && !entry.includes(`${path.sep}.git${path.sep}`))) {
  const source = fs.readFileSync(file, "utf8");
  if (/"d"\s*:\s*"[A-Za-z0-9_-]{20,}"/.test(source)) {
    fail(`${path.relative(root, file)} appears to contain an ECDSA private signing key`);
  }
}

if (errors.length) {
  process.stderr.write(`Comb validation failed:\n- ${errors.join("\n- ")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Comb validation passed: ${executableFiles.length} scripts checked; permissions and creator attribution are protected.\n`
  );
}
