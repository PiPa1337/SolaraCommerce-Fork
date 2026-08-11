/**
 * PR7 — Placeholders y textos de plantilla de la pestaña Preparar (plan
 * `2026-08-10-auditoria-preparar.md`, bin PR7, contrato de 4 capas:
 * funcional / auto-feedback / datos / utilidad).
 *
 * Catálogo de los textos de plantilla de la tienda LIMPIA creada en IDB
 * (template `catalog-modern` seed `clean`): qué campos nacen con texto
 * placeholder, qué estado les da el checklist ("Reemplazar texto de
 * plantilla"), si el aviso es accionable, y si esos textos llegan al
 * preview y al sitio exportado (y qué dice la auditoría de producción).
 *
 * - PR7-1: los campos del editor muestran los textos de plantilla tal como
 *   se publicarían (Resumen, SEO, Constructor y Recursos).
 * - PR7-2: matriz de estado del checklist sobre la tienda limpia: qué marca
 *   placeholder, qué marca missing y qué queda "Listo" siendo texto de
 *   plantilla (hallazgo: el CTA del hero "Abrir búsqueda").
 * - PR7-3: utilidad del aviso: Siguiente/Editar nombran el campo y aterrizan
 *   en la pestaña con el panel abierto; hallazgo: la navegación es de
 *   pestaña, no de sección (el hero no queda seleccionado al llegar).
 * - PR7-4: los textos de plantilla son contenido público del preview y del
 *   sitio exportado; la auditoría sólo bloquea las imágenes de plantilla
 *   (`template.placeholder`), nunca los textos.
 *
 * NO repite R7/R8 (auditoría de Resumen): ahí ya se cubrieron Siguiente/pane
 * (H8-B3), el gate copy alineado y el sentinel de teléfono como placeholder.
 */
import type { Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { auditReport, exportProject, renderPreviewHtml } from "@solara/exporter";
import { evaluateCatalogModernReadiness } from "@solara/project-schema/catalog-modern-guidance";
import { catalogModernCleanStore } from "@solara/project-schema/catalog-modern-template";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

/** Textos con los que nace la plantilla limpia (catalog-modern-template.ts). */
const TEMPLATE_TEXTS = {
  heroEyebrow: "Tu nueva colección",
  heroTitle: "Una tienda lista para contar tu historia.",
  heroBody: "Cargá tus productos, imágenes y textos para empezar a vender.",
  heroCta: "Abrir búsqueda",
  announcement: "Tu tienda online, lista para empezar.",
  newsletterTitle: "Hacé crecer tu catálogo",
  footerNote: "Una tienda clara para que tus productos encuentren a su gente.",
  identityDescription: "Una tienda online preparada para mostrar tus productos.",
  seoDescription: "Descubrí nuestra selección de productos y escribinos para coordinar tu pedido.",
  homeTitle: "Una tienda hecha para tu marca.",
  aboutTitle: "Conocé nuestra historia.",
  contactTitle: "Estamos para ayudarte.",
  assetName: "Imagen de plantilla",
  assetAlt: "Imagen de ejemplo para reemplazar",
  catalogLabel: "Categorías",
} as const;

test.setTimeout(process.env.CI ? 60_000 : 45_000);

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

async function setupCleanStore(page: Page, name: string): Promise<void> {
  await page.goto(studioUrl);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.addEventListener("success", () => resolve());
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("blocked", () => reject(new Error("La base quedó bloqueada.")));
      }),
  );
  await page.reload();
  await createCleanStore(page, name);
}

function editorPane(page: Page) {
  return page.locator("[data-studio-editor-pane]");
}

async function expectPaneOpen(page: Page): Promise<void> {
  await expect(editorPane(page)).toHaveAttribute("aria-hidden", "false");
  await expect(editorPane(page)).toHaveClass(/editor-pane--open/);
}

/** Dispara el handler aunque el panel esté colapsado (patrón H8-B3). */
async function dispatchGuidedClick(locator: Locator): Promise<void> {
  await locator.dispatchEvent("click");
}

function requirement(page: Page, id: string) {
  return page.locator(`[data-testid="ui-guided-requirement"][data-requirement-id="${id}"]`);
}

async function readProgress(page: Page): Promise<{ text: string; percent: number }> {
  await expect(page.locator(".guided-progress")).toBeVisible();
  return {
    text: await page.locator(".guided-progress__copy > strong").innerText(),
    percent: Number(await page.getByTestId("ui-guided-progress").getAttribute("aria-valuenow")),
  };
}

