import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "site");
const port = Number(process.argv[3] ?? process.env.SOLARA_PORT ?? "4174");
const shutdownToken = process.argv[4] ?? "";
const serverOrigin = `http://127.0.0.1:${port}`;
const shutdownCookieName = "solara_shutdown";
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
};

function sessionCookie() {
  return shutdownToken
    ? `${shutdownCookieName}=${shutdownToken}; Path=/; HttpOnly; SameSite=Strict`
    : undefined;
}

function withSessionCookie(headers = {}) {
  const cookie = sessionCookie();
  return cookie ? { ...headers, "Set-Cookie": cookie } : headers;
}

function writeJson(response, status, body, headers = {}) {
  response.writeHead(
    status,
    withSessionCookie({
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    }),
  );
  response.end(JSON.stringify(body));
}

function readCookie(request, name) {
  const header = request.headers.cookie;
  if (!header) return "";
  const entry = header.split(";").find((part) => part.trim().startsWith(`${name}=`));
  return entry ? entry.trim().slice(name.length + 1) : "";
}

function hasSameOrigin(request) {
  const origin = request.headers.origin;
  return !origin || origin === serverOrigin || origin === `http://localhost:${port}`;
}

let server;
let shuttingDown = false;

function stopServer() {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close(() => process.exit(0));
  server.closeAllConnections?.();
  setTimeout(() => process.exit(0), 1000).unref();
}

server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", serverOrigin);

  if (requestUrl.pathname === "/__solara/session") {
    if (request.method !== "GET") {
      writeJson(response, 405, { managed: false }, { Allow: "GET" });
      return;
    }
    if (!shutdownToken) {
      writeJson(response, 404, { managed: false });
      return;
    }
    writeJson(response, 200, { managed: true });
    return;
  }

  if (requestUrl.pathname === "/__solara/shutdown") {
    if (request.method !== "POST") {
      writeJson(response, 405, { ok: false }, { Allow: "POST" });
      return;
    }
    const authorized =
      Boolean(shutdownToken) &&
      readCookie(request, shutdownCookieName) === shutdownToken &&
      hasSameOrigin(request);
    if (!authorized) {
      writeJson(response, 403, { ok: false, error: "Servidor no administrado." });
      return;
    }
    writeJson(response, 202, { ok: true, message: "Servidor local cerrándose." });
    setTimeout(stopServer, 40).unref();
    return;
  }

  const requested = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const normalized = normalize(requested).replace(/^([/\\])+/, "");
  let file = resolve(join(root, normalized));

  if (!file.startsWith(root)) {
    response.writeHead(403, withSessionCookie()).end("Forbidden");
    return;
  }

  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    response
      .writeHead(404, withSessionCookie({ "Content-Type": "text/plain; charset=utf-8" }))
      .end("Not found");
    return;
  }

  response.writeHead(
    200,
    withSessionCookie({
      "Cache-Control": "no-store",
      "Content-Type": types[extname(file)] ?? "application/octet-stream",
    }),
  );
  createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Solara export disponible en http://localhost:${port}`);
});
