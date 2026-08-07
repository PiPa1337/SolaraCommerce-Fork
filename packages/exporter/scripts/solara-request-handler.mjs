/**
 * Adaptador agnóstico de transporte para Studio.
 *
 * La misma función atiende la API local y los archivos de Studio tanto desde
 * Node HTTP como desde el protocolo privilegiado `solara://`. No conoce
 * ventanas, puertos ni Electron; sólo devuelve una respuesta serializable.
 */
import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { createLocalProjectStorage } from "./local-project-storage.mjs";

export const publicContentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

const shutdownCookieName = "solara_shutdown";

function normaliseHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key.toLowerCase(),
      value == null ? "" : String(value),
    ]),
  );
}

function header(headers, name) {
  return normaliseHeaders(headers)[name.toLowerCase()] ?? "";
}

function readCookie(headers, name) {
  const cookie = header(headers, "cookie");
  if (!cookie) return "";
  const entry = cookie.split(";").find((part) => part.trim().startsWith(`${name}=`));
  return entry ? entry.trim().slice(name.length + 1) : "";
}

function toAsyncIterable(body) {
  if (!body) {
    return (async function* empty() {})();
  }
  if (typeof body[Symbol.asyncIterator] === "function") return body;
  if (typeof body.getReader === "function") {
    return (async function* readable() {
      const reader = body.getReader();
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          yield next.value;
        }
      } finally {
        reader.releaseLock?.();
      }
    })();
  }
  const bytes = body instanceof Uint8Array ? body : Buffer.from(body);
  return (async function* bytesBody() {
    yield bytes;
  })();
}

async function readJsonBody(body, maxBytes = 1024 * 1024) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of toAsyncIterable(body)) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > maxBytes) throw new Error("La solicitud es demasiado grande.");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new Error("La solicitud JSON es inválida.");
  }
}

function response(status, body, headers = {}) {
  return { status, headers, body };
}

