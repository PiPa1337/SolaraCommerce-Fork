import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";

const PRODUCT_PATH = "/productos/remera-esencial-de-algodon/";
const GALLERY_VARIANT_MANTA = "modo-variant-01-02";
const SOLD_OUT_VARIANT = "modo-variant-01-08";
const FIRST_VARIANT = "modo-variant-01-01";
const ARENA_PILL = "modo-variant-01-05";

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

const galleryStore = structuredClone(catalogModernStore);
{
  const product = galleryStore.products.find(
    (candidate) => candidate.slug === "remera-esencial-de-algodon",
  );
  if (!product) throw new Error("Fixture sin remera esencial");
  product.imageIds = ["asset-manta", "asset-jarra"];
  const negroS = product.variants.find((variant) => variant.title === "Negro / S");
  if (!negroS) throw new Error("Fixture sin variante Negro / S");
  negroS.imageId = "asset-jarra";
}

function fileText(content: string | Uint8Array | undefined): string {
  return typeof content === "string"
    ? content
    : new TextDecoder().decode(content ?? new Uint8Array());
}

const baseExport = exportProject(catalogModernStore, { mode: "production" });
const galleryExport = exportProject(galleryStore, { mode: "production" });
const baseIndexHtml = fileText(baseExport.files.get("index.html"));
const productHtml = fileText(
  baseExport.files.get("productos/remera-esencial-de-algodon/index.html"),
);

function startServer(exported: typeof baseExport): Promise<number> {
  return new Promise((resolveListening) => {
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
    server.listen(0, "127.0.0.1", () => {
      resolveListening((server.address() as AddressInfo).port);
    });
  });
}

let basePort = 0;
let galleryPort = 0;

test.beforeAll(async () => {
  [basePort, galleryPort] = await Promise.all([
    startServer(baseExport),
    startServer(galleryExport),
  ]);
});

test.afterAll(async () => {
  // Los servidores se cierran solos al terminar el proceso de test.
});

function storeUrl(port: number, path: string): string {
  return `http://127.0.0.1:${port}${path}`;
}

