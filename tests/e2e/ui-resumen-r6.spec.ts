/**
 * Auditoría Resumen R6 (2026-08-10) — Páginas editoriales del tab Resumen.
 * Contrato de 4 capas (plan docs/superpowers/plans/2026-08-10-auditoria-resumen.md):
 * - funcional: por página (Home/Nosotros/Contacto) hay tres controles — Título
 *   visible, Título SEO y Descripción SEO — que commitean en vivo al proyecto;
 * - datos: cada campo persiste en la página correcta del proyecto autoservado
 *   (IndexedDB, patrón ui-resumen-r1) y sobrevive a la recarga, sin contaminar
 *   las otras dos páginas (ni en la UI ni en el proyecto guardado);
 * - utilidad: exportProject() ANTES y DESPUÉS (patrón exported-store.spec.ts)
 *   y el cambio debe aparecer en la ruta exportada correspondiente de la demo:
 *   "/" -> index.html, "/nosotros/" -> nosotros/index.html, "/contacto/" ->
 *   contacto/index.html, en <title>, meta description, h1 y JSON-LD;
 * - renderer compartido: el preview (renderPreviewHtml) refleja los cambios en
 *   el iframe para la misma ruta.
 * - hallazgos: se documenta con evidencia qué controles NO llegan al sitio
 *   exportado (Home "Título visible" no tiene consumidor en la Home).
 * Las secciones de cada página no se editan en este tab (viven en el
 * Constructor); se auditan en la capa de datos/exportación: una sección
 * declarada en pages[].sections sólo debe renderizar en su propia ruta.
 */
import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { exportProject, renderPreviewHtml } from "@solara/exporter";
import type { StoreProjectV1, StoreSection } from "@solara/project-schema";
import { StoreProjectV1Schema } from "@solara/project-schema";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 180_000 : 120_000);

/** Valores sentinel R6: no existen en la tienda demo (Modo Sur). */
const VALUES = {
  home: {
    title: "R6 Home: título visible auditado 3107",
    seoTitle: "R6 Home SEO auditada 3107",
    seoDescription: "R6 descripción SEO de la home auditada con evidencia de exportación 3107.",
  },
  about: {
    title: "R6 Nosotros: título visible auditado 3107",
    seoTitle: "R6 Nosotros SEO auditado 3107",
    seoDescription: "R6 descripción SEO de Nosotros auditada con evidencia de exportación 3107.",
  },
  contact: {
    title: "R6 Contacto: título visible auditado 3107",
    seoTitle: "R6 Contacto SEO auditado 3107",
    seoDescription: "R6 descripción SEO de Contacto auditada con evidencia de exportación 3107.",
  },
} as const;

/** La tienda demo de la app (card "Predeterminado", id persistido store-modo-sur-demo). */
const STORE_ID = "store-modo-sur-demo";

const SECTION_ABOUT_TITLE = "R6 sección única de Nosotros 3107";
const SECTION_ABOUT_BODY = "R6 cuerpo de sección de Nosotros 3107";
const SECTION_CONTACT_TITLE = "R6 sección única de Contacto 3107";
const SECTION_CONTACT_BODY = "R6 cuerpo de sección de Contacto 3107";

type PageKind = "home" | "about" | "contact";
type PageLabel = "Home" | "Nosotros" | "Contacto";

interface PageValues {
  title: string;
  seoTitle: string;
  seoDescription: string;
}

interface StoredProjectRecord {
  id: string;
  name: string;
  project: StoreProjectV1;
}

interface ExportedSite {
  files: ReadonlyMap<string, string | Uint8Array>;
}

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
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 20_000,
  });
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
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
}

async function expectSaved(page: Page): Promise<void> {
  await expect(page.getByTestId("ui-save-indicator")).toContainText("Cambios guardados", {
    timeout: 5_000,
  });
}

/** Guardado del modo navegador: flush del autosave con Ctrl+S y aviso "Guardado". */
async function flushSave(page: Page): Promise<void> {
  await page.keyboard.press("Control+s");
  await expect(page.locator(".save-indicator")).toContainText("Guardado", { timeout: 30_000 });
}

async function expandPagesSection(page: Page): Promise<void> {
  const toggle = page.locator('[data-accordion-id="pages"] .overview-accordion__toggle');
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
}

/** El editor de una página (Home/Nosotros/Contacto) dentro de la sección. */
function pageEditor(page: Page, label: PageLabel) {
  return page
    .locator(".page-editor")
    .filter({ has: page.locator("strong", { hasText: label, exact: true }) });
}

function pageFields(page: Page, label: PageLabel) {
  const editor = pageEditor(page, label);
  return {
    title: editor.getByLabel("Título visible", { exact: true }),
    seoTitle: editor.getByLabel("Título SEO", { exact: true }),
    seoDescription: editor.getByLabel("Descripción SEO", { exact: true }),
  };
}

