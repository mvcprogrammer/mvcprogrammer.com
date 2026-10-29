#!/usr/bin/env node
// Local preview with the APIs: serves the repository root like `python3 -m http.server` and
// forwards /api/* to the functions running on their Kestrel ports, so the Experience timeline
// works same-origin as it does behind CloudFront. No dependencies. (The patient explorer is its own
// app in fhir/; see fhir/README.md for previewing it.)
//
//   dotnet run --project api/src/Fhir.Api          # listens on http://localhost:5000
//   node tools/serve.mjs                           # http://localhost:8080, /api/fhir/* -> :5000
//   node tools/serve.mjs --port 8080 --api http://localhost:5000

import { createServer, request as httpRequest } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const port = Number(option("--port", "8080"));
const api = new URL(option("--api", "http://localhost:5000"));
const root = fileURLToPath(new URL("..", import.meta.url));

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

const proxy = (req, res) => {
  const upstream = httpRequest(
    { host: api.hostname, port: api.port, method: req.method, path: req.url, headers: { ...req.headers, host: api.host } },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    },
  );
  upstream.on("error", (error) => {
    res.writeHead(502, { "content-type": "application/problem+json" });
    res.end(JSON.stringify({ type: "about:blank", title: "API not running", status: 502, detail: `${api.origin}: ${error.message}` }));
  });
  req.pipe(upstream);
};

const serveFile = (pathname, res) => {
  let file = normalize(join(root, pathname === "/" ? "index.html" : pathname));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const stat = statSync(file);
    if (stat.isDirectory()) {
      file = join(file, "index.html");
    }
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    createReadStream(join(root, "404.html")).on("error", () => res.end("Not found")).pipe(res);
  }
};

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  if (url.pathname.startsWith("/api/")) {
    proxy(req, res);
    return;
  }
  const pathname = url.pathname;
  serveFile(decodeURIComponent(pathname), res);
}).listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}/ with /api/* forwarded to ${api.origin}`);
});