test("C1: el toggle de carrito abre el drawer, refleja aria-expanded y devuelve el foco", async ({
  page,
}) => {
  test.info().annotations.push({ type: "contrato", description: "A27 · C1 · cart toggle" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(storeUrl(basePort, "/"));

  expect(baseIndexHtml).toContain(
    'data-solara-cart-open data-open-cart data-cart-label="Carrito" aria-controls="solara-cart" aria-expanded="false"',
  );
  expect(baseIndexHtml).toContain('data-solara-cart-count data-cart-count aria-live="polite"');

  const toggle = page.locator("[data-solara-cart-open]");
  const drawer = page.locator("[data-cart-drawer]");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toHaveAttribute("aria-label", "Carrito vacío");
  await expect(toggle.locator("[data-cart-count]")).toHaveText("0");
  await expect(drawer).toHaveAttribute("aria-hidden", "true");

  await toggle.click();
  await expect(drawer).toHaveAttribute("data-open", "true");
  await expect(drawer).toHaveAttribute("aria-hidden", "false");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Cerrar carrito" })).toBeFocused();
  await expect(page.locator(".catalog-cart-backdrop")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(drawer).not.toHaveAttribute("data-open", "true");
  await expect(drawer).toHaveAttribute("aria-hidden", "true");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();

  await toggle.click();
  await expect(drawer).toHaveAttribute("data-open", "true");
  await page.getByRole("button", { name: "Cerrar carrito" }).click();
  await expect(drawer).not.toHaveAttribute("data-open", "true");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();

  await toggle.click();
  await expect(drawer).toHaveAttribute("data-open", "true");
  await page.locator(".catalog-cart-backdrop").click({ position: { x: 8, y: 240 } });
  await expect(drawer).not.toHaveAttribute("data-open", "true");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
});

test("C2: agregar al carrito crea la línea, actualiza contador y subtotales con límites", async ({
  page,
}) => {
  test.info().annotations.push({ type: "contrato", description: "A27 · C2 · add-to-cart" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(storeUrl(basePort, PRODUCT_PATH));

  const toggle = page.locator("[data-solara-cart-open]");
  const addButton = page.getByRole("button", { name: "Agregar al carrito" });
  await expect(addButton).toBeEnabled();
  await page.locator('input[name="quantity"]').fill("2");
  await addButton.click();

  const drawer = page.locator("[data-cart-drawer]");
  await expect(drawer).toHaveAttribute("data-open", "true");
  await expect(toggle.locator("[data-cart-count]")).toHaveText("2");
  await expect(toggle).toHaveAttribute("aria-label", "Carrito, 2 productos");
  const line = drawer.locator(".solara-cart-line").first();
  await expect(line).toContainText("Remera esencial de algodón");
  await expect(line).toContainText("Negro / S");
  await expect(drawer.locator("[data-cart-subtotal]")).toHaveText("$ 57.700,00");
  await expect(drawer.locator("[data-cart-total]")).toHaveText("$ 57.700,00");
  await expect(line).toContainText("$ 57.700,00");

  await page.keyboard.press("Escape");
  await expect(drawer).not.toHaveAttribute("data-open", "true");
  await page.locator('input[name="quantity"]').fill("1");
  await addButton.click();
  await expect(drawer).toHaveAttribute("data-open", "true");
  await expect(toggle.locator("[data-cart-count]")).toHaveText("3");
  await expect(drawer.locator("[data-cart-total]")).toHaveText("$ 86.550,00");

  const quantityInput = drawer.locator("[data-cart-quantity]").first();
  await quantityInput.fill("150");
  await quantityInput.blur();
  await expect(quantityInput).toHaveValue("99");
  await expect(toggle.locator("[data-cart-count]")).toHaveText("99");
  await expect(drawer.locator("[data-cart-total]")).toHaveText("$ 2.856.150,00");

  await quantityInput.fill("0");
  await quantityInput.blur();
  await expect(quantityInput).toHaveValue("99");
  await expect(toggle.locator("[data-cart-count]")).toHaveText("99");

  await drawer.locator("[data-cart-remove]").first().click();
  await expect(toggle.locator("[data-cart-count]")).toHaveText("0");
  await expect(toggle).toHaveAttribute("aria-label", "Carrito vacío");
  await expect(drawer.locator("[data-cart-lines]")).toContainText("Tu carrito está vacío");
});

test("C3: sin JavaScript hay fallback de WhatsApp y la búsqueda sigue visible", async ({
  browser,
}) => {
  test.info().annotations.push({ type: "contrato", description: "A27 · C3 · noscript" });
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto(storeUrl(basePort, PRODUCT_PATH));
  const fallback = page.locator("a.catalog-add-fallback");
  await expect(fallback).toBeVisible();
  const href = await fallback.getAttribute("href");
  expect(href).toMatch(/^https:\/\/wa\.me\/5491123456789\?text=/);
  const message = decodeURIComponent(href ?? "");
  expect(message).toContain("Remera esencial de algodón");
  expect(message).toContain("Negro / S");
  expect(message).toContain("Precio: $");
  await expect(page.locator(".catalog-product-add")).toBeHidden();

  await page.goto(storeUrl(basePort, "/"));
  const searchNoscript = page.locator("a.catalog-search-noscript");
  await expect(searchNoscript).toBeVisible();
  await expect(searchNoscript).toHaveAttribute("href", "/buscar/");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator("#catalog-mobile-menu")).toBeVisible();
  await expect(
    page.locator('#catalog-mobile-menu .catalog-mobile-nav-link[href="/"]'),
  ).toBeVisible();
  await context.close();
});

test("C4: las miniaturas de galería intercambian la figura activa y sincronizan con la variante", async ({
  page,
}) => {
  test.info().annotations.push({ type: "contrato", description: "A27 · C4 · gallery thumbs" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(storeUrl(galleryPort, PRODUCT_PATH));

  const figures = page.locator("[data-gallery-image-id]");
  await expect(figures).toHaveCount(2);
  const thumbs = page.locator("[data-gallery-thumb]");
  await expect(thumbs).toHaveCount(2);

  await expect(figures.nth(0)).toHaveAttribute("data-gallery-active", "true");
  await expect(figures.nth(1)).toHaveAttribute("data-gallery-active", "false");
  await expect(thumbs.nth(0)).toHaveAttribute("aria-current", "true");
  await expect(thumbs.nth(1)).toHaveAttribute("aria-current", "false");

  await thumbs.nth(1).click();
  await expect(figures.nth(0)).toHaveAttribute("data-gallery-active", "false");
  await expect(figures.nth(1)).toHaveAttribute("data-gallery-active", "true");
  await expect(thumbs.nth(0)).toHaveAttribute("aria-current", "false");
  await expect(thumbs.nth(1)).toHaveAttribute("aria-current", "true");

  await page.locator("[data-variant-select]").selectOption(GALLERY_VARIANT_MANTA);
  await expect(figures.nth(1)).toHaveAttribute("data-gallery-active", "true");
  await expect(thumbs.nth(1)).toHaveAttribute("aria-current", "true");

  await thumbs.nth(0).click();
  await expect(figures.nth(0)).toHaveAttribute("data-gallery-active", "true");
  await expect(thumbs.nth(0)).toHaveAttribute("aria-current", "true");
});

test("C5: el menú móvil abre con aria-expanded, cierra con foco y navega por sus enlaces", async ({
  page,
}) => {
  test.info().annotations.push({ type: "contrato", description: "A27 · C5 · mobile menu" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(storeUrl(basePort, "/"));

  expect(baseIndexHtml).toContain(
    'data-catalog-menu-open aria-controls="catalog-mobile-menu" aria-expanded="false"',
  );

  const openButton = page.locator("[data-catalog-menu-open]");
  const menu = page.locator("#catalog-mobile-menu");
  await expect(openButton).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toHaveAttribute("aria-hidden", "true");

  await openButton.click();
  await expect(menu).toHaveAttribute("aria-hidden", "false");
  await expect(openButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Cerrar menú" })).toBeFocused();

  const categories = page.locator(".catalog-mobile-categories");
  await categories.locator(":scope > summary").click();
  await expect(categories.locator(":scope > summary")).toHaveAttribute("aria-expanded", "true");
  await page.locator(".catalog-mobile-category").first().locator(":scope > summary").click();
  await expect(
    page.locator('.catalog-mobile-category__parent[href="/categorias/remeras/"]'),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-hidden", "true");
  await expect(openButton).toHaveAttribute("aria-expanded", "false");
  await expect(openButton).toBeFocused();

  await openButton.click();
  await page.locator('.catalog-mobile-category__parent[href="/categorias/remeras/"]').click();
  await expect(page).toHaveURL(/\/categorias\/remeras\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Remeras" })).toBeVisible();
});

test("C6: la búsqueda abre el dialog con aria-expanded y cierra con Escape o backdrop", async ({
  page,
}) => {
  test.info().annotations.push({ type: "contrato", description: "A27 · C6 · search dialog" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(storeUrl(basePort, "/"));

  expect(baseIndexHtml).toContain(
    'data-catalog-search-open aria-controls="catalog-search-dialog" aria-expanded="false"',
  );

  const trigger = page.locator("[data-catalog-search-open]");
  const dialog = page.locator("#catalog-search-dialog");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#catalog-search-input")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(page.locator("#catalog-search-input")).toBeFocused();
  await page.mouse.click(10, 10);
  await expect(dialog).toBeHidden();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("C7: el mega menú despliega con aria-expanded y sus enlaces navegan", async ({ page }) => {
  test.info().annotations.push({ type: "contrato", description: "A27 · C7 · mega menu" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(storeUrl(basePort, "/"));

  const trigger = page.locator(".catalog-desktop-nav .catalog-nav-trigger");
  const megaMenu = page.locator(".catalog-desktop-nav .catalog-mega-menu");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await trigger.click();
  await expect(megaMenu).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(
    megaMenu.locator('.catalog-mega-group__children a[href="/categorias/basicas/"]'),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(megaMenu).toBeHidden();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();

  await trigger.click();
  await megaMenu.locator('.catalog-mega-group__children a[href="/categorias/basicas/"]').click();
  await expect(page).toHaveURL(/\/categorias\/basicas\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Básicas" })).toBeVisible();

  await page.goto(storeUrl(basePort, "/"));
  await page.locator(".catalog-desktop-nav .catalog-nav-trigger").click();
  await page.locator(".catalog-desktop-nav .catalog-mega-group__link").first().click();
  await expect(page).toHaveURL(/\/categorias\/remeras\/$/);
});

test("C8: los tabs del detalle cambian paneles, aria-selected y navegan con teclado", async ({
  page,
}) => {
  test.info().annotations.push({ type: "contrato", description: "A27 · C8 · product tabs" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(storeUrl(basePort, PRODUCT_PATH));

  const detailsTab = page.getByRole("tab", { name: "Detalles" });
  const policiesTab = page.getByRole("tab", { name: "Envíos y cambios" });
  const reviewsTab = page.getByRole("tab", { name: "Reseñas" });
  const detailsPanels = page.locator('[data-product-tab-panel="details"]');
  const policiesPanel = page.locator('[data-product-tab-panel="policies"]');
  const reviewsPanel = page.locator('[data-product-tab-panel="reviews"]');

  await expect(detailsPanels).toHaveCount(2);
  await expect(detailsTab).toHaveAttribute("aria-selected", "true");
  await expect(policiesTab).toHaveAttribute("aria-selected", "false");
  await expect(detailsPanels.nth(0)).toBeVisible();
  await expect(detailsPanels.nth(1)).toBeVisible();
  await expect(policiesPanel).toBeHidden();
  await expect(reviewsPanel).toBeHidden();

  const detailsControls = await detailsTab.getAttribute("aria-controls");
  const controlIds = (detailsControls ?? "").split(/\s+/).filter(Boolean);
  expect(controlIds.length).toBeGreaterThanOrEqual(2);
  for (const controlId of controlIds) {
    await expect(page.locator(`#${controlId}`)).toHaveCount(1);
  }

  await policiesTab.click();
  await expect(policiesTab).toHaveAttribute("aria-selected", "true");
  await expect(detailsTab).toHaveAttribute("aria-selected", "false");
  await expect(policiesPanel).toBeVisible();
  await expect(detailsPanels.nth(0)).toBeHidden();
  await expect(detailsPanels.nth(1)).toBeHidden();
  await expect(reviewsPanel).toBeHidden();

  await reviewsTab.click();
  await expect(reviewsTab).toHaveAttribute("aria-selected", "true");
  await expect(reviewsPanel).toBeVisible();
  await expect(policiesPanel).toBeHidden();

  await detailsTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(policiesTab).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(reviewsTab).toBeFocused();
});

test("C9: el botón de compra refleja disponibilidad, pill y variante agotada", async ({ page }) => {
  test.info().annotations.push({ type: "contrato", description: "A27 · C9 · buy button states" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(storeUrl(basePort, PRODUCT_PATH));

  const select = page.locator("[data-variant-select]");
  const addButton = page.locator("[data-add-to-cart]");
  const availability = page.locator("[data-product-availability]");
  const sku = page.locator("[data-product-sku]");

  await expect(addButton).toBeEnabled();
  await expect(addButton).toHaveText("Agregar al carrito");
  await expect(availability).toHaveText("Disponible");
  await expect(sku).toHaveText("MS-001-NE-S");
  await expect(page.locator('option[value="modo-variant-01-08"]')).toBeDisabled();

  await page.getByRole("button", { name: "Arena", exact: true }).click();
  await expect(select).toHaveValue(ARENA_PILL);
  await expect(page.getByRole("button", { name: "Negro", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("button", { name: "Arena", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(addButton).toBeEnabled();

  await select.evaluate((element, variantId) => {
    const target = element as HTMLSelectElement;
    target.value = variantId;
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }, SOLD_OUT_VARIANT);
  await expect(addButton).toBeDisabled();
  await expect(addButton).toHaveText("Sin stock");
  await expect(availability).toHaveText("Agotado");
  await expect(sku).toHaveText("MS-001-AR-XL");
  await expect(select.locator(`option[value="${SOLD_OUT_VARIANT}"]`)).toHaveAttribute(
    "data-available",
    "false",
  );

  await select.evaluate((element, variantId) => {
    const target = element as HTMLSelectElement;
    target.value = variantId;
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }, FIRST_VARIANT);
  await expect(addButton).toBeEnabled();
  await expect(addButton).toHaveText("Agregar al carrito");
  await expect(availability).toHaveText("Disponible");
});

test("C9b: un producto con todas las variantes agotadas inicia el botón deshabilitado", async ({
  page,
}) => {
  test.info().annotations.push({ type: "contrato", description: "A27 · C9 · sold out product" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(storeUrl(basePort, "/productos/sweater-cuello-alto/"));

  const addButton = page.locator("[data-add-to-cart]");
  await expect(addButton).toBeDisabled();
  await expect(addButton).toHaveText("Sin stock");
  await expect(page.locator("[data-product-availability]")).toHaveText("Agotado");
  await expect(page.locator("[data-variant-select] option")).toBeDisabled();
  await expect(page.locator('[data-variant-option][data-option-value="Único"]')).toBeDisabled();
});

test("C10: el checkout del drawer moderno genera el enlace de WhatsApp con el pedido", async ({
  page,
}) => {
  test.info().annotations.push({ type: "contrato", description: "A27 · C10 · checkout" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(storeUrl(basePort, PRODUCT_PATH));

  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  const drawer = page.locator("[data-cart-drawer]");
  await expect(drawer).toHaveAttribute("data-open", "true");

  await page.locator("#catalog-drawer-name").fill("Malena Ortiz");
  await page.locator("#catalog-drawer-phone").fill("11 5555 0142");
  await page.locator("#catalog-drawer-address").fill("Av. Forest 842, CABA");
  await page.locator("#catalog-drawer-notes").fill("Entregar por la tarde");
  await drawer.getByRole("button", { name: "Continuar por WhatsApp" }).click();

  const link = drawer.locator("[data-whatsapp-link]");
  await expect(link).toBeVisible();
  await expect(link).toBeFocused();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^https:\/\/wa\.me\/5491123456789\?text=/);
  const message = decodeURIComponent(href ?? "");
  expect(message).toContain("1 x Remera esencial de algodón (Negro / S) [MS-001-NE-S]");
  expect(message).toContain("Total estimado: $");
  expect(message).toContain("Entregar por la tarde");
  await expect(drawer.locator("[data-order-preview]")).toContainText("Nombre: Malena Ortiz");
  await expect(drawer.locator("[data-order-preview]")).toContainText("11 5555 0142");
});

test.fixme(
  "A29: el drawer de carrito abierto inertea a los hermanos de la página (como el menú móvil)",
  async ({ page }) => {
    test
      .info()
      .annotations.push({ type: "contrato", description: "A27 · fixme A29 · drawer inert" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(storeUrl(basePort, "/"));

    await page.locator("[data-solara-cart-open]").click();
    await expect(page.locator('[data-solara-module="catalog-hero"]')).toHaveAttribute("inert", "");
  },
);

test("C11: el contrato del detalle moderno declara los atributos que lee el runtime", async () => {
  test.info().annotations.push({ type: "contrato", description: "A27 · C11 · markup contract" });
  expect(productHtml).toContain('data-product data-product-id="modo-product-01"');
  expect(productHtml).toContain('data-default-variant="modo-variant-01-01"');
  expect(productHtml).toContain("data-solara-add-form");
  expect(productHtml).toContain("data-variant-select");
  expect(productHtml).toContain('data-variant-data="modo-variant-01-01"');
  expect(productHtml).toContain("data-add-to-cart");
  expect(productHtml).toContain("data-product-tabs");
  expect(productHtml).toContain('data-gallery-image-id="asset-manta"');
  expect(productHtml).toContain('data-gallery-thumb="asset-manta"');
  expect(productHtml).toContain('data-option-key="Color"');
  expect(productHtml).toContain('data-option-key="Talle"');
  expect(productHtml).toContain('data-variant-option data-option-key="Talle"');
  expect(productHtml).toContain('href="https://wa.me/5491123456789?text=');
  expect(productHtml).toContain('name="quantity" type="number" min="1" max="99"');
  expect(productHtml).toContain(
    'data-product-tab="details" aria-controls="catalog-product-description-',
  );
  expect(productHtml).toContain("catalog-product-description-");
  expect(baseIndexHtml).toContain('aria-controls="solara-cart" aria-expanded="false"');
  expect(baseIndexHtml).toContain(
    'id="catalog-mobile-menu" class="catalog-mobile-menu" data-catalog-menu hidden role="dialog" aria-modal="true" aria-hidden="true"',
  );
  expect(baseIndexHtml).toContain(
    'id="solara-cart" class="catalog-cart-drawer" data-cart-drawer aria-label="Tu carrito" aria-modal="true" aria-hidden="true" inert',
  );
  expect(baseIndexHtml).toContain("catalog-search-noscript");
});