async function readPageValues(page: Page, label: PageLabel): Promise<PageValues> {
  const fields = pageFields(page, label);
  return {
    title: await fields.title.inputValue(),
    seoTitle: await fields.seoTitle.inputValue(),
    seoDescription: await fields.seoDescription.inputValue(),
  };
}

async function editPageFields(page: Page, label: PageLabel, values: PageValues): Promise<void> {
  const fields = pageFields(page, label);
  await fields.title.fill(values.title);
  await fields.seoTitle.fill(values.seoTitle);
  await fields.seoDescription.fill(values.seoDescription);
  await expectSaved(page);
}

/** El proyecto autoservado en IndexedDB, receptor del payload commiteado. */
async function readStoredProject(page: Page, projectId: string): Promise<StoreProjectV1 | null> {
  const record = await page.evaluate(
    ([targetId]) =>
      new Promise<StoredProjectRecord | null>((resolve, reject) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const db = request.result;
          const all = db.transaction("projects").objectStore("projects").getAll();
          all.addEventListener("error", () => reject(all.error));
          all.addEventListener("success", () => {
            const records = all.result as StoredProjectRecord[];
            resolve(records.find((record) => record.id === targetId) ?? null);
          });
        });
      }),
    [projectId],
  );
  return record?.project ?? null;
}

function projectPage(
  project: StoreProjectV1 | null,
  kind: PageKind,
): StoreProjectV1["pages"][number] {
  const page = project?.pages.find((candidate) => candidate.kind === kind);
  if (!page) throw new Error(`Falta la página ${kind} en el proyecto guardado.`);
  return page;
}

/** Exporta el sitio del proyecto que el Studio guardó en IndexedDB. */
async function exportStoredSite(page: Page): Promise<ExportedSite> {
  const project = await readStoredProject(page, STORE_ID);
  expect(project).not.toBeNull();
  return exportProject(project as StoreProjectV1, { mode: "production" });
}

async function expectPersistedPage(
  page: Page,
  kind: PageKind,
  patch: Partial<StoreProjectV1["pages"][number]>,
): Promise<void> {
  await expect
    .poll(async () => projectPage(await readStoredProject(page, STORE_ID), kind), {
      timeout: 15_000,
    })
    .toMatchObject(patch);
}

function fileText(exported: ExportedSite, path: string): string {
  const content = exported.files.get(path);
  if (content === undefined) throw new Error(`El sitio exportado no contiene ${path}`);
  return typeof content === "string" ? content : new TextDecoder().decode(content);
}

function metaDescription(html: string): string {
  const match = /<meta name="description" content="([^"]*)"/.exec(html);
  return match?.[1] ?? "";
}

function previewFrame(page: Page) {
  return page.frameLocator('iframe[title="Vista previa desktop"]');
}

/** Título del documento del preview (mismo renderer que el sitio exportado). */
async function expectPreviewTitle(page: Page, expected: string): Promise<void> {
  await expect
    .poll(() => previewFrame(page).locator("html").evaluate((element) => document.title), {
      timeout: 15_000,
    })
    .toBe(expected);
}

test("Home: título SEO y descripción SEO llegan a index.html; el título visible no (hallazgo)", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await openDemoStore(page);
  await openResumenTab(page);
  await expandPagesSection(page);

  // ANTES: valores originales y sitio exportado de línea de base.
  const original = await readPageValues(page, "Home");
  const originalAbout = await readPageValues(page, "Nosotros");
  const originalContact = await readPageValues(page, "Contacto");
  const before = await exportStoredSite(page);
  const beforeHome = fileText(before, "index.html");
  expect(beforeHome).toContain(`<title>${original.seoTitle}</title>`);
  for (const value of Object.values(VALUES.home)) {
    expect(beforeHome).not.toContain(value);
  }

  // Edición real de los 3 campos de la Home.
  await editPageFields(page, "Home", VALUES.home);

  // No contamina las otras páginas en la UI.
  expect(await readPageValues(page, "Nosotros")).toEqual(originalAbout);
  expect(await readPageValues(page, "Contacto")).toEqual(originalContact);

  // Datos: persiste en pages[home] del proyecto autoservado.
  await expectPersistedPage(page, "home", VALUES.home);

  // Persistencia tras recarga.
  await flushSave(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await openDemoStore(page);
  await openResumenTab(page);
  await expandPagesSection(page);
  expect(await readPageValues(page, "Home")).toEqual(VALUES.home);
  expect(await readPageValues(page, "Nosotros")).toEqual(originalAbout);

  // Utilidad: export DESPUÉS — la Home refleja título SEO y descripción SEO.
  const after = await exportStoredSite(page);
  const homeHtml = fileText(after, "index.html");
  expect(homeHtml).toContain(`<title>${VALUES.home.seoTitle}</title>`);
  expect(homeHtml).toContain(`content="${VALUES.home.seoTitle}"`);
  expect(metaDescription(homeHtml)).toBe(VALUES.home.seoDescription);
  expect(homeHtml).toContain(`content="${VALUES.home.seoDescription}"`);

  // Renderer compartido: el título del documento en el preview es el nuevo.
  await expectPreviewTitle(page, VALUES.home.seoTitle);

  // Hallazgo: el "Título visible" de la Home no tiene consumidor en la página
  // exportada (ni h1, ni JSON-LD, ni meta); la Home se arma con secciones.
  expect(homeHtml).not.toContain(VALUES.home.title);
  await expect(previewFrame(page).locator("body")).not.toContainText(VALUES.home.title);

  // Sin contaminación en las rutas Nosotros y Contacto.
  const aboutHtml = fileText(after, "nosotros/index.html");
  const contactHtml = fileText(after, "contacto/index.html");
  expect(aboutHtml).toContain(`<title>${originalAbout.seoTitle}</title>`);
  expect(contactHtml).toContain(`<title>${originalContact.seoTitle}</title>`);
  for (const value of Object.values(VALUES.home)) {
    expect(aboutHtml).not.toContain(value);
    expect(contactHtml).not.toContain(value);
  }

  // El contexto para agentes también consume seoTitle/seoDescription de la Home.
  const aiContext = fileText(after, "ai-context.json");
  expect(aiContext).toContain(VALUES.home.seoTitle);
  expect(aiContext).toContain(VALUES.home.seoDescription);
});

