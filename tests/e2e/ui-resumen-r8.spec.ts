/**
 * Auditoría Resumen R8 (2026-08-11) — Upgrade de plantilla y persistencia del
 * Resumen. Contrato de 4 capas (plan docs/superpowers/plans/2026-08-10-auditoria-resumen.md):
 * - funcional: "Respaldar y adoptar cambios" descarga el respaldo previo,
 *   aplica los safeChanges (versión + secciones de plantilla), deja de
 *   mostrarse y persiste templateVersion 1→2 (recargar → sin panel); los
 *   campos del Resumen (identidad/whatsapp/dominio/navegación) sobreviven la
 *   recarga de pestaña y de la app;
 * - auto-feedback: panel de actualización con los cambios, indicador de
 *   guardado, switches y acordeones accesibles (aria-expanded);
 * - datos: templateVersion y sections en IndexedDB; valores editados en el
 *   respaldo .solara.json descargado;
 * - utilidad: tras adoptar, el sitio exportado (exportProject production)
 *   incorpora la sección de plantilla faltante (diff antes/después).
 * Hallazgo verificado: el estado de los colapsables del Resumen NO persiste
 * (ni al cambiar de pestaña ni al recargar la app); se documenta en el
 * reporte .superpowers/sdd/resumen-r8-report.md.
 */
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { StoreProjectV1Schema } from "@solara/project-schema";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import {
  applyCatalogModernUpgrade,
  planCatalogModernUpgrade,
} from "@solara/project-schema/catalog-modern-upgrade";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 150_000 : 90_000);

const DEMO_PROJECT_ID = "store-modo-sur-demo";
const UPGRADE_TO_VERSION = 2;
const NEWSLETTER_SECTION_ID = "modo-section-newsletter";

const EDITED_RESUMEN = {
  name: "Modo Sur R8",
  description: "Descripción persistida por la auditoría R8.",
  email: "r8@modo-sur.example",
  phone: "5491198765432",
  greeting: "Hola Modo Sur R8, quiero este pedido:",
  baseUrl: "https://modo-sur-r8.example",
  catalogLabel: "Catálogo R8",
  navLabel: "Marcas R8",
  showSearch: false,
  includeSku: false,
} as const;

/** Proyecto demo en el estado PRE-upgrade: templateVersion 1 y sin la
 *  sección de newsletter de la plantilla actual. Reproduce el estado que el
 *  test de UI siembra en IndexedDB. */
const demoV1 = StoreProjectV1Schema.parse({
  ...structuredClone(catalogModernStore),
  origin: {
    templateId: "catalog-modern",
    templateVersion: 1,
    seed: catalogModernStore.origin?.seed ?? "demo",
  },
  sections: catalogModernStore.sections.filter((section) => section.id !== NEWSLETTER_SECTION_ID),
});

const upgradePlan = planCatalogModernUpgrade(demoV1);
const upgradedDemo = applyCatalogModernUpgrade(
  demoV1,
  upgradePlan.safeChanges.map((change) => change.id),
);

// Sitio exportado antes y después de adoptar la actualización: la capa de
// utilidad se fija con el diff (patrón exported-store / ui-tema-t8).
const exportBeforeUpgrade = exportProject(demoV1, { mode: "production" });
const exportAfterUpgrade = exportProject(upgradedDemo, { mode: "production" });

function textsOf(exported: { files: ReadonlyMap<string, string | Uint8Array> }): string[] {
  return [...exported.files.entries()].map(
    ([path, content]) =>
      `${path}\n${typeof content === "string" ? content : new TextDecoder().decode(content)}`,
  );
}

interface ProjectRecordSnapshot {
  name: string;
  description: string;
  email: string;
  phone: string;
  greeting: string;
  includeSku: boolean;
  baseUrl: string;
  catalogLabel: string;
  navLabel: string;
  showSearch: boolean;
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
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
}

async function openDemoStore(page: Page): Promise<void> {
  await page.locator(`[data-store-card-id="${DEMO_PROJECT_ID}"]`).click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible({
    timeout: 30_000,
  });
}

async function openResumenTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
}

