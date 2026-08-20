/**
 * Auditoría Resumen R2 (2026-08-10) — Pedido por WhatsApp: número internacional,
 * saludo del pedido y toggle "Incluir SKU".
 * Contrato de 4 capas (plan docs/superpowers/plans/2026-08-10-auditoria-resumen.md):
 * - funcional: editar → persiste (recarga de la app, respaldo IndexedDB);
 * - auto-feedback: sentinel tratado como vacío, badge Pendiente/Revisar
 *   formato/Formato correcto y error inline de 8-15 dígitos;
 * - datos: los tres valores quedan en el proyecto (inputs y preview);
 * - utilidad: diff del sitio exportado ANTES/DESPUÉS — data-whatsapp del
 *   <html>, URL wa.me real del checkout (runtime), fallback noscript del
 *   módulo y mensaje con SKU vs sin SKU.
 */
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { type StoreProjectV1, StoreProjectV1Schema } from "@solara/project-schema";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 150_000 : 90_000);

const EDITED_PHONE = "5492212345678";
const EDITED_GREETING = "Hola Marca Aurora editada, preparo mi pedido:";
const PRODUCT_PATH = "/productos/remera-esencial-de-algodon/";
// El formato es-AR de Intl separa el símbolo del monto con NBSP (U+00A0),
// tanto en el runtime del sitio como en el formatMoney del exporter.
const PRICE = "$\u00A028.850,00";
const PRODUCT_LINE_WITH_SKU = `1 x Remera esencial de algodón (Negro / S) [MS-001-NE-S]: ${PRICE}`;
const PRODUCT_LINE_NO_SKU = `1 x Remera esencial de algodón (Negro / S): ${PRICE}`;

// Sitio ANTES: tienda demo tal cual (número 5491123456789, saludo original,
// SKU incluido). Sitio DESPUÉS: número/saludo editados y SKU apagado. Un
// tercer export sólo con includeSku=false aísla el efecto del toggle.
const baselineExport = exportProject(structuredClone(catalogModernStore), {
  mode: "production",
});
const noSkuExport = exportProject(withWhatsapp({ includeSku: false }), { mode: "production" });
const editedExport = exportProject(
  withWhatsapp({ phone: EDITED_PHONE, greeting: EDITED_GREETING, includeSku: false }),
  { mode: "production" },
);

function withWhatsapp(overrides: Partial<StoreProjectV1["whatsapp"]>): StoreProjectV1 {
  return StoreProjectV1Schema.parse({
    ...structuredClone(catalogModernStore),
    whatsapp: { ...catalogModernStore.whatsapp, ...overrides },
  });
}

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

function createStaticServer(
  exported: ReturnType<typeof exportProject>,
): Promise<{ server: Server; url: string }> {
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
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        throw new Error("El servidor de pruebas no tiene una dirección TCP.");
      }
      resolveListening({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

let studioServer: Server;
let studioUrl: string;
let baselineServer: Server;
let baselineUrl: string;
let noSkuServer: Server;
let noSkuUrl: string;
let editedServer: Server;
let editedUrl: string;

test.beforeAll(async () => {
  const running = await startStudioServer();
  studioServer = running.server;
  studioUrl = running.url;
  const baseline = await createStaticServer(baselineExport);
  baselineServer = baseline.server;
  baselineUrl = baseline.url;
  const noSku = await createStaticServer(noSkuExport);
  noSkuServer = noSku.server;
  noSkuUrl = noSku.url;
  const edited = await createStaticServer(editedExport);
  editedServer = edited.server;
  editedUrl = edited.url;
});

test.afterAll(async () => {
  await stopStudioServer(studioServer);
  await new Promise<void>((resolveClosing) => baselineServer.close(() => resolveClosing()));
  await new Promise<void>((resolveClosing) => noSkuServer.close(() => resolveClosing()));
  await new Promise<void>((resolveClosing) => editedServer.close(() => resolveClosing()));
});

async function resetIndexedDb(page: Page): Promise<void> {
  await page.goto(studioUrl);
  await page.evaluate(
    () =>
      new Promise<void>((resolveDelete, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.addEventListener("success", () => resolveDelete());
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("blocked", () => reject(new Error("La base quedó bloqueada.")));
      }),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
}

async function openDemoStore(page: Page): Promise<void> {
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible({
    timeout: 30_000,
  });
}

async function openResumenTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
  await expect(page.locator('[data-accordion-id="whatsapp"]')).toBeVisible();
}

async function flushSave(page: Page): Promise<void> {
  await page.keyboard.press("Control+s");
  await expect(page.locator(".save-indicator")).toContainText("Guardado", { timeout: 30_000 });
}

function previewAttribute(page: Page, attribute: string): () => Promise<string | null> {
  return () =>
    page
      .frameLocator('iframe[title="Vista previa desktop"]')
      .locator("html")
      .getAttribute(attribute);
}

/** Flujo real de compra en el sitio exportado: carrito + checkout → URL wa.me. */
async function prepareWhatsAppOrder(page: Page, baseUrl: string): Promise<string> {
  await page.goto(`${baseUrl}${PRODUCT_PATH}`);
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  const drawer = page.locator("[data-cart-drawer]");
  await expect(drawer).toHaveAttribute("aria-hidden", "false");
  await drawer.getByLabel("Nombre").fill("Malena Ortiz");
  await drawer.getByLabel(/Telefono|Tel/).fill("11 5555 0142");
  await drawer.getByLabel(/Direccion|Direcci/).fill("Av. Forest 842, CABA");
  await drawer.getByRole("button", { name: "Continuar por WhatsApp" }).click();

  const link = page.getByRole("link", { name: "Enviar pedido en WhatsApp" });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href).not.toBeNull();
  return href ?? "";
}

test("sentinel: el número placeholder se muestra vacío con error y badge Pendiente", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await createCleanStore(page, "Tienda R2 sentinel");
  await openResumenTab(page);

  const section = page.locator('[data-accordion-id="whatsapp"]');
  const phoneInput = page.getByLabel("Número internacional");

  await expect(phoneInput).toHaveValue("");
  await expect(section).toContainText("Pendiente");
  await expect(section.getByTestId("ui-field-error")).toContainText(
    "Falta completar el número de WhatsApp.",
  );
});

