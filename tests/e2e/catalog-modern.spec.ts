import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";

const exported = exportProject(catalogModernStore, { mode: "production" });
const fixtureFiles = new Map<string, Uint8Array>([
  [
    "fixtures/modo-sur-hero.png",
    readFileSync(resolve("apps/studio/public/fixtures/modo-sur-hero.png")),
  ],
  [
    "fixtures/modo-sur-remera.png",
    readFileSync(resolve("apps/studio/public/fixtures/modo-sur-remera.png")),
  ],
  [
    "fixtures/modo-sur-jean.png",
    readFileSync(resolve("apps/studio/public/fixtures/modo-sur-jean.png")),
  ],
  [
    "fixtures/modo-sur-camisa.png",
    readFileSync(resolve("apps/studio/public/fixtures/modo-sur-camisa.png")),
  ],
]);

let server: Server;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1:4175");
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
    server.listen(4175, "127.0.0.1", resolveListening);
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolveClosing, reject) => {
    server.close((error) => (error ? reject(error) : resolveClosing()));
  });
});

test("la home moderna prioriza el catálogo y conserva su densidad responsive", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.locator('[data-design-family="catalog-modern-v1"]')).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Vestite con lo que te representa." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar anuncio" }).click();
  await expect(page.locator('[data-solara-module="catalog-announcement"]')).toBeHidden();
  const firstGrid = page.locator(".catalog-product-grid").first();
  await expect(firstGrid.locator(".catalog-product-card")).toHaveCount(12);
  await expect(firstGrid.locator(".catalog-product-card").first()).toBeVisible();
  expect(
    await firstGrid
      .locator(".catalog-product-card")
      .first()
      .evaluate((element) => ({
        opacity: getComputedStyle(element).opacity,
        visibility: getComputedStyle(element).visibility,
      })),
  ).toEqual({ opacity: "1", visibility: "visible" });
  expect(
    await firstGrid.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
    ),
  ).toBe(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(
    firstGrid.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
    ),
  ).resolves.toBe(3);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    firstGrid.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
    ),
  ).resolves.toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
});

test("la categoría moderna mantiene filtros, densidad y pie comercial", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/categorias/remeras/");

  await expect(page.locator(".catalog-category-page")).toBeVisible();
  await expect(page.locator(".catalog-category-filters")).toBeVisible();
  await expect(page.locator('[data-solara-module="catalog-testimonials"]')).toHaveCount(0);
  await expect(page.locator('[data-solara-module="catalog-newsletter-cta"]')).toBeVisible();
  const desktopGrid = page.locator(".catalog-category-results .catalog-product-grid");
  expect(await desktopGrid.count()).toBe(1);
  expect(
    await desktopGrid.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
    ),
  ).toBe(3);
  const tagFilter = page.locator("[data-category-tag]");
  expect(await tagFilter.count()).toBe(1);
  await tagFilter.selectOption("nuevo");
  await expect(
    page.locator(".catalog-category-results .catalog-product-card:not([hidden])"),
  ).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/categorias/remeras/");
  await expect(page.locator(".catalog-category-filters summary")).toBeVisible();
  const mobileGrid = page.locator(".catalog-category-results .catalog-product-grid");
  expect(
    await mobileGrid.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
    ),
  ).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
});

test("la navegación, el detalle moderno y las variantes siguen siendo rastreables", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const catalogTrigger = page.locator(".catalog-desktop-nav .catalog-nav-trigger");
  await expect(catalogTrigger).toHaveText("Categorías");
  await catalogTrigger.click();
  const megaMenu = page.locator(".catalog-desktop-nav .catalog-mega-menu");
  await expect(megaMenu).toBeVisible();
  await expect(megaMenu.locator(".catalog-mega-group")).toHaveCount(10);
  await expect(
    megaMenu.locator(".catalog-mega-group").filter({ hasText: "Remeras" }),
  ).toContainText("Básicas");
  await expect(
    megaMenu.locator(".catalog-mega-group").filter({ hasText: "Pantalones" }),
  ).toContainText("Jeans");
  expect(
    await page
      .locator(".catalog-header-inner")
      .evaluate((element) => getComputedStyle(element).userSelect),
  ).toBe("none");
  expect(await catalogTrigger.evaluate((element) => getComputedStyle(element).userSelect)).toBe(
    "none",
  );
  expect(
    await megaMenu
      .locator(".catalog-mega-menu__groups")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length),
  ).toBe(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/");
  await page.locator(".catalog-desktop-nav .catalog-nav-trigger").click();
  expect(
    await page
      .locator(".catalog-desktop-nav .catalog-mega-menu__groups")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length),
  ).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /Abrir/ }).click();
  await expect(page.locator("#catalog-mobile-menu")).toBeVisible();
  await expect(page.locator('#catalog-mobile-menu a[href="/categorias/remeras/"]')).toBeVisible();
  await page.getByRole("button", { name: "Cerrar menú" }).click();

  await page.goto("/productos/remera-esencial-de-algodon/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Remera esencial de algodón" }),
  ).toBeVisible();
  await expect(page.getByLabel("Elegí talle y color")).toBeVisible();
  await page.getByRole("tab", { name: "Reseñas" }).click();
  await expect(page.getByText("Lo que dicen quienes compraron")).toBeVisible();
  await page.getByLabel("Elegí talle y color").selectOption({ index: 1 });
  await expect(page.locator(".catalog-product-info [data-product-price]")).toBeVisible();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.locator("[data-cart-count]").first()).toHaveText("1");
  await expect(page.locator("[data-cart-subtotal]").first()).toBeVisible();
  await expect(page.locator("[data-cart-drawer]")).toContainText("Entrega");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
});