async function openPrepararTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();
}

/** Lee el proyecto guardado en IndexedDB (contrato de datos). */
async function readProjectRecord(page: Page): Promise<ProjectRecordSnapshot | null> {
  return page.evaluate(
    (projectId) =>
      new Promise<ProjectRecordSnapshot | null>((resolve, reject) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const db = request.result;
          const all = db.transaction("projects").objectStore("projects").getAll();
          all.addEventListener("success", () => {
            const records = all.result as Array<{
              project: {
                id: string;
                name: string;
                baseUrl: string;
                identity: { description: string; email: string };
                whatsapp: { phone: string; greeting: string; includeSku: boolean };
                navigation: {
                  catalogLabel: string;
                  showSearch: boolean;
                  items: Array<{ label: string }>;
                };
              };
            }>;
            const record = records.find((item) => item.project.id === projectId);
            if (!record) {
              resolve(null);
              return;
            }
            const project = record.project;
            resolve({
              name: project.name,
              description: project.identity.description,
              email: project.identity.email,
              phone: project.whatsapp.phone,
              greeting: project.whatsapp.greeting,
              includeSku: project.whatsapp.includeSku,
              baseUrl: project.baseUrl,
              catalogLabel: project.navigation.catalogLabel,
              navLabel: project.navigation.items[0]?.label ?? "",
              showSearch: project.navigation.showSearch,
            });
          });
          all.addEventListener("error", () => reject(all.error));
        });
      }),
    DEMO_PROJECT_ID,
  );
}

/** Siembra el estado PRE-upgrade en IndexedDB: templateVersion 1 y la sección
 *  de newsletter de la plantilla actual ausente (induce section-add). */
async function seedUpgradeState(page: Page): Promise<void> {
  const seeded = await page.evaluate(
    (projectId) =>
      new Promise<string>((resolve, reject) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const db = request.result;
          const transaction = db.transaction("projects", "readwrite");
          const store = transaction.objectStore("projects");
          const all = store.getAll();
          all.addEventListener("success", () => {
            const records = all.result as Array<{
              name: string;
              project: {
                id: string;
                origin?: { templateVersion?: number };
                sections?: Array<{ id: string }>;
              };
            }>;
            const record = records.find((item) => item.project.id === projectId);
            if (!record) {
              resolve(
                `false|${JSON.stringify(records.map((item) => ({ name: item.name, id: item.project.id })))}`,
              );
              return;
            }
            store.put({
              ...record,
              project: {
                ...record.project,
                origin: { ...(record.project.origin ?? {}), templateVersion: 1 },
                sections: (record.project.sections ?? []).filter(
                  (section) => section.id !== "modo-section-newsletter",
                ),
              },
            });
            transaction.addEventListener("complete", () => resolve("true"));
          });
          all.addEventListener("error", () => reject(all.error));
          transaction.addEventListener("error", () => reject(transaction.error));
        });
      }),
    DEMO_PROJECT_ID,
  );
  expect(seeded).toBe("true");
}

async function readUpgradeState(page: Page): Promise<{
  templateVersion: number | undefined;
  sectionIds: string[];
}> {
  return page.evaluate(
    (projectId) =>
      new Promise<{ templateVersion: number | undefined; sectionIds: string[] }>(
        (resolve, reject) => {
          const request = indexedDB.open("solara-commerce-studio");
          request.addEventListener("error", () => reject(request.error));
          request.addEventListener("success", () => {
            const db = request.result;
            const all = db.transaction("projects").objectStore("projects").getAll();
            all.addEventListener("success", () => {
              const records = all.result as Array<{
                project: {
                  id: string;
                  origin?: { templateVersion?: number };
                  sections?: Array<{ id: string }>;
                };
              }>;
              const record = records.find((item) => item.project.id === projectId);
              resolve(
                record
                  ? {
                      templateVersion: record.project.origin?.templateVersion,
                      sectionIds: (record.project.sections ?? []).map((section) => section.id),
                    }
                  : { templateVersion: undefined, sectionIds: [] },
              );
            });
            all.addEventListener("error", () => reject(all.error));
          });
        },
      ),
    DEMO_PROJECT_ID,
  );
}

