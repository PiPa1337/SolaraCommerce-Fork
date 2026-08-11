/**
 * Barrido A29 (2026-08-10) — Runtime: carrito / checkout / drawer / WhatsApp.
 * OWNER de `packages/storefront-runtime/src/index.ts`. Se verifica contra el
 * sitio EXPORTADO de `catalogModernStore` (patrón de catalog-modern.spec.ts).
 *
 * Cada control se valida con el contrato de 3 capas: (1) efecto real en estado
 * o datos, (2) auto-feedback del control (aria-expanded / aria-live / disabled /
 * role=alert / foco), (3) contrato de datos (payload → localStorage y mensaje
 * wa.me construido con totales en centavos).
 *
 * Controles del bin:
 *  - Agregar al carrito: aparece la línea, el badge de conteo y se abre el drawer.
 *  - Enter en el campo de cantidad del producto: agrega (listener de submit).
 *  - Edición de cantidad en el drawer: restaura en vacío/cero; acota 1–99.
 *  - Quitar línea: desaparece, badge y totales recalcular.
 *  - Drawer: aria-expanded, cierre con Escape, trampa de foco y retorno al trigger.
 *  - Checkout del drawer: mensaje de WhatsApp con saludo, formato de línea, SKU
 *    y total en centavos (URL wa.me).
 *  - Línea no disponible: se conserva con "Ya no disponible" (no se descarta).
 *  - Página de carrito: reconciliación con precios frescos de catalog-index.json.
 *  - Totales con aria-live.
 */
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

const PRODUCT_URL = "/productos/remera-esencial-de-algodon/";
const STORAGE_KEY = "solara-cart:store-modo-sur";
const VARIANT_ID = "modo-variant-01-01";
const FRESH_PRICE = 2_885_000;

async function clearCart(page: import("@playwright/test").Page) {
  await page.goto(storeUrl("/"));
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();
}

async function seedCart(
  page: import("@playwright/test").Page,
  lines: Array<Record<string, unknown>>,
) {
  await page.goto(storeUrl("/"));
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [
    STORAGE_KEY,
    lines,
  ] as const);
  await page.reload();
}

function storedCart(page: import("@playwright/test").Page) {
  return page.evaluate(
    ([key]) => {
      const raw = localStorage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as unknown);
    },
    [STORAGE_KEY] as const,
  );
}

test("agregar al carrito: línea visible, badge de conteo y drawer con aria-expanded", async ({
  page,
}) => {
  await clearCart(page);
  await page.goto(storeUrl(PRODUCT_URL));
  const trigger = page.locator("[data-solara-cart-open]").first();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await page.getByRole("button", { name: "Agregar al carrito" }).click();

  const drawer = page.locator("[data-cart-drawer]");
  await expect(drawer).toHaveAttribute("data-open", "true");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-cart-count]").first()).toHaveText("1");
  await expect(drawer).toContainText("Remera esencial de algodón");
  await expect(drawer).toContainText("Negro / S");

  const stored = (await storedCart(page)) as Array<Record<string, unknown>>;
  expect(stored).toHaveLength(1);
  expect(stored[0]).toEqual(
    expect.objectContaining({
      variantId: VARIANT_ID,
      productId: "modo-product-01",
      sku: "MS-001-NE-S",
      unitPrice: FRESH_PRICE,
      quantity: 1,
      available: true,
    }),
  );
});

test("Enter en el campo de cantidad agrega al carrito (listener de submit)", async ({ page }) => {
  await clearCart(page);
  await page.goto(storeUrl(PRODUCT_URL));
  await page.locator('input[name="quantity"]').fill("3");
  await page.locator('input[name="quantity"]').press("Enter");

  await expect(page.locator("[data-cart-count]").first()).toHaveText("3");
  const drawer = page.locator("[data-cart-drawer]");
  await expect(drawer).toHaveAttribute("data-open", "true");
  await expect(drawer.locator("[data-cart-quantity]").first()).toHaveValue("3");
  expect(((await storedCart(page)) as Array<Record<string, unknown>>)[0]?.quantity).toBe(3);
});

