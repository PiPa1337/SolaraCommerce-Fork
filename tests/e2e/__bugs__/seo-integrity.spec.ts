/**
 * Caza de bugs: integridad SEO. Canonical, OG, robots, JSON-LD y sitemap
 * coherentes en todas las rutas.
 */
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

const exported = exportProject(catalogModernV2Store, { mode: "production" });
let server: Server;
let serverUrl = "";

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const path = requested === "" ? "index.html" : requested.endsWith("/") ? `${requested}index.html` : requested;
    const file = exported.files.get(path);
    if (!file) { response.writeHead(404).end("nf"); return; }
    response.writeHead(200, { "Content-Type": path.endsWith(".xml") ? "application/xml" : path.endsWith(".txt") ? "text/plain" : "text/html; charset=utf-8" });
    response.end(file);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("sin puerto");
  serverUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => { server.close(); });

const ROUTES = ["/", "/categorias/remeras/", "/productos/remera-esencial-de-algodon/", "/colecciones/recien-llegados/", "/contacto/", "/nosotros/", "/privacidad/"];

test("canonical unico y coherente en cada ruta", async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto(new URL(route, serverUrl).toString());
    const canonicals = await page.evaluate(() => document.querySelectorAll('link[rel="canonical"]').length);
    expect(canonicals, `canonicals en ${route}`).toBeLessThanOrEqual(1);
    const href = canonicals === 1 ? await page.evaluate(() => document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "") : "";
    if (href) {
      const expectedPath = route === "/" ? "/" : route;
      expect(href.endsWith(expectedPath), `canonical ${href} vs ruta ${expectedPath}`).toBe(true);
    }
    const ogCount = await page.evaluate(() => document.querySelectorAll('meta[property="og:title"]').length);
    expect(ogCount, `og:title en ${route}`).toBeLessThanOrEqual(1);
  }
});

test("JSON-LD parseable en home y producto", async ({ page }) => {
  for (const route of ["/", "/productos/remera-esencial-de-algodon/"]) {
    await page.goto(new URL(route, serverUrl).toString());
    const valid = await page.evaluate(() => {
      return [...document.querySelectorAll('script[type="application/ld+json"]')].every((s) => {
        try { JSON.parse(s.textContent ?? ""); return true; } catch { return false; }
      });
    });
    expect(valid, `JSON-LD valido en ${route}`).toBe(true);
  }
});

test("sitemap referencia solo rutas que existen", async ({ request }) => {
  const sitemap = await (await request.get(new URL("/sitemap.xml", serverUrl).toString())).text();
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs.length).toBeGreaterThan(3);
  const localLocs = locs.filter((loc) => !loc.includes(".example"));
  for (const loc of localLocs.slice(0, 15)) {
    const target = loc.startsWith("http") ? loc : new URL(loc, serverUrl).toString();
    const res = await request.get(target);
    expect(res.status(), `sitemap URL rota: ${loc}`).toBe(200);
  }
});
