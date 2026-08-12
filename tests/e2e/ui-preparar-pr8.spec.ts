/**
 * Auditoría Preparar PR8 (2026-08-11) — UTILIDAD del tab: journey end-to-end.
 * Plan: docs/superpowers/plans/2026-08-10-auditoria-preparar.md (PR8: tienda
 * limpia → completar Preparar paso a paso → export producción VIABLE (0
 * críticos) → sitio completo; qué falta para producción que el flujo no cubre
 * o promete).
 *
 * Contrato de 4 capas del journey:
 * - funcional: desde una tienda LIMPIA, cada requisito pendiente ofrece su
 *   destino (Editar → tab) y completarlo lo marca ready; el progreso avanza
 *   hasta el máximo alcanzable por la UI; el export de producción se ejecuta
 *   y termina "Exportación correcta";
 * - auto-feedback: el gate de la guía usa el crítico REAL del exporter: al
 *   final "La tienda puede pasar a revisión de publicación."; el checklist
 *   conserva los pendientes que el flujo no puede completar;
 * - datos: el proyecto final guardado en IndexedDB por el journey es
 *   schema-válido, con 0 críticos de `auditReport` y exporta un sitio
 *   production completo;
 * - utilidad: el sitio exportado del proyecto REAL tiene header con
 *   navegación de categorías, producto publicable, páginas editoriales,
 *   sitemap y checkout WhatsApp funcional (wa.me con el teléfono real).
 *
 * Hallazgos de utilidad convertidos en regresiones:
 * - `category.{id}.description` ya no se presenta como requisito inalcanzable;
 * - un producto agregado a mano puede quedar sin categoría como contenido
 *   recomendado, y el checklist expandible permite localizar ese requisito.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { auditReport, exportProject } from "@solara/exporter";
import { StoreProjectV1Schema } from "@solara/project-schema";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 300_000 : 180_000);

const STORE_NAME = "Tienda PR8";
const WHATSAPP_PHONE = "5491123456789";

const EDITED_TEXT = {
  name: "Tienda PR8",
  description: "Tazas y vasos de cerámica artesanal esmaltada a mano.",
  email: "hola@tienda-pr8.example",
  greeting: "Hola, quiero hacer este pedido:",
  baseUrl: "https://tienda-pr8.example",
  aboutTitle: "Nuestra historia en cerámica.",
  contactTitle: "Escribinos por WhatsApp.",
  seoDescription: "Catálogo de cerámica artesanal hecha a mano, pieza por pieza.",
  heroEyebrow: "Cerámica artesanal",
  heroTitle: "Piezas hechas a mano para tu mesa.",
  heroBody: "Cada pieza sale del horno con su propia historia.",
  assetName: "foto-pr8-ceramica",
  assetAlt: "Fotografía de cerámica artesanal esmaltada",
} as const;

const CSV_HEADER = [
  "producto_id",
  "variante_id",
  "slug",
  "titulo",
  "descripcion",
  "marca",
  "estado",
  "categorias",
  "colecciones",
  "etiquetas",
  "imagenes",
  "variante",
  "sku",
  "opciones",
  "precio_centavos",
  "precio_anterior_centavos",
  "disponible",
  "estado_stock",
  "gtin",
  "mpn",
  "imagen_variante",
  "creado_en",
  "actualizado_en",
].join(",");

const CSV_ROW =
  ",,taza-pr8,Taza PR8,Taza de cerámica esmaltada a mano.,PR8 Cerámica,active,Cerámica>Vasos,,," +
  "imagenes/taza-pr8.png,Única,TAZA-PR8-01,,125000,,, ,,,imagenes/taza-pr8.png,,";

let server: Server;
let studioUrl: string;

test.beforeAll(async () => {
  const running = await startStudioServer();
  server = running.server;
  studioUrl = running.url;
});

test.afterAll(async () => {
  await stopStudioServer(server);
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

async function openPrepararTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();
  await expect(page.getByTestId("ui-guided-progress")).toBeVisible();
}

/** Requisitos pendientes visibles (lista directa del checklist). */
function pendingRequirements(page: Page) {
  return page.locator('section.guided-checklist > ul > [data-testid="ui-guided-requirement"]');
}