test("validación 8-15 dígitos: badge y error inline cambian con cada estado", async ({ page }) => {
  await resetIndexedDb(page);
  await createCleanStore(page, "Tienda R2 validación");
  await openResumenTab(page);

  const section = page.locator('[data-accordion-id="whatsapp"]');
  const phoneInput = page.getByLabel("Número internacional");

  await phoneInput.fill("123");
  await expect(section).toContainText("Revisar formato");
  await expect(section.getByTestId("ui-field-error")).toContainText(
    "Usá entre 8 y 15 dígitos con código de país y área.",
  );

  await phoneInput.fill(EDITED_PHONE);
  await expect(section).toContainText("Formato correcto");
  await expect(section.getByTestId("ui-field-error")).toHaveCount(0);
  await expect(phoneInput).toHaveValue(EDITED_PHONE);

  await phoneInput.fill("54911234567890123");
  await expect(section).toContainText("Revisar formato");

  await phoneInput.fill("12345678");
  await expect(section).toContainText("Formato correcto");
  await expect(section.getByTestId("ui-field-error")).toHaveCount(0);
  await expect(phoneInput).toHaveValue("12345678");
});

test("editar número, saludo y SKU: efecto real en preview y persistencia al recargar", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await openDemoStore(page);
  await openResumenTab(page);

  const section = page.locator('[data-accordion-id="whatsapp"]');
  const phoneInput = page.getByLabel("Número internacional");
  const greetingInput = page.getByLabel("Saludo del pedido");
  const skuToggle = page.getByRole("switch", { name: "Incluir SKU en el mensaje" });

  await expect(phoneInput).toHaveValue("5491123456789");
  await expect(section).toContainText("Formato correcto");
  await expect(greetingInput).toHaveValue("Hola Predeterminado, quiero hacer este pedido:");
  await expect(skuToggle).toHaveAttribute("aria-checked", "true");

  await phoneInput.fill(EDITED_PHONE);
  await greetingInput.fill(EDITED_GREETING);
  await skuToggle.click();
  await expect(skuToggle).toHaveAttribute("aria-checked", "false");

  // El preview usa el mismo renderer que la exportación: los tres valores
  // cambian los atributos data-whatsapp-* del <html> del iframe.
  await expect
    .poll(previewAttribute(page, "data-whatsapp"), { timeout: 15_000 })
    .toBe(EDITED_PHONE);
  await expect
    .poll(previewAttribute(page, "data-whatsapp-greeting"), { timeout: 15_000 })
    .toBe(EDITED_GREETING);
  await expect
    .poll(previewAttribute(page, "data-whatsapp-include-sku"), { timeout: 15_000 })
    .toBe("false");

  await flushSave(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await openDemoStore(page);
  await openResumenTab(page);

  await expect(page.getByLabel("Número internacional")).toHaveValue(EDITED_PHONE);
  await expect(page.getByLabel("Saludo del pedido")).toHaveValue(EDITED_GREETING);
  await expect(page.getByRole("switch", { name: "Incluir SKU en el mensaje" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
});

test("utilidad: el número y el saludo editados llegan al sitio exportado (diff ANTES/DESPUÉS)", async ({
  page,
}) => {
  const beforeHome = String(baselineExport.files.get("index.html"));
  const afterHome = String(editedExport.files.get("index.html"));

  expect(beforeHome).toContain('data-whatsapp="5491123456789"');
  expect(beforeHome).toContain(
    'data-whatsapp-greeting="Hola Tienda Referencia, quiero hacer este pedido:"',
  );
  expect(beforeHome).toContain('data-whatsapp-include-sku="true"');
  expect(afterHome).toContain(`data-whatsapp="${EDITED_PHONE}"`);
  expect(afterHome).toContain(`data-whatsapp-greeting="${EDITED_GREETING}"`);
  expect(afterHome).toContain('data-whatsapp-include-sku="false"');

  // JSON-LD del negocio: `telephone` prefiere el número de WhatsApp y cae al
  // de identidad (hallazgo R2-1, resuelto en Ola 3: exporter storeStructuredData).
  // ANTES ambos coinciden en la demo; DESPUÉS el JSON-LD adopta el número nuevo.
  const jsonLd = (html: string): unknown[] =>
    [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((match) => JSON.parse(match[1] ?? "{}"))
      .filter((entry): entry is Record<string, unknown> => typeof entry === "object");
  const beforeStore = jsonLd(beforeHome).find((entry) => entry["@type"] === "OnlineStore");
  const afterStore = jsonLd(afterHome).find((entry) => entry["@type"] === "OnlineStore");
  expect(beforeStore?.telephone).toBe("5491123456789");
  expect(afterStore?.telephone).toBe(EDITED_PHONE);

  // Fallback noscript del módulo de producto: saludo y número editados.
  const beforeProduct = String(
    baselineExport.files.get("productos/remera-esencial-de-algodon/index.html"),
  );
  const afterProduct = String(
    editedExport.files.get("productos/remera-esencial-de-algodon/index.html"),
  );
  const waLinks = (html: string): string[] =>
    [...html.matchAll(/href="(https:\/\/wa\.me\/[^"]+)"/g)].map((match) => match[1] ?? "");
  const beforeFallback = waLinks(beforeProduct).find((href) =>
    href.startsWith("https://wa.me/5491123456789?text="),
  );
  const afterFallback = waLinks(afterProduct).find((href) =>
    href.startsWith(`https://wa.me/${EDITED_PHONE}?text=`),
  );
  expect(beforeFallback).toBeDefined();
  expect(afterFallback).toBeDefined();
  expect(decodeURIComponent(afterFallback ?? "")).toContain(EDITED_GREETING);
  expect(decodeURIComponent(afterFallback ?? "")).toContain("Producto: Remera esencial de algodón");
  expect(decodeURIComponent(afterFallback ?? "")).not.toContain("[MS-001-NE-S]");

  // URL wa.me del checkout generada por el runtime con el número y el saludo nuevos.
  const href = await prepareWhatsAppOrder(page, editedUrl);
  expect(href).toContain(`https://wa.me/${EDITED_PHONE}?text=`);
  const message = decodeURIComponent(href);
  expect(message).toContain(EDITED_GREETING);
  expect(message).toContain(PRODUCT_LINE_NO_SKU);
  expect(message).not.toContain("[MS-001-NE-S]");
});

test("utilidad: includeSku cambia el mensaje del checkout (con SKU vs sin SKU)", async ({
  page,
}) => {
  const withSkuHref = await prepareWhatsAppOrder(page, baselineUrl);
  const withoutSkuHref = await prepareWhatsAppOrder(page, noSkuUrl);

  expect(withSkuHref).toContain("https://wa.me/5491123456789?text=");
  expect(withoutSkuHref).toContain("https://wa.me/5491123456789?text=");

  const withSkuMessage = decodeURIComponent(withSkuHref);
  const withoutSkuMessage = decodeURIComponent(withoutSkuHref);
  expect(withSkuMessage).toContain("Hola Tienda Referencia, quiero hacer este pedido:");
  expect(withSkuMessage).toContain(PRODUCT_LINE_WITH_SKU);
  expect(withoutSkuMessage).not.toContain("[MS-001-NE-S]");
  expect(withoutSkuMessage).toContain(PRODUCT_LINE_NO_SKU);

  // El resto del mensaje es idéntico: el toggle sólo quita el SKU.
  expect(withoutSkuMessage.replace(PRODUCT_LINE_NO_SKU, PRODUCT_LINE_WITH_SKU)).toBe(
    withSkuMessage,
  );
});
