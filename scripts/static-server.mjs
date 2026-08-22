/**
 * Servidor estatico minimo para Lighthouse local. Uso:
 *   node scripts/static-server.mjs [puerto]   (default 4199)
 * Sirve apps/studio/dist con fallback SPA a index.html.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";

const port = Number(process.argv[2] ?? 4199);
const root = resolve("apps/studio/dist");
const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const path =
    requested === ""
      ? "index.html"
      : requested.endsWith("/")
        ? `${requested}index.html`
        : requested;
  const file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    return;
  }
  const extension = path.split(".").pop();
  const types = {
    css: "text/css; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    webp: "image/webp",
    png: "image/png",
    svg: "image/svg+xml",
    json: "application/json",
    webmanifest: "application/manifest+json",
  };
  response.writeHead(200, { "Content-Type": types[extension] ?? "text/html; charset=utf-8" });
  response.end(readFileSync(file));
});
server.listen(port, () => console.log(`static server en http://127.0.0.1:${port}`));
