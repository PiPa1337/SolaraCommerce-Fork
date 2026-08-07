import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const studioRoot = resolve("apps/studio/dist");

export interface RunningStudioServer {
  server: Server;
  url: string;
}

export async function startStudioServer(): Promise<RunningStudioServer> {
  const server = createServer((request, response) => {
    const requested = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    // El launcher real siempre responde /__solara/session; el servidor de
    // pruebas emula el host no gestionado para que el editor no reciba un 404
    // en su sondeo de modo de persistencia (que Chromium loguea como error).
    if (requested === "/__solara/session") {
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
  return { server, url: `http://127.0.0.1:${address.port}` };
}

export async function stopStudioServer(server: Server): Promise<void> {
  await new Promise<void>((resolveClosing, reject) => {
    server.close((error) => (error ? reject(error) : resolveClosing()));
  });
}
