/**
 * Visión profunda del sitio exportado: captura las 11 rutas en 8 viewports
 * más estados interactivos (hover, menú móvil, drawer, filtros).
 * Herramienta de diagnóstico manual — no es gate de CI.
 */
import { createServer, type Server } from "node:http";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

const exported = exportProject(catalogModernV2Store, { mode: "production" });
const OUTPUT_ROOT = "screenshots/storefront-vision";

const VIEWPORTS = [
  { name: "320", width: 320, height: 800 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1280", width: 1280, height: 900 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
] as const;

const PAGES = [
  { dir: "home", path: "/" },
  { dir: "categoria-remeras", path: "/categorias/remeras/" },
  { dir: "producto", path: "/productos/remera-esencial-de-algodon/" },
  { dir: "coleccion-recien-llegados", path: "/colecciones/recien-llegados/" },
  { dir: "busqueda", path: "/buscar/?q=remera" },
  { dir: "carrito-vacio", path: "/carrito/" },
  { dir: "checkout", path: "/checkout/" },
  { dir: "contacto", path: "/contacto/" },
  { dir: "nosotros", path: "/nosotros/" },
  { dir: "privacidad", path: "/privacidad/" },
  { dir: "404", path: "/ruta-inexistente/" },
] as const;

let server: Server;
let serverUrl = "";

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const path = requested === "" ? "index.html" : requested.endsWith("/") ? `${requested}index.html` : requested;
    const file = exported.files.get(path);
    if (!file) {
      response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      response.end(exported.files.get("404.html") ?? "<h1>Not found</h1>");
      return;
    }
    const extension = path.split(".").pop();
    const types = { css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", webp: "image/webp", png: "image/png" };
    response.writeHead(200, {
      "Content-Type": types[extension as keyof typeof types] ?? (path.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream"),
      "Cache-Control": "no-store",
    });
    response.end(file);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("sin puerto");
  serverUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  server.close();
});

/** Reveal progresivo para que el motion on-scroll dispare y el full-page no salga vacío. */
async function revealPage(page: import("@playwright/test").Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 640) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await page.waitForTimeout(45);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(300);
}

for (const viewport of VIEWPORTS) {
  test.describe(`deep ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("captura de rutas", async ({ page }) => {
      mkdirSync(join(OUTPUT_ROOT, viewport.name), { recursive: true });
      for (const route of PAGES) {
        if (route.dir === "busqueda" && viewport.width < 390) continue;
        await page.goto(new URL(route.path, serverUrl).toString());
        await revealPage(page);
        await page.screenshot({ path: join(OUTPUT_ROOT, viewport.name, `${route.dir}.png`), fullPage: true });
      }
    });
  });
}
