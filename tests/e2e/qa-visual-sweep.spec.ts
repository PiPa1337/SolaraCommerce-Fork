import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { referenceStore } from "@solara/project-schema/fixture";

/**
 * Barrido visual del sitio exportado. Se ejecuta explícitamente con
 * SOLARA_QA_VISUAL=1 (no corre en el gate normal): exporta referenceStore,
 * lo sirve en loopback, cosecha errores de consola/red/overflow y captura
 * pantallas en desktop y mobile. Resultados en test-results/qa-visual/.
 * No tiene aserciones: es una herramienta de diagnóstico del bucle perpetuo.
 */

const resultsDirectory = resolve("test-results/qa-visual");

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const routes = [
  "/",
  "/productos/manta-bruma/",
  "/productos/jarra-delta/",
  "/categorias/textiles/",
  "/categorias/mesa/",
  "/colecciones/casa-serena/",
  "/buscar/",
  "/carrito/",
  "/compra/",
  "/ruta-inexistente/",
];

const exported = exportProject(referenceStore, { mode: "production" });
const fixtureFiles = new Map<string, Uint8Array>([
  ["fixtures/casa-luma-hero.png", readFixture("casa-luma-hero.png")],
  ["fixtures/manta-bruma.png", readFixture("manta-bruma.png")],
  ["fixtures/jarra-delta.png", readFixture("jarra-delta.png")],
]);

function readFixture(name: string): Uint8Array {
  return readFileSync(resolve("apps/studio/public/fixtures", name));
}

let server: Server;
let serverUrl: string;

function safeName(route: string, viewport: string): string {
  return `${route.replace(/[/:]/g, "_").replace(/_+$/, "") || "home"}-${viewport}`;
}

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const path =
      requested === ""
        ? "index.html"
        : requested.endsWith("/")
          ? `${requested}index.html`
          : requested;
    const content = exported.files.get(path) ?? fixtureFiles.get(path);
    if (content === undefined) {
      const notFound = exported.files.get("404.html");
      if (notFound !== undefined) {
        response
          .writeHead(404, { "Content-Type": "text/html; charset=utf-8" })
          .end(notFound);
      } else {
        response.writeHead(404).end("Not found");
      }
      return;
    }
    const extension = path.split(".").pop();
    const contentType =
      extension === "html"
        ? "text/html; charset=utf-8"
        : extension === "css"
          ? "text/css; charset=utf-8"
          : extension === "js"
            ? "text/javascript; charset=utf-8"
            : extension === "png"
              ? "image/png"
              : extension === "json"
                ? "application/json; charset=utf-8"
                : extension === "xml"
                  ? "application/xml; charset=utf-8"
                  : "text/plain; charset=utf-8";
    response.writeHead(200, { "Content-Type": contentType }).end(content);
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (typeof address === "object" && address !== null) {
    serverUrl = `http://127.0.0.1:${address.port}`;
  }
  rmSync(resultsDirectory, { recursive: true, force: true });
  mkdirSync(resultsDirectory, { recursive: true });
});

test.afterAll(async () => {
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
});

test("barrido visual: capturas, consola, red y overflow", async ({ browser }) => {
  if (process.env.SOLARA_QA_VISUAL !== "1") {
    test.skip();
    return;
  }
  const findings: unknown[] = [];
  const context = await browser.newContext();
  for (const viewport of viewports) {
    const page = await context.newPage();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];
    const badResponses: string[] = [];
    const cspViolations: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) =>
      failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "?"}`),
    );
    page.on("response", (response) => {
      if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
    });
    page.on("console", (message) => {
      const text = message.text();
      if (text.includes("Content Security Policy") || text.includes("refused to")) {
        cspViolations.push(text);
      }
    });

    for (const route of routes) {
      const name = safeName(route, viewport.name);
      await page.route(/\/fixtures\/[a-z0-9-]+\.png$/, (routeRequest) => {
        const pathMatch = /\/fixtures\/([a-z0-9-]+\.png)$/.exec(
          new URL(routeRequest.request().url()).pathname,
        );
        const content = pathMatch ? fixtureFiles.get(`fixtures/${pathMatch[1]}`) : undefined;
        if (content) {
          routeRequest.fulfill({ status: 200, contentType: "image/png", body: content });
        } else {
          routeRequest.abort();
        }
      });
      await page.goto(`${serverUrl}${route}`, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(() => {
        const html = document.documentElement;
        return {
          scrollWidth: html.scrollWidth,
          clientWidth: html.clientWidth,
          overflowX: html.scrollWidth > html.clientWidth,
        };
      });
      const bodyText = await page.locator("body").innerText();
      const emptyBody = bodyText.trim().length === 0;
      await page.screenshot({ path: resolve(resultsDirectory, `${name}.png`), fullPage: false });
      if (overflow.overflowX) {
        findings.push({
          type: "overflow-x",
          route,
          viewport: viewport.name,
          detail: overflow,
        });
      }
      if (emptyBody) {
        findings.push({ type: "empty-body", route, viewport: viewport.name });
      }
      if (consoleErrors.length > 0) {
        findings.push({
          type: "console-error",
          route,
          viewport: viewport.name,
          detail: [...consoleErrors],
        });
        consoleErrors.length = 0;
      }
      if (pageErrors.length > 0) {
        findings.push({ type: "page-error", route, viewport: viewport.name, detail: [...pageErrors] });
        pageErrors.length = 0;
      }
      if (failedRequests.length > 0) {
        findings.push({
          type: "request-failed",
          route,
          viewport: viewport.name,
          detail: [...failedRequests],
        });
        failedRequests.length = 0;
      }
      if (badResponses.length > 0) {
        findings.push({
          type: "bad-response",
          route,
          viewport: viewport.name,
          detail: [...badResponses],
        });
        badResponses.length = 0;
      }
      if (cspViolations.length > 0) {
        findings.push({
          type: "csp-violation",
          route,
          viewport: viewport.name,
          detail: [...cspViolations],
        });
        cspViolations.length = 0;
      }
    }
    await page.close();
  }
  await context.close();
  writeFileSync(
    resolve(resultsDirectory, "sweep.json"),
    `${JSON.stringify({ routes, viewports, findings }, null, 2)}\n`,
    "utf8",
  );
});