function previewFrame(page: Page) {
  return page.frameLocator('iframe[title="Vista previa desktop"]');
}

/** Campo "Título visible" de una página editorial del Resumen. */
function pageTitleField(page: Page, kind: "Home" | "Nosotros" | "Contacto"): Locator {
  return page.locator(".page-editor").filter({ hasText: kind }).getByLabel("Título visible");
}

test("PR7-1: los campos del editor muestran los textos de plantilla que hay que reemplazar", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda PR7 catálogo");

  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
  await expectPaneOpen(page);

  // Identidad: la marca es la única lista; la descripción nace con texto de
  // plantilla; email vacío (missing) y el teléfono sentinel se normaliza a
  // vacío en el campo (R7-F2).
  await expect(page.getByLabel("Nombre de la tienda")).toHaveValue("Tienda PR7 catálogo");
  await expect(page.getByLabel("Descripción", { exact: true })).toHaveValue(
    TEMPLATE_TEXTS.identityDescription,
  );
  await expect(page.getByLabel("Email")).toHaveValue("");
  await expect(page.getByLabel("Número internacional")).toHaveValue("");
  await expect(page.getByLabel("Nombre del catálogo")).toHaveValue(TEMPLATE_TEXTS.catalogLabel);

  // Páginas editoriales: las tres títulos son textos de plantilla.
  await expect(pageTitleField(page, "Home")).toHaveValue(TEMPLATE_TEXTS.homeTitle);
  await expect(pageTitleField(page, "Nosotros")).toHaveValue(TEMPLATE_TEXTS.aboutTitle);
  await expect(pageTitleField(page, "Contacto")).toHaveValue(TEMPLATE_TEXTS.contactTitle);

  await page.getByRole("tab", { name: "SEO", exact: true }).click();
  await expect(page.getByRole("heading", { name: "SEO y Google" })).toBeVisible();
  await expect(page.getByLabel("Título SEO", { exact: true })).toHaveValue("Tienda PR7 catálogo");
  await expect(page.getByLabel("Descripción SEO", { exact: true })).toHaveValue(
    TEMPLATE_TEXTS.seoDescription,
  );

  // Constructor: la primera sección (barra informativa) y el hero muestran
  // los textos de plantilla en los campos reales.
  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  await expect(page.getByLabel("Mensaje")).toHaveValue(TEMPLATE_TEXTS.announcement);

  await page
    .locator(".section-row .section-select")
    .filter({ hasText: "Hero de catálogo" })
    .click();
  await expect(page.getByLabel("Antetítulo")).toHaveValue(TEMPLATE_TEXTS.heroEyebrow);
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue(TEMPLATE_TEXTS.heroTitle);
  await expect(page.getByLabel("Descripción", { exact: true })).toHaveValue(
    TEMPLATE_TEXTS.heroBody,
  );
  await expect(page.getByLabel("Botón principal")).toHaveValue(TEMPLATE_TEXTS.heroCta);

  // Recursos: los 4 assets de plantilla repiten nombre y alt placeholder.
  await page.getByRole("tab", { name: "Recursos", exact: true }).click();
  await expect(page.getByLabel("Nombre")).toHaveCount(4);
  await expect(page.getByLabel("Texto alternativo")).toHaveCount(4);
  await expect(page.getByLabel("Nombre").first()).toHaveValue(TEMPLATE_TEXTS.assetName);
  await expect(page.getByLabel("Texto alternativo").first()).toHaveValue(TEMPLATE_TEXTS.assetAlt);
});