test("Nosotros: título visible (h1), título SEO y descripción SEO llegan a /nosotros/", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await openDemoStore(page);
  await openResumenTab(page);
  await expandPagesSection(page);

  const original = await readPageValues(page, "Nosotros");
  const originalHome = await readPageValues(page, "Home");
  const originalContact = await readPageValues(page, "Contacto");
  const before = await exportStoredSite(page);
  const beforeAbout = fileText(before, "nosotros/index.html");
  expect(beforeAbout).toContain(`<h1>${original.title}</h1>`);
  for (const value of Object.values(VALUES.about)) {
    expect(beforeAbout).not.toContain(value);
  }

  await editPageFields(page, "Nosotros", VALUES.about);
  expect(await readPageValues(page, "Home")).toEqual(originalHome);
  expect(await readPageValues(page, "Contacto")).toEqual(originalContact);
  await expectPersistedPage(page, "about", VALUES.about);

  const after = await exportStoredSite(page);
  const aboutHtml = fileText(after, "nosotros/index.html");
  expect(aboutHtml).toContain(`<title>${VALUES.about.seoTitle}</title>`);
  expect(metaDescription(aboutHtml)).toBe(VALUES.about.seoDescription);
  expect(aboutHtml).toContain(`<h1>${VALUES.about.title}</h1>`);
  expect(aboutHtml).toContain('"@type":"AboutPage"');
  expect(aboutHtml).toContain(`"name":"${VALUES.about.title}"`);
  expect(aboutHtml).toContain(`"description":"${VALUES.about.seoDescription}"`);

  // Sin contaminación en Home y Contacto.
  const homeHtml = fileText(after, "index.html");
  const contactHtml = fileText(after, "contacto/index.html");
  expect(homeHtml).toContain(`<title>${originalHome.seoTitle}</title>`);
  expect(contactHtml).toContain(`<title>${originalContact.seoTitle}</title>`);
  for (const value of Object.values(VALUES.about)) {
    expect(homeHtml).not.toContain(value);
    expect(contactHtml).not.toContain(value);
  }

  // Renderer compartido: preview en la ruta /nosotros/.
  await page.getByTestId("ui-preview-route").fill("/nosotros/");
  await page.getByTestId("ui-preview-route").press("Enter");
  await expectPreviewTitle(page, VALUES.about.seoTitle);
  await expect(previewFrame(page).locator("h1").first()).toContainText(VALUES.about.title);
});

