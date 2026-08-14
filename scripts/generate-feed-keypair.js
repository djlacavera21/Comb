"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { webcrypto } = require("node:crypto");

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const CombFeed = require("../src/shared/feed-verifier.js");
const projectRoot = path.resolve(__dirname, "..");

function usage() {
  process.stderr.write(
    "Usage: node scripts/generate-feed-keypair.js <output-prefix-outside-repository> <publisher-name>\n"
  );
  process.exitCode = 2;
}

async function main() {
  const outputPrefix = process.argv[2] ? path.resolve(process.argv[2]) : null;
  const publisherName = process.argv.slice(3).join(" ").trim();

  if (!outputPrefix || !publisherName) {
    usage();
    return;
  }

  if (outputPrefix === projectRoot || outputPrefix.startsWith(`${projectRoot}${path.sep}`)) {
    throw new Error("Refusing to create a private signing key inside the Comb repository.");
  }

  const publicPath = `${outputPrefix}.public.json`;
  const privatePath = `${outputPrefix}.private.json`;
  fs.mkdirSync(path.dirname(outputPrefix), { recursive: true });

  if (fs.existsSync(publicPath) || fs.existsSync(privatePath)) {
    throw new Error("Refusing to overwrite an existing feed key file.");
  }

  const keyPair = await globalThis.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicKeyJwk = await globalThis.crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKeyJwk = await globalThis.crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const createdAt = new Date().toISOString();
  const publicDescriptor = await CombFeed.createTrustKeyDescriptor(
    publisherName,
    publicKeyJwk,
    createdAt
  );
  const privateDescriptor = {
    schema: CombFeed.PRIVATE_KEY_SCHEMA,
    keyId: publicDescriptor.keyId,
    name: publicDescriptor.name,
    algorithm: CombFeed.ALGORITHM,
    createdAt,
    privateKeyJwk
  };

  fs.writeFileSync(publicPath, `${JSON.stringify(publicDescriptor, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o644
  });
  fs.writeFileSync(privatePath, `${JSON.stringify(privateDescriptor, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600
  });

  process.stdout.write(`Public trust key: ${publicPath}\n`);
  process.stdout.write(`PRIVATE signing key: ${privatePath}\n`);
  process.stdout.write(`Fingerprint: ${publicDescriptor.keyId}\n`);
  process.stdout.write("Keep the private file outside source control and offline when not signing.\n");
}

main().catch((error) => {
  process.stderr.write(`${error.message || error}\n`);
  process.exitCode = 1;
});