function requirement(page: Page, id: string) {
  return page.locator(`[data-testid="ui-guided-requirement"][data-requirement-id="${id}"]`);
}

/** Espera a que el autosave (550 ms) persista el valor esperado en IndexedDB
 *  (válido en cualquier pestaña: el indicador de guardado es del Resumen). */
async function pollStoredProject(page: Page, path: string, expected: unknown): Promise<void> {
  const readStoredValue = ([name, projectPath]: [string, string]) =>
    new Promise<unknown>((resolve, reject) => {
      const request = indexedDB.open("solara-commerce-studio");
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () => {
        const all = request.result.transaction("projects").objectStore("projects").getAll();
        all.addEventListener("success", () => {
          const records = all.result as Array<{ name: string; project: unknown }>;
          const record = records.find((item) => item.name === name);
          let current: unknown = record?.project;
          for (const part of projectPath.split(".")) {
            if (Array.isArray(current)) {
              if (part === "length") {
                current = (current as unknown[]).length;
                continue;
              }
              if (/^\d+$/.test(part)) {
                current = (current as unknown[])[Number(part)];
                continue;
              }
              current = (current as Array<Record<string, unknown>>).find(
                (item) => item.id === part || item.kind === part,
              );
              continue;
            }
            if (typeof current !== "object" || current === null) {
              current = undefined;
              break;
            }
            current = (current as Record<string, unknown>)[part];
          }
          resolve(current);
        });
        all.addEventListener("error", () => reject(all.error));
      });
    });
  await expect
    .poll(() => page.evaluate(readStoredValue, [STORE_NAME, path] as const), {
      timeout: 15_000,
    })
    .toBe(expected);
}

