import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogScaleStore } from "@solara/project-schema/scale-fixture";

import { FIXTURE_PRODUCT_FILES } from "./fixture-server";

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
            : extension === "xml"
              ? "application/xml; charset=utf-8"
              : extension === "png"
                ? "image/png"
                : "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    response.end(content);
  });
  await new Promise<void>((resolveListening) => {
    server.listen(0, "127.0.0.1", resolveListening);
  });
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

test("ver todos los productos puebla /buscar/ con el catálogo completo", async ({ page }) => {
  await page.goto(storeUrl("/buscar/"));
  const cards = page.locator("[data-search-results] .solara-search-result");
  await expect(cards).toHaveCount(50, { timeout: 15_000 });
  await expect(page.locator("[data-category-result-count]")).toContainText("50 de 50");
});

test("la paginación client-side navega y refleja la página en la URL", async ({ page }) => {
  await page.goto(storeUrl("/buscar/"));
  const nav = page.locator(".solara-search-page .solara-pagination");
  await expect(nav).toBeVisible({ timeout: 15_000 });
  await expect(nav).toContainText("Página 1 de 3");
  await expect(nav.getByRole("button", { name: "Anterior" })).toBeDisabled();
  await expect(nav.getByRole("button", { name: "Siguiente" })).toBeEnabled();
  await nav.getByRole("button", { name: "Siguiente" }).click();
  await expect(page).toHaveURL(/\/buscar\/\?pagina=2$/);
  await expect(nav).toContainText("Página 2 de 3");
  await expect(
    page.locator("[data-search-results] .solara-search-result:not([hidden])"),
  ).toHaveCount(24);
  await nav.getByRole("button", { name: "Siguiente" }).click();
  await expect(nav).toContainText("Página 3 de 3");
  await expect(
    page.locator("[data-search-results] .solara-search-result:not([hidden])"),
  ).toHaveCount(2);
  await expect(nav.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  await expect(nav.getByRole("button", { name: "Anterior" })).toBeEnabled();
});

test("el deep-link ?pagina=3 abre esa página y fuera de rango se clampea", async ({ page }) => {
  await page.goto(storeUrl("/buscar/?pagina=3"));
  const nav = page.locator(".solara-search-page .solara-pagination");
  await expect(nav).toContainText("Página 3 de 3", { timeout: 15_000 });
  await expect(
    page.locator("[data-search-results] .solara-search-result:not([hidden])"),
  ).toHaveCount(2);

  await page.goto(storeUrl("/buscar/?pagina=99"));
  await expect(nav).toContainText("Página 3 de 3", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/buscar\/\?pagina=3$/);
});

test("?pagina= profunda declara noindex,follow", async ({ page }) => {
  await page.goto(storeUrl("/buscar/?pagina=2"));
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,follow",
    { timeout: 15_000 },
  );
});

test("los filtros operan sobre todo el catálogo y re-paginan", async ({ page }) => {
  await page.goto(storeUrl("/buscar/?pagina=3"));
  const nav = page.locator(".solara-search-page .solara-pagination");
  const maxPrice = page.locator("[data-category-max-price]");
  await maxPrice.fill("12500");
  // Precio ≤ $12.500: sólo 2 productos del scale store (basePrice $12.250 y $12.500).
  await expect(page.locator("[data-category-result-count]")).toContainText("2 de 50");
  await expect(nav).toBeHidden();
  await expect(
    page.locator("[data-search-results] .solara-search-result:not([hidden])"),
  ).toHaveCount(2);

  // Con 25 resultados el clamp vuelve a la última página existente (2 de 2).
  await page.goto(storeUrl("/buscar/?pagina=3"));
  const tagFilter = page.locator("[data-category-tag]");
  await tagFilter.selectOption("casa");
  await expect(nav).toContainText("Página 2 de 2", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/buscar\/\?pagina=2$/);
});

test("el modo búsqueda con ?q= no se pagina (top 48 intacto)", async ({ page }) => {
  await page.goto(storeUrl("/buscar/?q=escala"));
  await expect(
    page.locator("[data-search-results] .solara-search-result:not([hidden])"),
  ).toHaveCount(48, { timeout: 15_000 });
  await expect(page.locator(".solara-search-page .solara-pagination")).toHaveCount(0);
  await expect(page).toHaveURL(/\/buscar\/\?q=escala$/);
});
