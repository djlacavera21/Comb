"use strict";

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const host = "127.0.0.1";
const port = 4173;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${host}:${port}`);
    const relativePath = decodeURIComponent(requestUrl.pathname === "/" ? "/demo/checkout.html" : requestUrl.pathname);
    const filePath = path.resolve(projectRoot, `.${relativePath}`);

    if (!filePath.startsWith(`${projectRoot}${path.sep}`)) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    const content = await fs.readFile(filePath);
    const contentType = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    response.writeHead(200, {
      "content-type": contentType,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    });
    response.end(content);
  } catch (_error) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, host, () => {
  process.stdout.write(`Comb demo running at http://${host}:${port}/demo/checkout.html\n`);
  process.stdout.write("Press Ctrl+C to stop.\n");
});