/** Edita los campos del Resumen con valores deterministas (identidad, WhatsApp,
 *  dominio y navegación) usando el commit validado de cada control. */
async function applyResumenEdits(page: Page): Promise<void> {
  await page.getByLabel("Nombre de la tienda").fill(EDITED_RESUMEN.name);
  await page.getByLabel("Descripción", { exact: true }).fill(EDITED_RESUMEN.description);
  await page.getByLabel("Email", { exact: true }).fill(EDITED_RESUMEN.email);
  await page.getByLabel("Número internacional").fill(EDITED_RESUMEN.phone);
  await page.getByLabel("Saludo del pedido").fill(EDITED_RESUMEN.greeting);
  await page.getByLabel("URL pública").fill(EDITED_RESUMEN.baseUrl);
  await page.getByLabel("Nombre del catálogo").fill(EDITED_RESUMEN.catalogLabel);
  await page.getByLabel("Enlace 1", { exact: true }).fill(EDITED_RESUMEN.navLabel);
  const searchSwitch = page.getByRole("switch", { name: "Mostrar búsqueda" });
  if ((await searchSwitch.getAttribute("aria-checked")) === "true") await searchSwitch.click();
  const skuSwitch = page.getByRole("switch", { name: "Incluir SKU en el mensaje" });
  if ((await skuSwitch.getAttribute("aria-checked")) === "true") await skuSwitch.click();
}

/** Lee el Resumen completo desde los inputs del panel (contrato de datos UI). */
async function readResumen(page: Page): Promise<typeof EDITED_RESUMEN> {
  return {
    name: await page.getByLabel("Nombre de la tienda").inputValue(),
    description: await page.getByLabel("Descripción", { exact: true }).inputValue(),
    email: await page.getByLabel("Email", { exact: true }).inputValue(),
    phone: await page.getByLabel("Número internacional").inputValue(),
    greeting: await page.getByLabel("Saludo del pedido").inputValue(),
    baseUrl: await page.getByLabel("URL pública").inputValue(),
    catalogLabel: await page.getByLabel("Nombre del catálogo").inputValue(),
    navLabel: await page.getByLabel("Enlace 1", { exact: true }).inputValue(),
    showSearch:
      (await page
        .getByRole("switch", { name: "Mostrar búsqueda" })
        .getAttribute("aria-checked")) === "true",
    includeSku:
      (await page
        .getByRole("switch", { name: "Incluir SKU en el mensaje" })
        .getAttribute("aria-checked")) === "true",
  } as typeof EDITED_RESUMEN;
}

/** Guardar del modo navegador: flush del autosave con Ctrl+S y aviso "Guardado". */
async function flushSave(page: Page): Promise<void> {
  await page.keyboard.press("Control+s");
  await expect(page.locator(".save-indicator")).toContainText("Guardado", { timeout: 30_000 });
}

