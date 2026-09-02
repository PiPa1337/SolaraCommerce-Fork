import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const studioRoot = resolve("apps/studio/dist");

export interface RunningStudioServer {
  server: Server;
  url: string;
  writeAttempts: Array<{ method: string; path: string }>;
}

export interface ReadOnlyManagedProject {
  projectId: string;
  name: string;
  slug: string;
  version: number;
  updatedAt: string;
  savedAt: string;
  folder: string;
  currentBytes: Uint8Array;
}

export async function startStudioServer(
  options: { managedProject?: ReadOnlyManagedProject } = {},
): Promise<RunningStudioServer> {
  const writeAttempts: Array<{ method: string; path: string }> = [];
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const requested = decodeURIComponent(requestUrl.pathname);
    const managedProject = options.managedProject;
    if (managedProject && requested.startsWith("/__solara/")) {
      const method = request.method ?? "GET";
      if (method !== "GET") {
        writeAttempts.push({ method, path: requested });
        response.writeHead(405, {
          Allow: "GET",
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(
          JSON.stringify({
            ok: false,
            error: "Performance fixture read-only: no se permiten escrituras.",
          }),
        );
        return;
      }
      if (requested === "/__solara/session") {
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ managed: true }));
        return;
      }
      if (requested === "/__solara/storage/status") {
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: true, managed: true, writable: false }));
        return;
      }
      if (requested === "/__solara/storage/qa-status") {
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(
          JSON.stringify({ ok: true, activeCycle: null, completedCount: 0, blockedCount: 0 }),
        );
        return;
      }
      if (requested === "/__solara/storage/projects") {
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(
          JSON.stringify({
            ok: true,
            projects: [
              {
                projectId: managedProject.projectId,
                name: managedProject.name,
                slug: managedProject.slug,
                status: "synced",
                updatedAt: managedProject.updatedAt,
                savedAt: managedProject.savedAt,
                version: managedProject.version,
                folder: managedProject.folder,
                siteVersion: null,
                siteOutdated: false,
              },
            ],
            recovery: [],
          }),
        );
        return;
      }
      const currentMatch = /^\/__solara\/storage\/projects\/([^/]+)\/current$/.exec(requested);
      if (currentMatch && decodeURIComponent(currentMatch[1]) === managedProject.projectId) {
        response.writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type": "application/vnd.solara.project+json",
          "X-Solara-Project-Version": String(managedProject.version),
        });
        response.end(managedProject.currentBytes);
        return;
      }
      response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false, error: "Endpoint fuera del fixture read-only." }));
      return;
    }
    // El launcher real siempre responde /__solara/session; el servidor de
    // pruebas emula el host no gestionado para que el editor no reciba un 404
    // en su sondeo de modo de persistencia (que Chromium loguea como error).
    // Para offline tests, cualquier endpoint __solara debe responder rapido con managed:false
    if (requested.startsWith("/__solara/")) {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ managed: false }));
      return;
    }
    const normalized = normalize(requested).replace(/^([/\\])+/, "");
    let file = resolve(join(studioRoot, normalized));

    if (!file.startsWith(studioRoot)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) {
      // Fallback SPA: rutas internas del editor como /__studio/components no
      // existen como archivos; un hosting estático serviría index.html.
      if (requested.startsWith("/__studio/")) {
        const spaIndex = join(studioRoot, "index.html");
        if (existsSync(spaIndex)) {
          response.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          });
          response.end(readFileSync(spaIndex));
          return;
        }
      }
      response.writeHead(404).end("Not found");
      return;
    }

    const contentTypes: Record<string, string> = {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
    };
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes[extname(file)] ?? "application/octet-stream",
    });
    response.end(readFileSync(file));
  });

  await new Promise<void>((resolveListening) => server.listen(0, "127.0.0.1", resolveListening));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("No se pudo obtener el puerto del servidor de Studio.");
  }
  return { server, url: `http://127.0.0.1:${address.port}`, writeAttempts };
}

export async function stopStudioServer(server: Server): Promise<void> {
  await new Promise<void>((resolveClosing, reject) => {
    server.close((error) => (error ? reject(error) : resolveClosing()));
  });
}