test("edición de cantidad: restaura en vacío y cero, acota a 1–99", async ({ page }) => {
  await clearCart(page);
  await page.goto(storeUrl(PRODUCT_URL));
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  const input = page.locator("[data-cart-drawer] [data-cart-quantity]").first();

  await input.fill("");
  await input.blur();
  await expect(input).toHaveValue("1");

  await input.fill("0");
  await input.blur();
  await expect(input).toHaveValue("1");

  await input.fill("150");
  await input.blur();
  await expect(input).toHaveValue("99");
  await expect(page.locator("[data-cart-count]").first()).toHaveText("99");
  expect(((await storedCart(page)) as Array<Record<string, unknown>>)[0]?.quantity).toBe(99);

  await input.fill("-2");
  await input.blur();
  await expect(input).toHaveValue("99");

  await input.fill("7");
  await input.blur();
  await expect(input).toHaveValue("7");
  expect(((await storedCart(page)) as Array<Record<string, unknown>>)[0]?.quantity).toBe(7);
});

test("quitar línea: desaparece, badge y totales recalculan y persisten vacío", async ({ page }) => {
  await clearCart(page);
  await page.goto(storeUrl(PRODUCT_URL));
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  const drawer = page.locator("[data-cart-drawer]");

  await drawer.getByRole("button", { name: "Eliminar Remera esencial de algodón" }).click();
  await expect(drawer.locator(".solara-cart-line")).toHaveCount(0);
  await expect(page.locator("[data-cart-count]").first()).toHaveText("0");
  await expect(drawer).toContainText("Tu carrito está vacío");
  await expect(page.locator("[data-cart-subtotal]").first()).toHaveText("$ 0,00");
  expect(await storedCart(page)).toEqual([]);
});