test("Respaldar y adoptar cambios descarga el respaldo, aplica la actualización y persiste (recarga → sin panel)", async ({
  page,
}) => {
  await resetIndexedDb(page);
  // El primer arranque crea la tienda Predeterminado; deja asentar el boot
  // antes de sembrar el estado PRE-upgrade (patrón H8-24).
  await page.waitForTimeout(900);
  await seedUpgradeState(page);

  await page.reload();
  await openDemoStore(page);
  await openPrepararTab(page);

  // Auto-feedback: el panel lista los cambios de plantilla propuestos.
  await expect(page.getByText("Actualización disponible")).toBeVisible();
  const panel = page.locator(".template-update");
  await expect(panel.getByText("Catalog Modern 2")).toBeVisible();
  await expect(panel.getByText("Actualizar Catalog Modern a la versión 2")).toBeVisible();
  await expect(panel.getByText("Agregar sección base: catalog-newsletter-cta")).toBeVisible();

  // Funcional: el botón descarga el respaldo ANTES de adoptar.
  const updateButton = page.getByRole("button", { name: "Respaldar y adoptar cambios" });
  const downloadPromise = page.waitForEvent("download");
  await updateButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "demo-catalogo-jerarquico-antes-de-actualizar.solara.json",
  );

  // Datos: el respaldo transporta el proyecto PRE-upgrade (v1, sin la sección).
  const backup = JSON.parse(readFileSync((await download.path()) ?? "", "utf8")) as {
    format: string;
    version: number;
    project: { origin?: { templateVersion?: number }; sections: Array<{ id: string }> };
  };
  expect(backup.format).toBe("solara-project");
  expect(backup.version).toBe(2);
  expect(backup.project.origin?.templateVersion).toBe(1);
  expect(backup.project.sections.some((section) => section.id === NEWSLETTER_SECTION_ID)).toBe(
    false,
  );

  // Auto-feedback: el panel desaparece al adoptar.
  await expect(page.getByText("Actualización disponible")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Respaldar y adoptar cambios" })).toHaveCount(0);

  // Datos: la adopción persiste en IndexedDB (templateVersion 2 + sección).
  await expect
    .poll(async () => (await readUpgradeState(page)).templateVersion, { timeout: 15_000 })
    .toBe(UPGRADE_TO_VERSION);
  const adopted = await readUpgradeState(page);
  expect(adopted.sectionIds).toContain(NEWSLETTER_SECTION_ID);

  // Persistencia: recargar la app no revive el panel.
  await page.reload();
  await openDemoStore(page);
  await openPrepararTab(page);
  await expect(page.getByText("Actualización disponible")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Respaldar y adoptar cambios" })).toHaveCount(0);
});

test("utilidad: adoptar la actualización agrega la sección de plantilla al sitio exportado (diff)", async () => {
  expect(upgradePlan.safeChanges.map((change) => change.id)).toEqual(
    expect.arrayContaining(["template.version", `section.add.${NEWSLETTER_SECTION_ID}`]),
  );

  // Datos: la aplicación del plan sube la versión y restaura la sección con
  // los settings de la plantilla.
  expect(upgradedDemo.origin?.templateVersion).toBe(UPGRADE_TO_VERSION);
  const newsletter = upgradedDemo.sections.find((section) => section.id === NEWSLETTER_SECTION_ID);
  const referenceNewsletter = catalogModernStore.sections.find(
    (section) => section.id === NEWSLETTER_SECTION_ID,
  );
  expect(newsletter?.settings).toEqual(referenceNewsletter?.settings);

  // Utilidad: el sitio exportado después de adoptar incorpora el módulo de
  // la sección restaurada; el sitio previo no lo tiene (diff real).
  const beforeTexts = textsOf(exportBeforeUpgrade);
  const afterTexts = textsOf(exportAfterUpgrade);
  expect(
    beforeTexts.some((text) => text.includes('data-solara-module="catalog-newsletter-cta"')),
  ).toBe(false);
  expect(
    afterTexts.some((text) => text.includes('data-solara-module="catalog-newsletter-cta"')),
  ).toBe(true);
  expect(beforeTexts.join("\n")).not.toBe(afterTexts.join("\n"));
});

test("persistencia: recargar la pestaña conserva identidad, WhatsApp, dominio y navegación", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await openDemoStore(page);
  await openResumenTab(page);

  await applyResumenEdits(page);
  await expect(page.getByTestId("ui-save-indicator")).toContainText("Sin guardar");
  await expect(page.getByTestId("ui-save-indicator")).toContainText("Cambios guardados", {
    timeout: 5_000,
  });

  // El autosave (550 ms) termina antes de recargar: el registro de IndexedDB
  // ya es la versión editada.
  await expect
    .poll(async () => (await readProjectRecord(page))?.name, { timeout: 15_000 })
    .toBe(EDITED_RESUMEN.name);

  await page.reload();
  await openDemoStore(page);
  await openResumenTab(page);

  const restored = await readResumen(page);
  expect(restored).toEqual({ ...EDITED_RESUMEN });
});