/** Importa la carpeta comercial (CSV + imagen) que crea categorías y producto. */
async function importCatalogFolder(page: Page): Promise<void> {
  const packageDirectory = mkdtempSync(join(tmpdir(), "solara-pr8-catalog-"));
  try {
    mkdirSync(join(packageDirectory, "imagenes"), { recursive: true });
    writeFileSync(join(packageDirectory, "productos.csv"), `${CSV_HEADER}\r\n${CSV_ROW}`, "utf8");
    writeFileSync(
      join(packageDirectory, "imagenes", "taza-pr8.png"),
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    await page.locator('input[type="file"][webkitdirectory]').setInputFiles(packageDirectory);
    await expect(page.getByRole("heading", { name: /^solara-pr8-catalog-/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Agregar y actualizar" }).click();
    await expect(page.getByText(/1 productos y 1 variantes/)).toBeVisible({ timeout: 20_000 });
    await expect(
      page
        .getByRole("list", { name: "Categorías ordenadas" })
        .getByText("Cerámica", { exact: true }),
    ).toBeVisible();
  } finally {
    rmSync(packageDirectory, { recursive: true, force: true });
  }
}

/** Lee el proyecto REAL completo que el journey guardó en IndexedDB. */
async function readStoredProject(page: Page): Promise<unknown> {
  await expect
    .poll(
      async () =>
        page.evaluate(
          (name) =>
            new Promise<boolean>((resolve, reject) => {
              const request = indexedDB.open("solara-commerce-studio");
              request.addEventListener("error", () => reject(request.error));
              request.addEventListener("success", () => {
                const all = request.result.transaction("projects").objectStore("projects").getAll();
                all.addEventListener("success", () => {
                  const records = all.result as Array<{ name: string; project: unknown }>;
                  const record = records.find((item) => item.name === name);
                  if (!record) {
                    resolve(false);
                    return;
                  }
                  const project = record.project as { products: unknown[] };
                  resolve(Array.isArray(project.products) && project.products.length === 1);
                });
                all.addEventListener("error", () => reject(all.error));
              });
            }),
          STORE_NAME,
        ),
      { timeout: 20_000 },
    )
    .toBe(true);
  return page.evaluate(
    (name) =>
      new Promise<unknown>((resolve, reject) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const all = request.result.transaction("projects").objectStore("projects").getAll();
          all.addEventListener("success", () => {
            const records = all.result as Array<{ name: string; project: unknown }>;
            const record = records.find((item) => item.name === name);
            if (!record) {
              reject(new Error(`No se encontró la tienda ${name} en IndexedDB.`));
              return;
            }
            resolve(record.project);
          });
          all.addEventListener("error", () => reject(all.error));
        });
      }),
    STORE_NAME,
  );
}

function exportedTexts(files: ReadonlyMap<string, string | Uint8Array>): Map<string, string> {
  return new Map(
    [...files.entries()].map(([path, content]) => [
      path,
      typeof content === "string" ? content : new TextDecoder().decode(content),
    ]),
  );
}

test("journey: tienda limpia → completar Preparar por destinos → exportar producción viable (0 críticos + sitio completo)", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await createCleanStore(page, STORE_NAME);
  await openPrepararTab(page);

  // (1) Estado inicial honesto de la tienda limpia: 5 de 18 requisitos listos,
  // el único bloqueo real es template.placeholder (crítico del exporter).
  await expect(page.locator(".guided-progress__copy strong")).toHaveText(
    "5 de 18 requisitos listos",
  );
  await expect(page.getByTestId("ui-guided-progress")).toHaveAttribute("aria-valuenow", "28");
  await expect(page.locator(".guided-progress__copy > span")).toHaveText(
    "1 pendiente bloquea producción.",
    { timeout: 20_000 },
  );
  await expect(pendingRequirements(page)).toHaveCount(12);
  await expect(page.locator(".guided-checklist__more")).toHaveText("+1 más");
  const firstPending = pendingRequirements(page).first();
  await expect(firstPending).toHaveAttribute("data-requirement-id", "identity.description");
  await expect(firstPending).toHaveAttribute("data-requirement-status", "placeholder");
  await expect(page.getByTestId("ui-guided-next")).toContainText("Siguiente: Descripción de marca");

  // (2) Destinos: cada requisito pendiente ofrece "Editar" y aterriza en la
  // pestaña que completa su scope (PR4 lo cubre exhaustivo; aquí el journey
  // los usa para completar el contenido).
  await page.getByTestId("ui-guided-next").click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
  await openPrepararTab(page);
  const heroEdit = requirement(page, "home.hero.eyebrow").getByRole("button", { name: /^Editar / });
  await heroEdit.click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  await openPrepararTab(page);
  await requirement(page, "seo.description")
    .getByRole("button", { name: /^Editar / })
    .click();
  await expect(page.getByRole("heading", { name: "SEO y Google", exact: true })).toBeVisible();
  await openPrepararTab(page);
  await requirement(page, "asset.asset-hero.alt")
    .getByRole("button", { name: /^Editar / })
    .click();
  await expect(page.getByRole("heading", { name: "Recursos", exact: true })).toBeVisible();

  // (3) Resumen: identidad, WhatsApp, dominio y páginas editoriales.
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
  await page.getByLabel("Nombre de la tienda").fill(EDITED_TEXT.name);
  await page.getByLabel("Descripción", { exact: true }).fill(EDITED_TEXT.description);
  await page.getByLabel("Email", { exact: true }).fill(EDITED_TEXT.email);
  await page.getByLabel("Número internacional").fill(WHATSAPP_PHONE);
  await page.getByLabel("Saludo del pedido").fill(EDITED_TEXT.greeting);
  await page.getByLabel("URL pública").fill(EDITED_TEXT.baseUrl);
  await page.getByLabel("Título visible").nth(1).fill(EDITED_TEXT.aboutTitle);
  await page.getByLabel("Título visible").nth(2).fill(EDITED_TEXT.contactTitle);
  await pollStoredProject(page, "identity.description", EDITED_TEXT.description);
  await pollStoredProject(page, "whatsapp.phone", WHATSAPP_PHONE);

  // (4) SEO global: la descripción de plantilla se reemplaza.
  await page.getByRole("tab", { name: "SEO", exact: true }).click();
  await expect(page.getByRole("heading", { name: "SEO y Google", exact: true })).toBeVisible();
  await page.getByLabel("Descripción SEO", { exact: true }).fill(EDITED_TEXT.seoDescription);
  await pollStoredProject(page, "seo.description", EDITED_TEXT.seoDescription);

  // (5) Constructor: el hero de plantilla (destino del scope home).
  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  await page
    .locator(".section-stack")
    .getByRole("button", { name: /Portada/ })
    .click();
  await page.getByLabel("Antetítulo").fill(EDITED_TEXT.heroEyebrow);
  await page.getByLabel("Título", { exact: true }).fill(EDITED_TEXT.heroTitle);
  await page.getByLabel("Descripción", { exact: true }).fill(EDITED_TEXT.heroBody);
  await pollStoredProject(page, "sections.modo-section-hero.settings.title", EDITED_TEXT.heroTitle);

  // (6) Recursos: las 4 imágenes de plantilla se renombran y reciben alt.
  await page.getByRole("tab", { name: "Recursos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recursos", exact: true })).toBeVisible();
  const templateAssets = await page.getByLabel("Texto alternativo").count();
  expect(templateAssets).toBe(4);
  for (let index = 0; index < templateAssets; index += 1) {
    await page.getByLabel("Nombre").nth(index).fill(`${EDITED_TEXT.assetName}-${index}.png`);
    await page.getByLabel("Nombre").nth(index).blur();
    await page.getByLabel("Texto alternativo").nth(index).fill(EDITED_TEXT.assetAlt);
    await page.getByLabel("Texto alternativo").nth(index).blur();
  }
  await pollStoredProject(page, "assets.3.alt", EDITED_TEXT.assetAlt);

  // (7) Catálogo: la importación de carpeta crea categorías y el producto
  // (el único camino de la UI para crear categorías).
  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catálogo", exact: true })).toBeVisible();
  await importCatalogFolder(page);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await pollStoredProject(page, "products.length", 1);

  // (8) Recursos: la imagen importada recibe su texto alternativo.
  await page.getByRole("tab", { name: "Recursos", exact: true }).click();
  await expect(page.getByLabel("Texto alternativo")).toHaveCount(5);
  await page.getByLabel("Texto alternativo").nth(4).fill("Taza de cerámica esmaltada a mano.");
  await page.getByLabel("Texto alternativo").nth(4).blur();
  await pollStoredProject(page, "assets.4.alt", "Taza de cerámica esmaltada a mano.");

  // (9) Preparar al final del journey: todos los requisitos cubiertos por el
  // modelo guiado quedan listos y el gate real ya no bloquea producción. Las
  // descripciones de categoría no forman parte del checklist porque el Studio
  // no tiene editor para ese campo. 28 listos, 0 pendientes.
  await openPrepararTab(page);
  await expect(page.locator(".guided-progress__copy strong")).toHaveText(
    "28 de 28 requisitos listos",
  );
  await expect(page.getByTestId("ui-guided-progress")).toHaveAttribute("aria-valuenow", "100");
  await expect(page.locator(".guided-progress__copy > span")).toHaveText(
    "La tienda puede pasar a revisión de publicación.",
    { timeout: 20_000 },
  );
  await expect(pendingRequirements(page)).toHaveCount(0);
  await page.getByTestId("ui-guided-done").locator("summary").click();
  await expect(page.getByTestId("ui-guided-done").locator("summary")).toHaveText(
    "Requisitos listos (28)",
  );
  await expect(requirement(page, "identity.description")).toHaveAttribute(
    "data-requirement-status",
    "ready",
  );
  await expect(requirement(page, "identity.whatsapp")).toHaveAttribute(
    "data-requirement-status",
    "ready",
  );
  await expect(requirement(page, "product.product-taza-pr8.title")).toHaveAttribute(
    "data-requirement-status",
    "ready",
  );
  await expect(requirement(page, "product.product-taza-pr8.category")).toHaveAttribute(
    "data-requirement-status",
    "ready",
  );
  await expect(requirement(page, "product.product-taza-pr8.image")).toHaveAttribute(
    "data-requirement-status",
    "ready",
  );
  // Los 5 assets (4 de plantilla + el importado) quedan con alt listo.
  await expect(
    page.locator('[data-testid="ui-guided-done"] [data-requirement-id^="asset."]'),
  ).toHaveCount(5);

  // (10) Export: el gate real muestra 0 críticos y la producción se genera.
  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Exportar", exact: true })).toBeVisible();
  await expect(page.locator("output.optimization-export-summary")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("output.optimization-export-summary")).toContainText("0 críticos");
  await expect(page.locator(".export-warning")).toHaveCount(0);
  await expect(page.getByTestId("ui-export-production")).toBeEnabled({ timeout: 20_000 });
  await page.getByTestId("ui-export-production").click();
  const confirm = page.getByTestId("ui-confirm-dialog");
  await expect(confirm).toBeVisible();
  await confirm.getByTestId("ui-confirm-accept").click();
  await expect(page.getByTestId("ui-export-result")).toContainText("Exportación correcta", {
    timeout: 60_000,
  });

  // (11) Utilidad: el proyecto REAL del journey es schema-válido, tiene 0
  // críticos y exporta un sitio production completo y reproducible.
  const stored = await readStoredProject(page);
  const project = StoreProjectV1Schema.parse(stored);
  expect(project.identity.brandName).toBe(EDITED_TEXT.name);
  expect(project.whatsapp.phone).toBe(WHATSAPP_PHONE);
  expect(project.products).toHaveLength(1);
  expect(project.products[0]?.title).toBe("Taza PR8");
  expect(project.categories.length).toBe(2);
  expect(auditReport(project).criticalCount).toBe(0);

  const exported = exportProject(project, { mode: "production" });
  const files = exportedTexts(exported.files);
  const home = files.get("index.html") ?? "";
  const productPage = files.get("productos/taza-pr8/index.html") ?? "";
  const contactPage = files.get("contacto/index.html") ?? "";
  const checkoutPage = files.get("compra/index.html") ?? "";
  const sitemap = files.get("sitemap.xml") ?? "";

  // Header con navegación real (categorías) y hero reemplazado.
  expect(home).toContain("Tienda PR8");
  expect(home).toContain('href="/categorias/ceramica/"');
  expect(home).toContain(EDITED_TEXT.heroTitle);
  expect(home).toContain('data-whatsapp="5491123456789"');

  // Producto real con su ruta, categoría y página publicable.
  expect(files.has("productos/taza-pr8/index.html")).toBe(true);
  expect(productPage).toContain("Taza PR8");
  expect(productPage).toContain("Taza de cerámica esmaltada a mano.");
  expect(files.has("categorias/ceramica/index.html")).toBe(true);
  expect(files.get("categorias/ceramica/index.html") ?? "").toContain("Cerámica");
  expect(files.has("categorias/vasos/index.html")).toBe(true);

  // Checkout WhatsApp funcional: contacto con wa.me real, compra con el
  // formulario que el runtime completa y el teléfono en el documento.
  expect(contactPage).toContain(`https://wa.me/5491123456789?text=`);
  expect(checkoutPage).toContain("data-checkout-form");
  expect(checkoutPage).toContain("data-whatsapp-link");

  // Sitemap con las rutas públicas del sitio.
  expect(sitemap).toContain("https://tienda-pr8.example/productos/taza-pr8/");
  expect(sitemap).toContain("https://tienda-pr8.example/categorias/ceramica/");
  expect(sitemap).toContain("https://tienda-pr8.example/contacto/");
});

