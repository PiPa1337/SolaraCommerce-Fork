import { mkdirSync, readFileSync } from "node:fs";
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
  const heroTitle = page.locator(".catalog-hero-copy h1");
  const heroMetrics = await heroTitle.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    overflow: getComputedStyle(element).overflow,
  }));
  expect(heroMetrics.overflow).toBe("visible");
  expect(heroMetrics.scrollHeight - heroMetrics.clientHeight).toBeLessThanOrEqual(8);
  await expect(page.locator(".catalog-hero-stats > div")).toHaveCount(3);
  await expect(page.locator('[data-stat="products"] dt')).toHaveText("50");
  await expect(page.locator('[data-stat="categories"] dt')).toHaveText("10");
  await expect(page.locator('[data-stat="whatsapp"] dt')).toHaveText("WhatsApp");
  const statLayout = await page.locator(".catalog-hero-stats > div").evaluateAll((cells) => {
    const rects = cells.map((cell) => {
      const value = cell.querySelector("dt")?.getBoundingClientRect();
      const label = cell.querySelector("dd")?.getBoundingClientRect();
      return {
        height: cell.getBoundingClientRect().height,
        leftDelta: value && label ? Math.abs(value.left - label.left) : Number.POSITIVE_INFINITY,
      };
    });
    return {
      heightRange:
        Math.max(...rects.map((rect) => rect.height)) -
        Math.min(...rects.map((rect) => rect.height)),
      maxLeftDelta: Math.max(...rects.map((rect) => rect.leftDelta)),
    };
  });
  expect(statLayout.heightRange).toBeLessThanOrEqual(1);
  expect(statLayout.maxLeftDelta).toBeLessThanOrEqual(1);
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
  await expect(desktopGrid.locator(".catalog-product-card")).toHaveCount(5);
  expect(
    await desktopGrid
      .locator("img")
      .evaluateAll((images) => images.every((image) => image.naturalWidth > 0)),
  ).toBe(true);
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

test("las cards, el bento y la búsqueda moderna usan contenido real", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const firstCard = page
    .locator(".catalog-product-grid")
    .first()
    .locator(".catalog-product-card")
    .first();
  await expect(firstCard.locator(".catalog-product-category")).toContainText("Básicas");
  await expect(firstCard.locator(".catalog-product-rating")).toHaveCount(0);
  await expect(firstCard.locator(".catalog-product-availability")).toHaveCount(0);

  const bento = page.locator(".catalog-category-bento-section");
  await expect(bento.locator(".catalog-category-bento-item")).toHaveCount(6);
  await expect(bento).toContainText("Remeras");
  await expect(bento).toContainText("Camisas");
  await expect(bento.locator(".catalog-category-bento-item small").first()).toBeVisible();
  expect(
    await bento
      .locator(".catalog-category-bento-item small")
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).not.toBe("rgba(0, 0, 0, 0)");
  await expect(bento.getByRole("link", { name: "Ver todo el catálogo" })).toHaveAttribute(
    "href",
    "/buscar/",
  );

  const searchTrigger = page.locator(".catalog-search-link");
  await searchTrigger.click();
  const dialog = page.locator("#catalog-search-dialog");
  await expect(dialog).toBeVisible();
  await expect(page.locator("#catalog-search-input")).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(
    "hidden",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(searchTrigger).toBeFocused();
  await searchTrigger.click();
  await expect(page.locator("#catalog-search-input")).toBeFocused();
  await page.locator("#catalog-search-input").fill("Remera");
  await page.locator("#catalog-search-dialog form").evaluate((form) => {
    if (!(form instanceof HTMLFormElement)) throw new Error("Formulario de búsqueda inexistente");
    form.requestSubmit();
  });
  await expect(page).toHaveURL(/\/buscar\/\?q=Remera$/);
  await expect(page.locator(".solara-search-summary")).toContainText("Remera");
  await expect(page.locator("[data-search-results] .solara-search-result").first()).toBeVisible();
  await expect(dialog).toBeHidden();

  await page.goto("/nosotros/");
  await expect(page.locator(".solara-editorial-page .solara-story-grid")).toBeVisible();
  expect(
    await page
      .locator(".solara-editorial-page .solara-story-grid")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length),
  ).toBe(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/nosotros/");
  expect(
    await page
      .locator(".solara-editorial-page .solara-story-grid")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length),
  ).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
});

test("captura la matriz visual de Catalog Modern", async ({ page }) => {
  const stage = process.env.VISUAL_REVIEW_STAGE;
  test.skip(!stage, "La revisión visual se ejecuta sólo con VISUAL_REVIEW_STAGE");

  const outputDirectory = resolve("test-results/visual-review");
  mkdirSync(outputDirectory, { recursive: true });
  const routes = [
    { name: "home", path: "/" },
    { name: "category", path: "/categorias/remeras/" },
    { name: "product", path: "/productos/remera-esencial-de-algodon/" },
    { name: "search", path: "/buscar/" },
    { name: "about", path: "/nosotros/" },
  ];
  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 1024, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of routes) {
      await page.goto(route.path);
      await page.evaluate(() => document.fonts?.ready);
      await page.waitForTimeout(700);
      if (route.name === "home" && viewport.name === "desktop") {
        const desktopCatalogTrigger = page.locator(".catalog-desktop-nav .catalog-nav-trigger");
        await desktopCatalogTrigger.click();
        await page.screenshot({
          path: resolve(outputDirectory, `catalog-modern-navbar-${viewport.name}-${stage}.png`),
          fullPage: false,
        });
        await desktopCatalogTrigger.click();
      }
      await page.screenshot({
        path: resolve(
          outputDirectory,
          `catalog-modern-${route.name}-${viewport.name}-${stage}.png`,
        ),
        fullPage: true,
      });
    }
  }
});
