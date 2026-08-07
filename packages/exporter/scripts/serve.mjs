/**
 * Adaptador HTTP de desarrollo para el handler local compartido.
 *
 * `solara-request-handler.mjs` también es usado por Electron. Mantener este
 * archivo pequeño conserva el servidor loopback y evita duplicar persistencia,
 * autenticación o reglas de archivos al incorporar el protocolo portable.
 */
import { createServer } from "node:http";
import { resolve } from "node:path";
import { ensurePortableLayout, resolvePortableLayout } from "./portable-layout.mjs";
import { createSolaraRequestHandler } from "./solara-request-handler.mjs";

const root = resolve(process.argv[2] ?? "site");
const port = Number(process.argv[3] ?? process.env.SOLARA_PORT ?? "4174");
const shutdownToken = process.argv[4] ?? "";
const applicationRoot = resolve(process.argv[5] ?? process.cwd());
const layout = resolvePortableLayout({ mode: "development", cwd: applicationRoot });
const serverOrigin = `http://127.0.0.1:${port}`;
let server;
let shuttingDown = false;

async function start() {
  await ensurePortableLayout(layout, { appVersion: "0.1.0" });
  const handler = createSolaraRequestHandler({
    staticRoot: root,
    applicationRoot: layout.portableRoot,
    projectsRoot: layout.projectsRoot,
    transactionRoot: layout.transactionRoot,
    shutdownToken,
    origin: serverOrigin,
    onShutdown: stopServer,
  });
  await handler.storage.cleanupStaging();

  server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? "/", serverOrigin);
      const result = await handler.handle({
        method: request.method ?? "GET",
        pathname: `${url.pathname}${url.search}`,
        headers: request.headers,
        body: request,
      });
      response.writeHead(result.status, result.headers);
      response.end(result.body);
    })().catch((error) => {
      if (!response.headersSent) {
        response.writeHead(500, {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(
          JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : "Error del servidor local.",
          }),
        );
      } else {
        response.destroy(error);
      }
    });
  });

  await new Promise((resolveListening, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolveListening);
  });
  console.log(`Solara export disponible en http://localhost:${port}`);

  async function shutdown() {
    await handler.close();
    server.close(() => process.exit(0));
    server.closeAllConnections?.();
    setTimeout(() => process.exit(0), 1000).unref();
  }

  function stopServer() {
    if (shuttingDown) return;
    shuttingDown = true;
    void shutdown();
  }
}

start().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
