import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { createLocalProjectStorage } from "./local-project-storage.mjs";

const root = resolve(process.argv[2] ?? "site");
const port = Number(process.argv[3] ?? process.env.SOLARA_PORT ?? "4174");
const shutdownToken = process.argv[4] ?? "";
const applicationRoot = resolve(process.argv[5] ?? process.cwd());
const storage = createLocalProjectStorage({ applicationRoot });
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
const siteServers = new Map();

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

function isStorageAuthorized(request) {
  return (
    Boolean(shutdownToken) &&
    readCookie(request, shutdownCookieName) === shutdownToken &&
    hasSameOrigin(request)
  );
}

async function readJsonBody(request, maxBytes = 1024 * 1024) {
  let body = "";
  for await (const chunk of request) {
    body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    if (Buffer.byteLength(body, "utf8") > maxBytes)
      throw new Error("La solicitud es demasiado grande.");
  }
  try {
    return JSON.parse(body || "{}");
  } catch {
    throw new Error("La solicitud JSON es inválida.");
  }
}

function storageErrorStatus(error) {
  return error?.code === "VERSION_CONFLICT" ? 409 : 400;
}

async function handleStorage(request, response, requestUrl) {
  if (!requestUrl.pathname.startsWith("/__solara/storage")) return false;
  if (!isStorageAuthorized(request)) {
    writeJson(response, 403, { ok: false, error: "Almacenamiento local no autorizado." });
    return true;
  }

  try {
    if (requestUrl.pathname === "/__solara/storage/status" && request.method === "GET") {
      writeJson(response, 200, { ok: true, ...(await storage.status()) });
      return true;
    }
    if (requestUrl.pathname === "/__solara/storage/projects" && request.method === "GET") {
      writeJson(response, 200, { ok: true, ...(await storage.list()) });
      return true;
    }
    const projectMatch = /^\/__solara\/storage\/projects\/([^/]+)\/current$/.exec(
      requestUrl.pathname,
    );
    if (projectMatch && request.method === "GET") {
      const result = await storage.readCurrent(decodeURIComponent(projectMatch[1]));
      if (!result) {
        writeJson(response, 404, { ok: false, error: "La tienda no existe en disco." });
        return true;
      }
      response.writeHead(
        200,
        withSessionCookie({
          "Cache-Control": "no-store",
          "Content-Type": "application/vnd.solara.project+zip",
          "X-Solara-Project-Version": String(result.manifest.current.version),
        }),
      );
      response.end(result.bytes);
      return true;
    }
    const manualBackupMatch = /^\/__solara\/storage\/projects\/([^/]+)\/manual-backup$/.exec(
      requestUrl.pathname,
    );
    if (manualBackupMatch && request.method === "POST") {
      writeJson(response, 200, {
        ok: true,
        ...(await storage.manualBackup(decodeURIComponent(manualBackupMatch[1]))),
      });
      return true;
    }
    const openSiteMatch = /^\/__solara\/storage\/projects\/([^/]+)\/open-site$/.exec(
      requestUrl.pathname,
    );
    if (openSiteMatch && request.method === "POST") {
      const projectId = decodeURIComponent(openSiteMatch[1]);
      const existing = siteServers.get(projectId);
      if (existing) {
        writeJson(response, 200, { ok: true, url: existing.url });
        return true;
      }
      const siteRoot = await storage.getLastValidSiteDirectory(projectId);
      if (!siteRoot) {
        writeJson(response, 404, {
          ok: false,
          error: "La tienda no tiene un sitio público válido.",
        });
        return true;
      }
      const siteServer = createServer((siteRequest, siteResponse) => {
        const requested = decodeURIComponent(
          new URL(siteRequest.url ?? "/", "http://localhost").pathname,
        );
        const normalized = normalize(requested).replace(/^([/\\])+/, "");
        let file = resolve(join(siteRoot, normalized));
        if (!file.startsWith(siteRoot)) {
          siteResponse.writeHead(403).end("Forbidden");
          return;
        }
        if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
        if (!existsSync(file)) {
          const routeIndex = join(siteRoot, normalized, "index.html");
          if (existsSync(routeIndex)) file = routeIndex;
        }
        if (!existsSync(file)) {
          siteResponse
            .writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
            .end("Not found");
          return;
        }
        siteResponse.writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type": types[extname(file)] ?? "application/octet-stream",
        });
        createReadStream(file).pipe(siteResponse);
      });
      await new Promise((resolveListening, reject) => {
        siteServer.once("error", reject);
        siteServer.listen(0, "127.0.0.1", resolveListening);
      });
      const address = siteServer.address();
      if (!address || typeof address === "string")
        throw new Error("No se pudo abrir el sitio público.");
      const result = { server: siteServer, url: `http://127.0.0.1:${address.port}` };
      siteServers.set(projectId, result);
      writeJson(response, 200, { ok: true, url: result.url });
      return true;
    }
    if (requestUrl.pathname === "/__solara/storage/saves" && request.method === "POST") {
      const body = await readJsonBody(request);
      writeJson(response, 201, { ok: true, ...(await storage.beginSave(body)) });
      return true;
    }
    const uploadMatch = /^\/__solara\/storage\/saves\/([^/]+)\/(project|site)$/.exec(
      requestUrl.pathname,
    );
    if (uploadMatch && request.method === "PUT") {
      const result = await storage.upload(
        decodeURIComponent(uploadMatch[1]),
        uploadMatch[2],
        request,
      );
      writeJson(response, 200, { ok: true, ...result });
      return true;
    }
    const saveMatch = /^\/__solara\/storage\/saves\/([^/]+)\/(commit|abort)$/.exec(
      requestUrl.pathname,
    );
    if (saveMatch && request.method === "POST") {
      const transactionId = decodeURIComponent(saveMatch[1]);
      if (saveMatch[2] === "abort") {
        await storage.abort(transactionId);
        writeJson(response, 200, { ok: true });
      } else {
        writeJson(response, 200, { ok: true, ...(await storage.commit(transactionId)) });
      }
      return true;
    }
    if (requestUrl.pathname.startsWith("/__solara/storage/")) {
      writeJson(response, 405, { ok: false, error: "Método de almacenamiento no permitido." });
      return true;
    }
  } catch (error) {
    writeJson(response, storageErrorStatus(error), {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo completar el guardado local.",
    });
    return true;
  }
  return false;
}

let server;
let shuttingDown = false;

function stopServer() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const siteServer of siteServers.values()) siteServer.server.close();
  siteServers.clear();
  server.close(() => process.exit(0));
  server.closeAllConnections?.();
  setTimeout(() => process.exit(0), 1000).unref();
}

server = createServer((request, response) => {
  void (async () => {
    const requestUrl = new URL(request.url ?? "/", serverOrigin);

    if (await handleStorage(request, response, requestUrl)) return;

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
  })().catch((error) => {
    if (!response.headersSent) {
      writeJson(response, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "Error del servidor local.",
      });
    } else {
      response.destroy(error);
    }
  });
}).listen(port, "127.0.0.1", () => {
  void storage.cleanupStaging();
  console.log(`Solara export disponible en http://localhost:${port}`);
});