test("persistencia: Guardar (Ctrl+S) conserva los campos tras recargar la app (IndexedDB)", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await openDemoStore(page);
  await openResumenTab(page);

  await applyResumenEdits(page);
  await flushSave(page);

  const stored = await readProjectRecord(page);
  expect(stored).toEqual({ ...EDITED_RESUMEN });

  await page.reload();
  await openDemoStore(page);
  await openResumenTab(page);

  const restored = await readResumen(page);
  expect(restored).toEqual({ ...EDITED_RESUMEN });
});

test("persistencia: el respaldo .solara.json descargado contiene los valores editados del Resumen", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await openDemoStore(page);
  await openResumenTab(page);

  await applyResumenEdits(page);
  await flushSave(page);

  // "Respaldo de proyecto" del panel Exportar: mismo envelope que el respaldo
  // del dashboard, sin depender del estado de selección del dashboard.
  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Exportar", exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("ui-export-backup").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("demo-catalogo-jerarquico.solara.json");

  const envelope = JSON.parse(readFileSync((await download.path()) ?? "", "utf8")) as {
    format: string;
    version: number;
    projectId: string;
    project: {
      name: string;
      baseUrl: string;
      identity: { description: string; email: string };
      whatsapp: { phone: string; greeting: string; includeSku: boolean };
      navigation: {
        catalogLabel: string;
        showSearch: boolean;
        items: Array<{ label: string }>;
      };
    };
  };
  expect(envelope.format).toBe("solara-project");
  expect(envelope.version).toBe(2);
  expect(envelope.projectId).toBe(DEMO_PROJECT_ID);
  expect(envelope.project.name).toBe(EDITED_RESUMEN.name);
  expect(envelope.project.identity.description).toBe(EDITED_RESUMEN.description);
  expect(envelope.project.identity.email).toBe(EDITED_RESUMEN.email);
  expect(envelope.project.whatsapp.phone).toBe(EDITED_RESUMEN.phone);
  expect(envelope.project.whatsapp.greeting).toBe(EDITED_RESUMEN.greeting);
  expect(envelope.project.whatsapp.includeSku).toBe(false);
  expect(envelope.project.baseUrl).toBe(EDITED_RESUMEN.baseUrl);
  expect(envelope.project.navigation.catalogLabel).toBe(EDITED_RESUMEN.catalogLabel);
  expect(envelope.project.navigation.showSearch).toBe(false);
  expect(envelope.project.navigation.items[0]?.label).toBe(EDITED_RESUMEN.navLabel);
});

test("los colapsables pliegan y despliegan cada sección del Resumen dentro de la sesión", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await openDemoStore(page);
  await openResumenTab(page);

  const identityToggle = page.getByRole("button", { name: "Identidad", exact: true });
  const identityPanel = page.locator('[data-accordion-id="identity"] .overview-accordion__panel');

  await expect(identityToggle).toHaveAttribute("aria-expanded", "true");
  await expect(identityPanel).toBeVisible();

  await identityToggle.click();
  await expect(identityToggle).toHaveAttribute("aria-expanded", "false");
  await expect(identityPanel).toBeHidden();

  // El resto de las secciones sigue operativa.
  await expect(page.getByRole("button", { name: "Pedido por WhatsApp" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );

  await identityToggle.click();
  await expect(identityToggle).toHaveAttribute("aria-expanded", "true");
  await expect(identityPanel).toBeVisible();
});

test("hallazgo verificado: el estado de los colapsables NO persiste ni entre pestañas ni tras recargar", async ({
  page,
}) => {
  await resetIndexedDb(page);
  await openDemoStore(page);
  await openResumenTab(page);

  const identityToggle = page.getByRole("button", { name: "Identidad", exact: true });
  await identityToggle.click();
  await expect(identityToggle).toHaveAttribute("aria-expanded", "false");

  // Cambio de pestaña: StudioTabContent desmonta el panel y el estado es
  // efímero (useState local de Overview.tsx).
  await page.getByRole("tab", { name: "Tema", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tema", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
  await expect(identityToggle).toHaveAttribute("aria-expanded", "true");

  // Recarga de la app: idem, todo vuelve a abierto.
  await identityToggle.click();
  await expect(identityToggle).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await openDemoStore(page);
  await openResumenTab(page);
  await expect(page.getByRole("button", { name: "Identidad", exact: true })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});
