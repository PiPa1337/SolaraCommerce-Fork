import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogScaleStore } from "@solara/project-schema/scale-fixture";

const exported = exportProject(catalogScaleStore, { mode: "production" });
const fixtureFiles = new Map<string, Uint8Array>([
  [
    "fixtures/casa-luma-hero.png",
    readFileSync(resolve("apps/studio/public/fixtures/casa-luma-hero.png")),
  ],
  [
    "fixtures/manta-bruma.png",
    readFileSync(resolve("apps/studio/public/fixtures/manta-bruma.png")),
  ],
  [
    "fixtures/jarra-delta.png",
    readFileSync(resolve("apps/studio/public/fixtures/jarra-delta.png")),
  ],
]);
let server: Server;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1:4176");
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
  await new Promise<void>((resolveListening) => server.listen(4176, "127.0.0.1", resolveListening));
});

test.afterAll(async () => {
  await new Promise<void>((resolveClosing, reject) => {
    server.close((error) => (error ? reject(error) : resolveClosing()));
  });
});

test("navega diez raíces y las subcategorías de Casa y Cocina", async ({ page }) => {
  await page.goto("http://127.0.0.1:4176/");
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

test("agrega descendientes, pagina Novedades y expone el producto 50", async ({ page }) => {
  await page.goto("http://127.0.0.1:4176/categorias/casa/");
  await expect(page.locator("[data-category-result-count]")).toHaveText("5 productos");
  await expect(page.getByRole("heading", { level: 2, name: "Explorar Casa" })).toBeVisible();
  await page.goto("http://127.0.0.1:4176/categorias/novedades/pagina/2/");
  await expect(page.getByRole("link", { name: "Anterior" })).toBeVisible();
  await expect(page.locator("body")).toContainText("Pieza de escala 50");
  await page.goto("http://127.0.0.1:4176/productos/pieza-escala-50/");
  await expect(page.getByRole("heading", { level: 1, name: "Pieza de escala 50" })).toBeVisible();
});

test("busca por ancestro y conserva el layout en móvil", async ({ page }) => {
  await page.goto("http://127.0.0.1:4176/buscar/?q=Casa");
  await expect(page.locator("[data-search-results]")).toContainText("Pieza de escala 01");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4176/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
  await page.getByText("Menú", { exact: true }).click();
  await page.locator(".solara-mobile-nav .solara-nav-dropdown > summary").click();
  await expect(
    page.locator(".solara-mobile-nav").getByRole("link", { name: "Casa", exact: true }),
  ).toBeVisible();
});
