/**
 * Caza de bugs: matriz de navegacion. Desde cada pagina, todo link interno
 * debe responder 200 y no generar duplicados por trailing slash.
 */
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

const exported = exportProject(catalogModernV2Store, { mode: "production" });
let server: Server;
let serverUrl = "";

test.beforeAll(async () => {
  const notFound = exported.files.get("404.html") ?? "<h1>nf</h1>";
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const path =
      requested === ""
        ? "index.html"
        : requested.endsWith("/")
          ? `${requested}index.html`
          : requested;
    const file = exported.files.get(path);
    if (!file) {
      response.writeHead(404, { "Content-Type": "text/html" }).end(notFound);
      return;
    }
    const ext = path.split(".").pop();
    response.writeHead(200, {
      "Content-Type":
        ext === "css"
          ? "text/css"
          : ext === "js"
            ? "text/javascript"
            : ext === "webp"
              ? "image/webp"
              : ext === "png"
                ? "image/png"
                : "text/html; charset=utf-8",
    });
    response.end(file);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("sin puerto");
  serverUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  server.close();
});

const PAGES = [
  "/",
  "/categorias/remeras/",
  "/productos/remera-esencial-de-algodon/",
  "/colecciones/recien-llegados/",
  "/contacto/",
  "/nosotros/",
  "/carrito/",
  "/checkout/",
];

test("todo link interno responde sin 404 ni redirect", async ({ page }) => {
  const broken: string[] = [];
  for (const from of PAGES) {
    await page.goto(new URL(from, serverUrl).toString());
    const hrefs = await page.evaluate(() => {
      return [...document.querySelectorAll("a[href]")]
        .map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? "")
        .filter((href) => href.startsWith("/") && !href.startsWith("//"));
    });
    const unique = [...new Set(hrefs)];
    for (const href of unique) {
      const response = await page.request.get(new URL(href, serverUrl).toString(), {
        maxRedirects: 0,
      });
      if (response.status() !== 200) broken.push(`${from} -> ${href} = ${response.status()}`);
    }
  }
  expect(broken, `links rotos:\n${broken.join("\n")}`).toEqual([]);
});

test("rutas solo existen con trailing slash (sin duplicados)", async ({ page }) => {
  // En hosting estatico cada ruta es una carpeta: la version sin slash no
  // existe como archivo y NO debe existir una copia .html paralela.
  // En V2, /contacto/ y /nosotros/ no existen como paginas independientes
  // (son secciones del home); validar solo rutas que el contrato V2 publica.
  const routes = [
    "/categorias/remeras",
    "/productos/remera-esencial-de-algodon",
    "/buscar",
    "/carrito",
  ];
  for (const route of routes) {
    const withSlash = await page.request.get(new URL(`${route}/`, serverUrl).toString());
    expect(withSlash.status(), `${route}/`).toBe(200);
    const withoutSlash = await page.request.get(new URL(route, serverUrl).toString());
    expect(withoutSlash.status(), `${route} sin slash no debe existir como archivo`).toBe(404);
  }
});