test("contenido recomendado: un producto agregado a mano puede quedar sin categoría sin bloquear producción", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await createCleanStore(page, STORE_NAME);
  await openPrepararTab(page);
  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await page.getByRole("button", { name: "Agregar producto" }).first().click();
  const dialog = page.locator("dialog.product-dialog");
  await dialog.getByRole("textbox", { name: "Título" }).fill("Taza PR8 manual");
  await dialog.getByLabel("Estado").selectOption("active");
  await dialog.getByRole("textbox", { name: "Descripción" }).fill("Taza artesanal de prueba.");
  await dialog.getByRole("button", { name: "Imágenes", exact: true }).click();
  await dialog.locator(".product-asset-option").first().click();
  await dialog.getByRole("spinbutton", { name: "Precio en centavos" }).fill("1000");
  await dialog.getByRole("button", { name: "Crear producto" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await openPrepararTab(page);
  const showAll = page.getByTestId("ui-guided-show-all");
  await expect(showAll).toHaveAttribute("aria-expanded", "false");
  await showAll.click();
  await expect(showAll).toHaveAttribute("aria-expanded", "true");
  const categoryRequirement = page
    .getByTestId("ui-guided-requirement")
    .filter({ hasText: "Categoría: Taza PR8 manual" });
  await expect(categoryRequirement).toHaveAttribute("data-requirement-status", "missing");
});