test("PR7-2: matriz del checklist: marca placeholder todo texto de plantilla salvo el CTA del hero (hallazgo)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda PR7 checklist");

  // Capa datos: el modelo de requisitos sobre la plantilla limpia (17 activos,
  // 4 listos). El sentinel de WhatsApp es "missing" en el modelo y la UI lo
  // reasigna a "placeholder" (GuidedOverview.tsx:69-75).
  const readiness = evaluateCatalogModernReadiness(catalogModernCleanStore);
  expect(readiness.requirements).toHaveLength(17);
  expect(readiness.ready).toBe(4);
  const modelStatus = new Map(readiness.requirements.map((item) => [item.id, item.status]));
  expect(modelStatus.get("home.hero.title")).toBe("placeholder");
  expect(modelStatus.get("identity.description")).toBe("placeholder");
  expect(modelStatus.get("seo.description")).toBe("placeholder");
  expect(modelStatus.get("identity.email")).toBe("missing");
  expect(modelStatus.get("identity.whatsapp")).toBe("missing");
  expect(modelStatus.get("home.hero.primary-cta")).toBe("ready");
  expect(modelStatus.get("navigation.catalog-label")).toBe("ready");

  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();

  const before = await readProgress(page);
  expect(before.text).toBe("4 de 17 requisitos listos");
  expect(before.percent).toBe(24);

  // Todos los textos de plantilla marcados "placeholder" en el checklist.
  const placeholderIds = [
    "identity.description",
    "identity.whatsapp",
    "home.hero.eyebrow",
    "home.hero.title",
    "home.hero.body",
    "about.title",
    "contact.title",
    "seo.description",
    "asset.asset-hero.alt",
    "asset.asset-manta.alt",
    "asset.asset-jarra.alt",
  ];
  for (const id of placeholderIds) {
    const item = requirement(page, id);
    await expect(item).toHaveAttribute("data-requirement-status", "placeholder");
    await expect(item).toContainText("Reemplazar texto de plantilla");
  }

  // El aviso nombra el campo y el ámbito: scope · estado.
  await expect(requirement(page, "identity.description")).toContainText(
    "Marca · Reemplazar texto de plantilla",
  );
  await expect(requirement(page, "home.hero.title")).toContainText(
    "Inicio · Reemplazar texto de plantilla",
  );
  await expect(requirement(page, "seo.description")).toContainText(
    "SEO · Reemplazar texto de plantilla",
  );
  await expect(requirement(page, "asset.asset-hero.alt")).toContainText(
    "Imágenes · Reemplazar texto de plantilla",
  );

  // El email vacío es "missing" (ausencia), no placeholder: el texto es otro.
  await expect(requirement(page, "identity.email")).toHaveAttribute(
    "data-requirement-status",
    "missing",
  );
  await expect(requirement(page, "identity.email")).toContainText("Marca · Falta completar");

  // La 4ta imagen de plantilla queda fuera de los 12 visibles ("+1 más").
  await expect(page.locator('[data-requirement-id^="asset."]')).toHaveCount(3);
  await expect(page.locator(".guided-checklist__more")).toHaveText("+1 más");

  // HALLAZGO: el CTA del hero ("Abrir búsqueda") es texto de plantilla pero
  // no figura en la lista de isPlaceholder: el checklist lo da por listo.
  await expect(page.getByTestId("ui-guided-next")).toContainText("Siguiente: Descripción de marca");
  await page.getByTestId("ui-guided-done").locator("summary").click();
  const cta = page.locator(
    '[data-testid="ui-guided-done"] [data-requirement-id="home.hero.primary-cta"]',
  );
  await expect(cta).toHaveAttribute("data-requirement-status", "ready");
  await expect(cta).toContainText("Inicio");
});

test("PR7-3: el aviso es accionable: Siguiente/Editar aterrizan en la pestaña del campo; el hero no queda seleccionado (hallazgo)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda PR7 aviso");

  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();

  // Siguiente: el primer pendiente es la Descripción de marca y el botón lo
  // nombra; aterriza en Resumen con el panel abierto y el campo visible.
  await expect(page.getByTestId("ui-guided-next")).toContainText("Siguiente: Descripción de marca");
  await dispatchGuidedClick(page.getByTestId("ui-guided-next"));
  await expectPaneOpen(page);
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
  await expect(page.getByLabel("Descripción", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Descripción", { exact: true })).toHaveValue(
    TEMPLATE_TEXTS.identityDescription,
  );

  // Editar de un requisito del hero: aterriza en Constructor con el panel
  // abierto, pero la sección seleccionada es la primera de la home (barra
  // informativa), NO el hero: la navegación es de pestaña, no de sección.
  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await page.getByRole("button", { name: "Editar Título principal" }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  await expectPaneOpen(page);
  await expect(
    page.locator('.section-row[data-selected="true"] .section-select strong'),
  ).toHaveText("Barra informativa moderna");

  // El usuario puede llegar al hero con un clic más en la lista de secciones.
  await page
    .locator(".section-row .section-select")
    .filter({ hasText: "Hero de catálogo" })
    .click();
  await expect(page.getByLabel("Antetítulo")).toHaveValue(TEMPLATE_TEXTS.heroEyebrow);

  // Editar de SEO: aterriza en la pestaña SEO con el campo exacto visible.
  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await page.getByRole("button", { name: "Editar Descripción SEO principal" }).click();
  await expect(page.getByRole("heading", { name: "SEO y Google" })).toBeVisible();
  await expect(page.getByLabel("Descripción SEO", { exact: true })).toHaveValue(
    TEMPLATE_TEXTS.seoDescription,
  );
});