test("Contacto: título visible (h1), título SEO y descripción SEO llegan a /contacto/", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await openDemoStore(page);
  await openResumenTab(page);
  await expandPagesSection(page);

  const original = await readPageValues(page, "Contacto");
  const originalHome = await readPageValues(page, "Home");
  const originalAbout = await readPageValues(page, "Nosotros");
  const before = await exportStoredSite(page);
  const beforeContact = fileText(before, "contacto/index.html");
  expect(beforeContact).toContain(`<h1>${original.title}</h1>`);
  for (const value of Object.values(VALUES.contact)) {
    expect(beforeContact).not.toContain(value);
  }

  await editPageFields(page, "Contacto", VALUES.contact);
  expect(await readPageValues(page, "Home")).toEqual(originalHome);
  expect(await readPageValues(page, "Nosotros")).toEqual(originalAbout);
  await expectPersistedPage(page, "contact", VALUES.contact);

  const after = await exportStoredSite(page);
  const contactHtml = fileText(after, "contacto/index.html");
  expect(contactHtml).toContain(`<title>${VALUES.contact.seoTitle}</title>`);
  expect(metaDescription(contactHtml)).toBe(VALUES.contact.seoDescription);
  expect(contactHtml).toContain(`<h1>${VALUES.contact.title}</h1>`);
  expect(contactHtml).toContain('"@type":"ContactPage"');
  expect(contactHtml).toContain(`"name":"${VALUES.contact.title}"`);

  // Sin contaminación en Home y Nosotros.
  const homeHtml = fileText(after, "index.html");
  const aboutHtml = fileText(after, "nosotros/index.html");
  expect(homeHtml).toContain(`<title>${originalHome.seoTitle}</title>`);
  expect(aboutHtml).toContain(`<title>${originalAbout.seoTitle}</title>`);
  for (const value of Object.values(VALUES.contact)) {
    expect(homeHtml).not.toContain(value);
    expect(aboutHtml).not.toContain(value);
  }

  // Renderer compartido: preview en la ruta /contacto/.
  await page.getByTestId("ui-preview-route").fill("/contacto/");
  await page.getByTestId("ui-preview-route").press("Enter");
  await expectPreviewTitle(page, VALUES.contact.seoTitle);
  await expect(previewFrame(page).locator("h1").first()).toContainText(VALUES.contact.title);
});

test("secciones por página: cada ruta exportada sólo muestra sus propias secciones (R6)", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await openDemoStore(page);

  // El proyecto demo guardado, tal como el Studio lo exporta.
  const seededRecord = await readStoredProject(page, STORE_ID);
  expect(seededRecord).not.toBeNull();
  const seeded = seededRecord as StoreProjectV1;

  const section = (id: string, title: string, body: string): StoreSection => ({
    id,
    slot: "content",
    moduleId: "catalog-newsletter-cta",
    enabled: true,
    settings: { title, body, actionLabel: "R6 Escribir", actionHref: "/contacto/" },
    motion: {
      preset: "none",
      intensity: 0,
      direction: "up",
      distance: 0,
      duration: 0,
      delay: 0,
      stagger: 0,
      easing: "linear",
      entryPoint: 0,
      once: true,
    },
  });

  const withSections = StoreProjectV1Schema.parse({
    ...seeded,
    pages: seeded.pages.map((candidate) => {
      if (candidate.kind === "about") {
        return {
          ...candidate,
          sections: [section("section-r6-about", SECTION_ABOUT_TITLE, SECTION_ABOUT_BODY)],
        };
      }
      if (candidate.kind === "contact") {
        return {
          ...candidate,
          sections: [section("section-r6-contact", SECTION_CONTACT_TITLE, SECTION_CONTACT_BODY)],
        };
      }
      return candidate;
    }),
  });

  const exported = exportProject(withSections, { mode: "production" });
  const home = fileText(exported, "index.html");
  const about = fileText(exported, "nosotros/index.html");
  const contact = fileText(exported, "contacto/index.html");

  // La sección de Nosotros sólo vive en /nosotros/.
  expect(about).toContain('data-solara-module="catalog-newsletter-cta"');
  expect(about).toContain(SECTION_ABOUT_TITLE);
  expect(about).toContain(SECTION_ABOUT_BODY);
  expect(about).not.toContain(SECTION_CONTACT_TITLE);
  expect(about).not.toContain(SECTION_CONTACT_BODY);

  // La sección de Contacto sólo vive en /contacto/.
  expect(contact).toContain('data-solara-module="catalog-newsletter-cta"');
  expect(contact).toContain(SECTION_CONTACT_TITLE);
  expect(contact).toContain(SECTION_CONTACT_BODY);
  expect(contact).not.toContain(SECTION_ABOUT_TITLE);
  expect(contact).not.toContain(SECTION_ABOUT_BODY);

  // La Home (secciones de plantilla) no recibe ninguna sección de página.
  expect(home).not.toContain(SECTION_ABOUT_TITLE);
  expect(home).not.toContain(SECTION_CONTACT_TITLE);

  // El mismo renderer del preview las ubica en la ruta correcta.
  const previewAbout = renderPreviewHtml(withSections, "draft", "/nosotros/");
  expect(previewAbout).toContain(SECTION_ABOUT_TITLE);
  expect(previewAbout).not.toContain(SECTION_CONTACT_TITLE);
  const previewContact = renderPreviewHtml(withSections, "draft", "/contacto/");
  expect(previewContact).toContain(SECTION_CONTACT_TITLE);
  expect(previewContact).not.toContain(SECTION_ABOUT_TITLE);
});
