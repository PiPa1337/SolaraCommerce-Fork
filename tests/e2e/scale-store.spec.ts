import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogScaleStore } from "@solara/project-schema/scale-fixture";
import { FIXTURE_PRODUCT_FILES } from "./fixture-server";
import { waitForStorefrontReady } from "./storefront-helpers";

const exported = exportProject(catalogScaleStore, { mode: "production" });
const fixtureFiles = FIXTURE_PRODUCT_FILES;
let server: Server;
let serverUrl: string;

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
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
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
            : extension === "json"
              ? "application/json; charset=utf-8"
              : extension === "xml"
                ? "application/xml; charset=utf-8"
                : extension === "png"
                  ? "image/png"
                  : "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    response.end(content);
  });
  await new Promise<void>((resolveListening) => server.listen(0, "127.0.0.1", resolveListening));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("El servidor de pruebas no tiene una dirección TCP.");
  }
  serverUrl = `http://127.0.0.1:${address.port}`;
});

function storeUrl(path: string): string {
  return new URL(path, serverUrl).toString();
}

test.afterAll(async () => {
  await new Promise<void>((resolveClosing, reject) => {
    server.close((error) => (error ? reject(error) : resolveClosing()));
  });
});

test("prioriza doce productos después del hero y conserva densidad responsive", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 900, columns: 4 },
    { width: 1024, height: 768, columns: 3 },
    { width: 390, height: 844, columns: 2 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(storeUrl("/"));
    const grid = page.locator(
      '[data-solara-module="compact-product-grid"] .solara-compact-products',
    );
    await expect(grid.locator("[data-product-card]")).toHaveCount(12);
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const element = document.querySelector(
            '[data-solara-module="compact-product-grid"] .solara-compact-products',
          );
          return element ? getComputedStyle(element).gridTemplateColumns.split(" ").length : 0;
        }),
      )
      .toBe(viewport.columns);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});

test("la home de escala conserva sus enlaces de producto sin JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(storeUrl("/"));
  await expect(
    page.locator('[data-solara-module="compact-product-grid"] [data-product-card]'),
  ).toHaveCount(12);
  await expect(
    page.locator('[data-solara-module="compact-product-grid"] a[href^="/productos/"]'),
  ).toHaveCount(24);
  await context.close();
});

test("navega nueve raíces y las subcategorías de Casa y Cocina", async ({ page }) => {
  await page.goto(storeUrl("/"));
  await page.locator(".solara-desktop-nav .solara-nav-dropdown > summary").click();
  await expect(page.getByRole("link", { name: "Casa", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cocina", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Textiles", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cerámica", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Textiles", exact: true }).click();
  await expect(page).toHaveURL(/\/categorias\/textiles\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Textiles" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Casa", exact: true })).toBeVisible();
});

test("agrega descendientes, pagina Casa y expone el producto 50", async ({ page }) => {
  await page.goto(storeUrl("/categorias/casa/"));
  await expect(page.locator("[data-category-result-count]")).toHaveText("28 productos");
  await expect(page.getByRole("heading", { level: 2, name: "Explorar Casa" })).toBeVisible();
  await page.goto(storeUrl("/categorias/casa/pagina/2/"));
  await expect(page.getByRole("link", { name: "Anterior" })).toBeVisible();
  await expect(page.locator("body")).toContainText("Pieza de escala 28");
  await page.goto(storeUrl("/productos/pieza-escala-50/"));
  await expect(page.getByRole("heading", { level: 1, name: "Pieza de escala 50" })).toBeVisible();
});

test("busca por ancestro en la escala completa", async ({ page }) => {
  await page.goto(storeUrl("/buscar/?q=Casa"));
  await expect(page.locator("[data-search-results]")).toContainText("Pieza de escala 01");
});

test("conserva el layout sin scroll lateral y navega por el menú móvil", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(storeUrl("/"));
  // El summary del menú móvil dice "Abrir menú"; esperar la señal de listo
  // evita interactuar antes de que el runtime hidrate.
  await waitForStorefrontReady(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
  await page.getByText("Abrir menú", { exact: true }).click();
  await page.locator(".solara-mobile-nav .solara-nav-dropdown > summary").click();
  await expect(
    page.locator(".solara-mobile-nav").getByRole("link", { name: "Casa", exact: true }),
  ).toBeVisible();
});

test("la búsqueda tolera errores de tipeo en la escala", async ({ page }) => {
  await page.goto(storeUrl("/buscar/?q=Csa"));
  await expect(page.locator("[data-search-results]")).toContainText("Pieza de escala 01", {
    timeout: 15_000,
  });
});