test("drawer: abre con aria-expanded, cierra con Escape y devuelve el foco al trigger", async ({
  page,
}) => {
  await clearCart(page);
  await page.goto(storeUrl("/"));
  const trigger = page.locator("[data-solara-cart-open]").first();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await trigger.click();
  const drawer = page.locator("[data-cart-drawer]");
  await expect(drawer).toHaveAttribute("data-open", "true");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(drawer).toHaveAttribute("aria-hidden", "false");
  await expect(drawer).not.toHaveAttribute("inert", "");
  await expect(drawer.getByRole("button", { name: "Cerrar carrito" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(drawer).not.toHaveAttribute("data-open", "true");
  await expect(drawer).toHaveAttribute("aria-hidden", "true");
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("drawer: trampa de foco con Tab y Shift+Tab dentro del panel", async ({ page }) => {
  await clearCart(page);
  await page.goto(storeUrl(PRODUCT_URL));
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  const drawer = page.locator("[data-cart-drawer]");
  await expect(drawer).toHaveAttribute("data-open", "true");

  const first = drawer.locator("button:not([disabled])").first();
  const last = drawer.locator("button:not([disabled])").last();
  await expect(first).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(last).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();
});

test("checkout del drawer: URL wa.me con saludo, líneas, SKU y total en centavos", async ({
  page,
}) => {
  await clearCart(page);
  await page.goto(storeUrl(PRODUCT_URL));
  await page.locator('input[name="quantity"]').fill("2");
  await page.locator('input[name="quantity"]').press("Enter");
  const drawer = page.locator("[data-cart-drawer]");
  await expect(drawer.locator("[data-cart-quantity]").first()).toHaveValue("2");

  await drawer.getByLabel("Nombre").fill("Malena Ortiz");
  await drawer.getByLabel("Teléfono").fill("11 5555 0142");
  await drawer.getByLabel("Dirección o punto de entrega").fill("Av. Forest 842, CABA");
  await drawer.getByLabel("Notas opcionales").fill("Entregar por la tarde");
  await drawer.locator('button[type="submit"]').click();

  const link = drawer.locator("[data-whatsapp-link]");
  await expect(link).toBeVisible();
  await expect(link).toBeFocused();
  const href = await link.getAttribute("href");
  expect(href).not.toBeNull();
  const url = new URL(href ?? "");
  expect(url.protocol).toBe("https:");
  expect(url.host).toBe("wa.me");
  expect(url.pathname).toBe("/5491123456789");
  const message = (url.searchParams.get("text") ?? "").replace(/[\u202F\u00A0]/g, " ");
  expect(message).toContain("Hola Modo Sur, quiero hacer este pedido:");
  expect(message).toContain(
    "- 2 x Remera esencial de algodón (Negro / S) [MS-001-NE-S]: $ 57.700,00",
  );
  expect(message).toContain("Total estimado: $ 57.700,00");
  expect(message).toContain("Nombre: Malena Ortiz");
  expect(message).toContain("Teléfono: 11 5555 0142");
  expect(message).toContain("Entrega: Av. Forest 842, CABA");
  expect(message).toContain("Notas: Entregar por la tarde");
  expect(message).toContain("Entiendo que precio, disponibilidad, envío y pago se confirman");
  await expect(drawer.locator("[data-order-preview]")).toContainText("Total estimado: $ 57.700,00");
});

test("línea no disponible: se conserva con aviso y el checkout la bloquea", async ({ page }) => {
  await seedCart(page, [
    {
      productId: "p-vieja",
      variantId: "modo-variant-99-99",
      title: "Remera retirada",
      variantTitle: "Único",
      sku: "MS-999",
      unitPrice: 100000,
      quantity: 1,
      imageUrl: "",
      available: true,
    },
    {
      productId: "modo-product-01",
      variantId: VARIANT_ID,
      title: "Remera esencial de algodón",
      variantTitle: "Negro / S",
      sku: "MS-001-NE-S",
      unitPrice: 100,
      quantity: 1,
      imageUrl: "",
      available: true,
    },
  ]);
  await page.goto(storeUrl(PRODUCT_URL));
  await page.locator("[data-solara-cart-open]").first().click();
  const drawer = page.locator("[data-cart-drawer]");
  const line = drawer.locator(".solara-cart-line").first();
  await expect(line).toContainText("Ya no disponible");
  await expect(line.locator("[data-cart-quantity]")).toBeDisabled();
  await expect(line.getByRole("button", { name: "Eliminar Remera retirada" })).toBeEnabled();

  const stored = (await storedCart(page)) as Array<Record<string, unknown>>;
  expect(
    stored.some(
      (item) =>
        item.variantId === "modo-variant-99-99" && item.available === false && item.quantity === 1,
    ),
  ).toBe(true);

  await drawer.getByLabel("Nombre").fill("Malena Ortiz");
  await drawer.getByLabel("Teléfono").fill("11 5555 0142");
  await drawer.getByLabel("Dirección o punto de entrega").fill("Av. Forest 842, CABA");
  await drawer.locator('button[type="submit"]').click();
  await expect(drawer.locator("[data-order-preview]")).toHaveAttribute("role", "alert");
  await expect(drawer.locator("[data-order-preview]")).toContainText(
    "Retirá los productos no disponibles del carrito antes de enviar el pedido.",
  );
  await expect(drawer.locator("[data-whatsapp-link]")).toBeHidden();

  await line.getByRole("button", { name: "Eliminar Remera retirada" }).click();
  await expect(drawer.locator(".solara-cart-line")).toHaveCount(1);
  await drawer.locator('button[type="submit"]').click();
  const link = drawer.locator("[data-whatsapp-link]");
  await expect(link).toBeVisible();
  await expect(link).toBeFocused();
  await expect(drawer.locator("[data-order-preview]")).toContainText("Total estimado: $ 28.850,00");
  expect(((await storedCart(page)) as Array<Record<string, unknown>>)[0]).toEqual(
    expect.objectContaining({
      variantId: VARIANT_ID,
      unitPrice: FRESH_PRICE,
      quantity: 1,
      available: true,
    }),
  );
});

test("página de carrito: reconciliación con precios frescos de catalog-index.json", async ({
  page,
}) => {
  await seedCart(page, [
    {
      productId: "p-stale",
      variantId: VARIANT_ID,
      title: "Título viejo",
      variantTitle: "Stale",
      sku: "OLD-1",
      unitPrice: 100,
      quantity: 2,
      available: true,
    },
  ]);
  await page.goto(storeUrl("/carrito/"));
  const pageMain = page.locator("main.solara-cart-page");
  await expect(pageMain.locator("[data-cart-subtotal]")).toHaveText("$ 57.700,00", {
    timeout: 15_000,
  });
  await expect(pageMain.locator("[data-cart-total]")).toHaveText("$ 57.700,00");
  await expect(pageMain.locator("[data-cart-lines]")).toContainText("Remera esencial de algodón");

  const stored = (await storedCart(page)) as Array<Record<string, unknown>>;
  expect(stored[0]).toEqual(
    expect.objectContaining({
      variantId: VARIANT_ID,
      unitPrice: FRESH_PRICE,
      quantity: 2,
      available: true,
    }),
  );
});

test("totales del carrito anuncian con aria-live", async ({ page }) => {
  await clearCart(page);
  await page.goto(storeUrl(PRODUCT_URL));
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.locator("[data-cart-subtotal]").first()).toHaveAttribute("aria-live", "polite");
  await expect(page.locator("[data-cart-total]").first()).toHaveAttribute("aria-live", "polite");
  await expect(page.locator("[data-cart-count]").first()).toHaveAttribute("aria-live", "polite");
});

test("drawer: inertea a los hermanos de la página al abrir y los libera al cerrar (fixme A29)", async ({
  page,
}) => {
  await clearCart(page);
  await page.goto(storeUrl("/"));
  const hero = page.locator('[data-solara-module="catalog-hero"]');
  await expect(hero).not.toHaveAttribute("inert", "");
  await page.locator("[data-solara-cart-open]").first().click();
  await expect(page.locator("[data-cart-drawer]")).toHaveAttribute("data-open", "true");
  await expect(hero).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-cart-drawer]")).not.toHaveAttribute("data-open", "true");
  await expect(hero).not.toHaveAttribute("inert", "");
});

test("búsqueda: el término con espacios internos corta por término de 1 carácter (fixme A29)", async ({
  page,
}) => {
  await page.goto(storeUrl("/buscar/?q=a%20b"));
  await expect(page.locator("[data-search-results]")).toContainText(
    "Escribí al menos 2 caracteres para buscar.",
  );
});

test("categoría: el conteo de resultados anuncia con aria-live al filtrar (fixme A29)", async ({
  page,
}) => {
  await page.goto(storeUrl("/categorias/remeras/"));
  const count = page.locator("[data-category-result-count]");
  await expect(count).toHaveAttribute("aria-live", "polite");
  await page.locator("[data-category-tag]").selectOption("diario");
  await expect(count).toContainText("4 de 7 productos");
});

test("/buscar/ moderno: prefill y teclado van al input visible de la página (fixme A29)", async ({
  page,
}) => {
  await page.goto(storeUrl("/buscar/?q=quilted"));
  const input = page.locator("#solara-search-input");
  await expect(input).toHaveValue("quilted");
  await expect(page.locator("[data-search-results] .solara-search-result a").first()).toBeVisible();
  await input.focus();
  await input.press("ArrowDown");
  await expect(page.locator("[data-search-results] .solara-search-result a").first()).toBeFocused();
});
