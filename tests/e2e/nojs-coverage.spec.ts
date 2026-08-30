import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { referenceStore } from "@solara/project-schema/fixture";
import { catalogScaleStore } from "@solara/project-schema/scale-fixture";

// Desde 9a22a95 los assets de hero/galería viajan embebidos como data URLs;
// solo los 12 productos quedan como archivos webp servibles en /fixtures/.
// Si falta uno, la página dispara 404 en consola y este spec lo marca como fallo.
const FIXTURE_NAMES = Array.from(
  { length: 12 },
  (_, i) => `modo-sur-product-${String(i + 1).padStart(2, "0")}.webp`,
);
const fixtureFiles = new Map<string, Uint8Array>(
  FIXTURE_NAMES.map((name) => [
    `fixtures/${name}`,
    readFileSync(resolve("apps/studio/public/fixtures", name)),
  ]),
);

const projects = {
  reference: referenceStore,
  catalogModern: catalogModernStore,
  catalogModernV2: catalogModernV2Store,
  catalogScale: catalogScaleStore,
} as const;

function routesFor(project: (typeof projects)[keyof typeof projects]): string[] {
  const exported = exportProject(project, { mode: "production" });
  const product = [...exported.files.keys()].find((path) =>
    /^productos\/[^/]+\/index\.html$/.test(path),
  );
  const category = [...exported.files.keys()].find((path) =>
    /^categorias\/[^/]+\/index\.html$/.test(path),
  );
  const routes = [
    "/",
    product ? `/${product.slice(0, -"index.html".length)}` : "/productos/",
    category ? `/${category.slice(0, -"index.html".length)}` : "/categorias/",
    "/buscar/",
    "/carrito/",
  ];
  if (exported.files.has("compra/index.html")) routes.push("/compra/");
  return routes;
}

test("E1/C2: rutas útiles sin JavaScript y sin errores de consola/red", async ({ browser }) => {
  let exported = exportProject(referenceStore, { mode: "production" });
  const server = createServer((request, response) => {
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
      response.writeHead(404).end("Not found");
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
              : "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType }).end(content);
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  const serverUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  try {
    const failures: string[] = [];
    for (const [fixtureName, project] of Object.entries(projects)) {
      exported = exportProject(project, { mode: "production" });
      const routes = routesFor(project);
      for (const javascriptEnabled of [false, true]) {
        const context = await browser.newContext({ javaScriptEnabled: javascriptEnabled });
        const page = await context.newPage();
        await page.route(/\/fixtures\/[a-z0-9-]+\.(png|webp)$/, (route) => {
          const pathMatch = /\/fixtures\/([a-z0-9-]+\.(?:png|webp))$/.exec(
            new URL(route.request().url()).pathname,
          );
          const name = pathMatch?.[1];
          try {
            const content = name
              ? readFileSync(resolve("apps/studio/public/fixtures", name))
              : undefined;
            if (content) {
              route.fulfill({
                status: 200,
                contentType: name.endsWith(".webp") ? "image/webp" : "image/png",
                body: content,
              });
            } else {
              route.abort();
            }
          } catch {
            route.abort();
          }
        });
        page.on("console", (message) => {
          if (message.type() === "error")
            failures.push(`[${fixtureName}][js=${javascriptEnabled}] console: ${message.text()}`);
        });
        page.on("requestfailed", (request) =>
          failures.push(
            `[${fixtureName}][js=${javascriptEnabled}] ${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "?"}`,
          ),
        );
        for (const route of routes) {
          await page.goto(`${serverUrl}${route}`, { waitUntil: "load" });
          const bodyText = await page.locator("body").innerText();
          const h1 = await page
            .locator("h1")
            .first()
            .innerText()
            .catch(() => "");
          expect(
            bodyText.trim().length,
            `${fixtureName} ${route} sin JS: body vacío`,
          ).toBeGreaterThan(80);
          expect(h1.trim().length, `${fixtureName} ${route} sin JS: sin h1`).toBeGreaterThan(0);
          if (route === "/carrito/") {
            expect(bodyText, `${fixtureName} carrito`).toMatch(/vacío|agregaste/i);
          }
          if (route === "/compra/") {
            await expect(page.locator('input[name="name"]').first()).toBeVisible();
          }
        }
        await page.close();
        await context.close();
      }
    }
    expect(failures).toEqual([]);
  } finally {
    await new Promise((resolveClose) => server.close(() => resolveClose()));
  }
});