function jsonResponse(status, body, headers = {}) {
  return response(status, JSON.stringify(body), {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
}

function storageErrorStatus(error) {
  return error?.code === "VERSION_CONFLICT" ? 409 : 400;
}

function defaultOpenFolderInExplorer(folderPath) {
  if (process.platform !== "win32") return false;
  spawn("explorer", [folderPath], { detached: true, stdio: "ignore" }).unref();
  return true;
}

function safeStaticPath(root, pathname) {
  const decoded = decodeURIComponent(new URL(pathname, "http://solara.local").pathname);
  const normalized = normalize(decoded).replace(/^([/\\])+/, "");
  const rootPath = resolve(root);
  const file = resolve(join(rootPath, normalized));
  if (file !== rootPath && !file.startsWith(`${rootPath}${sep}`)) return undefined;
  return file;
}

async function staticResponse(root, pathname, { fallbackToIndex = false } = {}) {
  if (!safeStaticPath(root, pathname))
    return response(403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
  const requested = resolveStaticFile(root, pathname, { fallbackToIndex });
  if (!requested)
    return response(404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
  return response(200, await readFile(requested), {
    "Cache-Control": "no-store",
    "Content-Type": publicContentTypes[extname(requested)] ?? "application/octet-stream",
  });
}

/** Resuelve un recurso público sin permitir salir de la raíz estática. */
export function resolveStaticFile(root, pathname, { fallbackToIndex = false } = {}) {
  const requested = safeStaticPath(root, pathname);
  if (!requested) return undefined;
  let file = requested;
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file) && fallbackToIndex) {
    const routeIndex = join(requested, "index.html");
    if (existsSync(routeIndex)) file = routeIndex;
  }
  if (!existsSync(file) || !statSync(file).isFile()) return undefined;
  return file;
}

function writeNodeFile(siteRoot, request, reply) {
  try {
    const requested = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const normalized = normalize(requested).replace(/^([/\\])+/, "");
    const rootPath = resolve(siteRoot);
    let file = resolve(join(rootPath, normalized));
    if (file !== rootPath && !file.startsWith(`${rootPath}${sep}`)) {
      reply.writeHead(403).end("Forbidden");
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) {
      const routeIndex = join(rootPath, normalized, "index.html");
      if (existsSync(routeIndex)) file = routeIndex;
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
      reply.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    reply.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": publicContentTypes[extname(file)] ?? "application/octet-stream",
    });
    createReadStream(file).pipe(reply);
  } catch {
    reply.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("Bad request");
  }
}

/**
 * Construye un handler local. `origin` es el origen esperado del transporte;
 * `allowProtocolOrigin` habilita el canal interno `solara://` sin exponer la
 * API a páginas HTTP externas.
 */
export function createSolaraRequestHandler({
  staticRoot,
  applicationRoot,
  projectsRoot,
  transactionRoot,
  shutdownToken = "",
  managed = Boolean(shutdownToken),
  origin = "",
  protocolOrigin = "solara://studio",
  allowProtocolOrigin = false,
  storage: providedStorage,
  onShutdown,
  openFolderInExplorer = defaultOpenFolderInExplorer,
} = {}) {
  const storage =
    providedStorage ??
    createLocalProjectStorage({ applicationRoot, projectsRoot, stagingRoot: transactionRoot });
  const siteServers = new Map();
  const sessionHeaders = shutdownToken
    ? { "Set-Cookie": `${shutdownCookieName}=${shutdownToken}; Path=/; HttpOnly; SameSite=Strict` }
    : {};

  function hasSameOrigin(request) {
    const requestOrigin = header(request.headers, "origin");
    return (
      !requestOrigin ||
      requestOrigin === origin ||
      (allowProtocolOrigin && requestOrigin === protocolOrigin)
    );
  }

  function authorised(request) {
    const requestOrigin = header(request.headers, "origin");
    const protocolRequest = allowProtocolOrigin && requestOrigin === protocolOrigin;
    return (
      hasSameOrigin(request) &&
      (protocolRequest ||
        (Boolean(shutdownToken) &&
          readCookie(request.headers, shutdownCookieName) === shutdownToken))
    );
  }

  async function handleStorage(request, pathname) {
    if (!pathname.startsWith("/__solara/storage")) return undefined;
    if (!authorised(request)) {
      return jsonResponse(
        403,
        { ok: false, error: "Almacenamiento local no autorizado." },
        sessionHeaders,
      );
    }
    try {
      if (pathname === "/__solara/storage/status" && request.method === "GET") {
        return jsonResponse(200, { ok: true, ...(await storage.status()) }, sessionHeaders);
      }
      if (pathname === "/__solara/storage/projects" && request.method === "GET") {
        return jsonResponse(200, { ok: true, ...(await storage.list()) }, sessionHeaders);
      }
      const projectMatch = /^\/__solara\/storage\/projects\/([^/]+)\/current$/.exec(pathname);
      if (projectMatch && request.method === "GET") {
        const result = await storage.readCurrent(decodeURIComponent(projectMatch[1]));
        if (!result)
          return jsonResponse(
            404,
            { ok: false, error: "La tienda no existe en disco." },
            sessionHeaders,
          );
        return response(200, result.bytes, {
          ...sessionHeaders,
          "Cache-Control": "no-store",
          "Content-Type": "application/vnd.solara.project+json",
          "X-Solara-Project-Version": String(result.manifest.current.version),
        });
      }
      const manualBackupMatch = /^\/__solara\/storage\/projects\/([^/]+)\/manual-backup$/.exec(
        pathname,
      );
      if (manualBackupMatch && request.method === "POST") {
        return jsonResponse(
          200,
          { ok: true, ...(await storage.manualBackup(decodeURIComponent(manualBackupMatch[1]))) },
          sessionHeaders,
        );
      }
      const openSiteMatch = /^\/__solara\/storage\/projects\/([^/]+)\/open-site$/.exec(pathname);
      if (openSiteMatch && request.method === "POST") {
        const projectId = decodeURIComponent(openSiteMatch[1]);
        const existing = siteServers.get(projectId);
        if (existing) return jsonResponse(200, { ok: true, url: existing.url }, sessionHeaders);
        const siteRoot = await storage.getLastValidSiteDirectory(projectId);
        if (!siteRoot) {
          return jsonResponse(
            404,
            { ok: false, error: "La tienda no tiene un sitio público válido." },
            sessionHeaders,
          );
        }
        const siteServer = createServer((siteRequest, siteResponse) =>
          writeNodeFile(siteRoot, siteRequest, siteResponse),
        );
        await new Promise((resolveListening, reject) => {
          siteServer.once("error", reject);
          siteServer.listen(0, "127.0.0.1", resolveListening);
        });
        const address = siteServer.address();
        if (!address || typeof address === "string")
          throw new Error("No se pudo abrir el sitio público.");
        const result = { server: siteServer, url: `http://127.0.0.1:${address.port}` };
        siteServers.set(projectId, result);
        return jsonResponse(200, { ok: true, url: result.url }, sessionHeaders);
      }
      const openFolderMatch = /^\/__solara\/storage\/projects\/([^/]+)\/open-folder$/.exec(
        pathname,
      );
      if (openFolderMatch && request.method === "POST") {
        const result = await storage.openFolder(decodeURIComponent(openFolderMatch[1]));
        if (!result) {
          return jsonResponse(
            404,
            { ok: false, error: "La tienda no existe en disco." },
            sessionHeaders,
          );
        }
        openFolderInExplorer(result.path);
        return jsonResponse(200, { ok: true, folder: result.folder }, sessionHeaders);
      }
      if (pathname === "/__solara/storage/saves" && request.method === "POST") {
        return jsonResponse(
          201,
          { ok: true, ...(await storage.beginSave(await readJsonBody(request.body))) },
          sessionHeaders,
        );
      }
      const uploadMatch = /^\/__solara\/storage\/saves\/([^/]+)\/(project|site)$/.exec(pathname);
      if (uploadMatch && request.method === "PUT") {
        const uploadRequest = {
          headers: request.headers,
          [Symbol.asyncIterator]: () => toAsyncIterable(request.body)[Symbol.asyncIterator](),
        };
        return jsonResponse(
          200,
          {
            ok: true,
            ...(await storage.upload(
              decodeURIComponent(uploadMatch[1]),
              uploadMatch[2],
              uploadRequest,
            )),
          },
          sessionHeaders,
        );
      }
      const saveMatch = /^\/__solara\/storage\/saves\/([^/]+)\/(commit|abort)$/.exec(pathname);
      if (saveMatch && request.method === "POST") {
        const transactionId = decodeURIComponent(saveMatch[1]);
        if (saveMatch[2] === "abort") {
          await storage.abort(transactionId);
          return jsonResponse(200, { ok: true }, sessionHeaders);
        }
        return jsonResponse(
          200,
          { ok: true, ...(await storage.commit(transactionId)) },
          sessionHeaders,
        );
      }
      if (pathname.startsWith("/__solara/storage/")) {
        return jsonResponse(
          405,
          { ok: false, error: "Método de almacenamiento no permitido." },
          {
            ...sessionHeaders,
            Allow: "GET, POST, PUT",
          },
        );
      }
    } catch (error) {
      return jsonResponse(
        storageErrorStatus(error),
        {
          ok: false,
          error: error instanceof Error ? error.message : "No se pudo completar el guardado local.",
        },
        sessionHeaders,
      );
    }
    return undefined;
  }

  async function handle(request) {
    const requestPath = request.pathname ?? "/";
    let url;
    try {
      url = new URL(requestPath, origin || protocolOrigin || "http://localhost");
    } catch {
      return response(400, "Bad request", { "Content-Type": "text/plain; charset=utf-8" });
    }
    const pathname = url.pathname;
    const storageResponse = await handleStorage(request, pathname);
    if (storageResponse) return storageResponse;

    if (pathname === "/__solara/session") {
      if (request.method !== "GET")
        return jsonResponse(405, { managed: false }, { ...sessionHeaders, Allow: "GET" });
      return managed
        ? jsonResponse(200, { managed: true }, sessionHeaders)
        : jsonResponse(404, { managed: false });
    }
    if (pathname === "/__solara/shutdown") {
      if (request.method !== "POST")
        return jsonResponse(405, { ok: false }, { ...sessionHeaders, Allow: "POST" });
      if (!authorised(request))
        return jsonResponse(403, { ok: false, error: "Servidor no administrado." }, sessionHeaders);
      const result = jsonResponse(
        202,
        { ok: true, message: "Servidor local cerrándose." },
        sessionHeaders,
      );
      setTimeout(() => void onShutdown?.(), 40).unref?.();
      return result;
    }
    return staticResponse(staticRoot, requestPath);
  }

  async function close() {
    await Promise.all(
      [...siteServers.values()].map(
        ({ server }) =>
          new Promise((resolveClose) => {
            server.close(() => resolveClose());
            server.closeAllConnections?.();
          }),
      ),
    );
    siteServers.clear();
  }

  return { handle, close, storage };
}