test("PR7-4: los textos de plantilla son contenido público del preview y del sitio; la auditoría sólo bloquea imágenes", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda PR7 export");

  // Preview: la tienda limpia muestra los textos de plantilla como contenido
  // público del storefront (no hay marca visual de "placeholder").
  const frame = previewFrame(page);
  await expect(frame.locator('[data-solara-module="catalog-announcement"]')).toContainText(
    TEMPLATE_TEXTS.announcement,
    { timeout: 15_000 },
  );
  const hero = frame.locator('[data-solara-module="catalog-hero"]');
  await expect(hero).toContainText(TEMPLATE_TEXTS.heroEyebrow);
  await expect(hero.locator("h1")).toHaveText(TEMPLATE_TEXTS.heroTitle);
  await expect(hero).toContainText(TEMPLATE_TEXTS.heroBody);
  await expect(hero.locator(".catalog-primary-action")).toHaveText(TEMPLATE_TEXTS.heroCta);
  await expect(frame.locator('[data-solara-module="catalog-newsletter-cta"]')).toContainText(
    TEMPLATE_TEXTS.newsletterTitle,
  );
  await expect(frame.locator('[data-solara-module="catalog-footer"]')).toContainText(
    TEMPLATE_TEXTS.footerNote,
  );

  // Capa datos: el mismo renderer viaja al HTML del preview y del sitio. La
  // tienda limpia NO puede exportarse en production (el exporter bloquea con
  // los críticos de plantilla), así que el sitio público se verifica en draft
  // (mismo render; cambia sólo el noindex); el rótulo "Reemplazar texto de
  // plantilla" es sólo del Studio y nunca se publica como contenido.
  const clean = catalogModernCleanStore;
  const previewHtml = renderPreviewHtml(clean as never, "draft", "/");
  expect(previewHtml).toContain(TEMPLATE_TEXTS.heroTitle);
  expect(previewHtml).toContain(TEMPLATE_TEXTS.announcement);
  expect(previewHtml).not.toContain("Reemplazar texto de plantilla");

  const exported = exportProject(clean as never, { mode: "draft" });
  const home = String(exported.files.get("index.html"));
  expect(home).toContain(TEMPLATE_TEXTS.heroTitle);
  expect(home).toContain(TEMPLATE_TEXTS.announcement);
  expect(home).toContain(TEMPLATE_TEXTS.heroCta);
  expect(home).toContain(TEMPLATE_TEXTS.newsletterTitle);
  expect(home).toContain(TEMPLATE_TEXTS.footerNote);
  expect(home).not.toContain("Reemplazar texto de plantilla");
  expect(String(exported.files.get("nosotros/index.html"))).toContain(TEMPLATE_TEXTS.aboutTitle);
  expect(String(exported.files.get("contacto/index.html"))).toContain(TEMPLATE_TEXTS.contactTitle);

  // Auditoría: la tienda limpia tiene críticos reales (template.placeholder
  // de las imágenes de plantilla), no por los textos.
  const audit = auditReport(clean as never);
  expect(audit.criticalCount).toBeGreaterThan(0);
  expect(audit.issues.some((issue) => issue.code === "template.placeholder")).toBe(true);

  // HALLAZGO: reemplazando sólo las imágenes, la auditoría da 0 críticos y el
  // sitio de producción sigue publicando los textos de plantilla del hero.
  const withRealAssets = structuredClone(clean);
  withRealAssets.assets = withRealAssets.assets.map((asset, index) => ({
    ...asset,
    name: `tejido-estacion-${index}.png`,
    alt: "Tejido textil en tonos tierra",
  }));
  expect(auditReport(withRealAssets as never).criticalCount).toBe(0);
  const exportedAfter = exportProject(withRealAssets as never, { mode: "production" });
  expect(String(exportedAfter.files.get("index.html"))).toContain(TEMPLATE_TEXTS.heroTitle);
});
