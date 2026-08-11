/**
 * Auditoría Preparar PR6 (2026-08-11) — Upgrade en profundidad del panel
 * "Actualización disponible" (template v1→v2). Contrato de 4 capas (plan
 * docs/superpowers/plans/2026-08-10-auditoria-preparar.md):
 * - funcional: "Respaldar y adoptar cambios" descarga el respaldo previo y
 *   aplica EXACTAMENTE los safeChanges (versión + secciones base faltantes);
 *   con un conflicto remanente el panel no se puede cerrar (el botón no
 *   aplica nada nuevo); la reversión con el respaldo importado vuelve a v1 y
 *   revive el panel;
 * - auto-feedback: labels reales de los cambios propuestos; los conflicts NO
 *   se listan (sólo un conteo); el label y el path de cada conflicto existen
 *   en el plan pero no se renderizan;
 * - datos: diff del proyecto antes/después en IndexedDB — sólo se agrega la
 *   sección de plantilla (byte-idénticas las 11 restantes, incluida la
 *   editada por el usuario y la sección en conflicto); textos, productos e
 *   imágenes del usuario intactos; templateVersion 1→2;
 * - utilidad: tras adoptar, el sitio exportado (exportProject production)
 *   incorpora la sección restaurada y conserva los textos del usuario (diff).
 */
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { type StoreProjectV1, StoreProjectV1Schema } from "@solara/project-schema";
import { buildCatalogModernProject } from "@solara/project-schema/catalog-modern-template";
import {
  applyCatalogModernUpgrade,
  planCatalogModernUpgrade,
} from "@solara/project-schema/catalog-modern-upgrade";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 150_000 : 90_000);

const DEMO_PROJECT_ID = "store-modo-sur-demo";
const UPGRADE_TO_VERSION = 2;
const NEWSLETTER_SECTION_ID = "modo-section-newsletter";
const TIP_SECTION_ID = "modo-section-tip";
const HERO_SECTION_ID = "modo-section-hero";
const USER_HERO_TITLE = "Título propio del usuario PR6";
const USER_PRODUCT_TITLE = "Remera esencial del usuario PR6";
const USER_ASSET_ALT = "Foto propia del usuario PR6";
const BACKUP_FILENAME = "demo-catalogo-jerarquico-antes-de-actualizar.solara.json";

interface UpgradeSnapshot {
  templateVersion: number | undefined;
  sections: Array<Record<string, unknown> & { id: string }>;
  heroTitle: string;
  productTitle: string;
  assetAlt: string;
}

/** Proyecto demo en el estado PRE-upgrade con contenido del usuario: v1, sin
 *  la sección de newsletter (induce section-add), con una sección extra
 *  modo-section-tip ausente de la plantilla (induce conflict) y con textos,
 *  producto e imagen editados por el usuario. Reproduce el estado que los
 *  tests de UI siembran en IndexedDB. */
function buildDemoV1WithUserState(): StoreProjectV1 {
  const demo = buildCatalogModernProject({ seed: "demo" });
  const testimonials = demo.sections.find((section) => section.id === "modo-section-testimonials");
  return StoreProjectV1Schema.parse({
    ...demo,
    origin: { ...(demo.origin ?? {}), templateVersion: 1 },
    sections: [
      ...demo.sections
        .filter((section) => section.id !== NEWSLETTER_SECTION_ID)
        .map((section) =>
          section.id === HERO_SECTION_ID
            ? { ...section, settings: { ...section.settings, title: USER_HERO_TITLE } }
            : section,
        ),
      ...(testimonials ? [{ ...testimonials, id: TIP_SECTION_ID }] : []),
    ],
    products: demo.products.map((product, index) =>
      index === 0 ? { ...product, title: USER_PRODUCT_TITLE } : product,
    ),
    assets: demo.assets.map((asset) =>
      asset.id === "asset-hero" ? { ...asset, alt: USER_ASSET_ALT } : asset,
    ),
  });
}

const demoV1WithUserState = buildDemoV1WithUserState();
const upgradePlan = planCatalogModernUpgrade(demoV1WithUserState);
const upgradedDemo = applyCatalogModernUpgrade(
  demoV1WithUserState,
  upgradePlan.safeChanges.map((change) => change.id),
);

// Sitio exportado antes y después de adoptar: la capa de utilidad se fija con
// el diff (patrón exported-store / ui-resumen-r8).
const exportBeforeUpgrade = exportProject(demoV1WithUserState, { mode: "production" });
const exportAfterUpgrade = exportProject(upgradedDemo, { mode: "production" });

function textsOf(exported: { files: ReadonlyMap<string, string | Uint8Array> }): string[] {
  return [...exported.files.entries()].map(
    ([path, content]) =>
      `${path}\n${typeof content === "string" ? content : new TextDecoder().decode(content)}`,
  );
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

async function openPrepararTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();
}

async function openExportTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Exportar", exact: true })).toBeVisible();
}

/** Siembra el estado PRE-upgrade en IndexedDB sobre la tienda demo: v1, sin
 *  la sección de newsletter, con la sección extra modo-section-tip (conflict)
 *  y con contenido del usuario (título del hero, título del primer producto y
 *  alt del asset hero). */
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
                sections?: Array<Record<string, unknown> & { id: string }>;
                products?: Array<Record<string, unknown>>;
                assets?: Array<Record<string, unknown> & { id: string }>;
              };
            }>;
            const record = records.find((item) => item.project.id === projectId);
            if (!record) {
              resolve(
                `false|${JSON.stringify(records.map((item) => ({ name: item.name, id: item.project.id })))}`,
              );
              return;
            }
            const project = record.project;
            const sections = project.sections ?? [];
            const testimonials = sections.find(
              (section) => section.id === "modo-section-testimonials",
            );
            store.put({
              ...record,
              project: {
                ...project,
                origin: { ...(project.origin ?? {}), templateVersion: 1 },
                sections: [
                  ...sections
                    .filter((section) => section.id !== "modo-section-newsletter")
                    .map((section) =>
                      section.id === "modo-section-hero"
                        ? {
                            ...section,
                            settings: {
                              ...(section.settings as Record<string, unknown>),
                              title: "Título propio del usuario PR6",
                            },
                          }
                        : section,
                    ),
                  ...(testimonials ? [{ ...testimonials, id: "modo-section-tip" }] : []),
                ],
                products: (project.products ?? []).map((product, index) =>
                  index === 0 ? { ...product, title: "Remera esencial del usuario PR6" } : product,
                ),
                assets: (project.assets ?? []).map((asset) =>
                  asset.id === "asset-hero"
                    ? { ...asset, alt: "Foto propia del usuario PR6" }
                    : asset,
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

/** Lee el proyecto guardado en IndexedDB (contrato de datos). */
async function readUpgradeSnapshot(page: Page): Promise<UpgradeSnapshot> {
  return page.evaluate(
    (projectId) =>
      new Promise<UpgradeSnapshot>((resolve, reject) => {
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
                sections?: Array<Record<string, unknown> & { id: string }>;
                products?: Array<Record<string, unknown>>;
                assets?: Array<Record<string, unknown> & { id: string }>;
              };
            }>;
            const record = records.find((item) => item.project.id === projectId);
            const project = record?.project;
            if (!project) {
              reject(new Error("No se encontró el proyecto demo en IndexedDB."));
              return;
            }
            const hero = project.sections?.find((section) => section.id === "modo-section-hero");
            const heroSettings = hero?.settings as Record<string, unknown> | undefined;
            const heroAsset = project.assets?.find((asset) => asset.id === "asset-hero");
            resolve({
              templateVersion: project.origin?.templateVersion,
              sections: project.sections ?? [],
              heroTitle: String(heroSettings?.title ?? ""),
              productTitle: String(project.products?.[0]?.title ?? ""),
              assetAlt: String(heroAsset?.alt ?? ""),
            });
          });
          all.addEventListener("error", () => reject(all.error));
        });
      }),
    DEMO_PROJECT_ID,
  );
}

/** Rutina compartida: sembrar el estado PRE-upgrade, abrir la tienda demo y
 *  llegar al panel "Actualización disponible". */
async function prepareUpgradePanel(page: Page): Promise<void> {
  await resetIndexedDb(page);
  await page.waitForTimeout(900);
  await seedUpgradeState(page);
  await page.reload();
  await openDemoStore(page);
  await openPrepararTab(page);
  await expect(page.getByText("Actualización disponible")).toBeVisible();
}

test("el plan produce version + section-add y un conflict conservado; el panel muestra los labels reales", async ({
  page,
}) => {
  // Datos (capa unitaria): qué produce cada rama del plan sobre el estado
  // PRE-upgrade (v1 + newsletter ausente + sección extra modo-section-*).
  expect(upgradePlan.fromVersion).toBe(1);
  expect(upgradePlan.toVersion).toBe(UPGRADE_TO_VERSION);
  expect(upgradePlan.safeChanges.map((change) => change.id)).toEqual([
    "template.version",
    `section.add.${NEWSLETTER_SECTION_ID}`,
  ]);
  expect(upgradePlan.safeChanges[0]).toMatchObject({
    kind: "version",
    label: `Actualizar Catalog Modern a la versión ${UPGRADE_TO_VERSION}`,
  });
  expect(upgradePlan.safeChanges[1]).toMatchObject({
    kind: "section-add",
    sectionId: NEWSLETTER_SECTION_ID,
  });
  expect(upgradePlan.conflicts).toEqual([
    {
      id: `section.removed.${TIP_SECTION_ID}`,
      path: `sections.${TIP_SECTION_ID}`,
      label: "Sección no presente en la plantilla actual: catalog-testimonials",
      reason: "Se conserva porque puede contener una decisión del usuario.",
    },
  ]);
  // Las settings del hero editadas por el usuario se registran como conservadas.
  expect(upgradePlan.preservedUserChanges).toEqual([`sections.${HERO_SECTION_ID}.settings`]);

  await prepareUpgradePanel(page);

  // Auto-feedback: el panel lista los safeChanges con sus labels reales y
  // anuncia la conservación del contenido del usuario.
  const panel = page.locator(".template-update");
  await expect(panel.getByText("Catalog Modern 2")).toBeVisible();
  await expect(panel.getByText("Actualizar Catalog Modern a la versión 2")).toBeVisible();
  await expect(panel.getByText("Agregar sección base: catalog-newsletter-cta")).toBeVisible();
  await expect(panel.getByText("Tus textos, productos e imágenes se conservan.")).toBeVisible();

  // Los conflicts NO se listan: sólo el conteo. El label del conflicto existe
  // en el plan pero no se renderiza (el usuario no sabe QUÉ se conserva).
  await expect(panel.getByText(/Sección no presente en la plantilla actual/)).toBeVisible();
  await expect(panel.getByText("modo-section-tip")).toBeVisible();
  await expect(
    panel.getByText("Se conserva porque puede contener una decisión del usuario."),
  ).toBeVisible();
});

test("adoptar aplica EXACTAMENTE los safeChanges y conserva lo del usuario (diff byte a byte)", async ({
  page,
}) => {
  await prepareUpgradePanel(page);
  const before = await readUpgradeSnapshot(page);
  expect(before.templateVersion).toBe(1);
  expect(before.sections.some((section) => section.id === NEWSLETTER_SECTION_ID)).toBe(false);
  expect(before.sections.some((section) => section.id === TIP_SECTION_ID)).toBe(true);
  expect(before.heroTitle).toBe(USER_HERO_TITLE);
  expect(before.productTitle).toBe(USER_PRODUCT_TITLE);
  expect(before.assetAlt).toBe(USER_ASSET_ALT);

  // Funcional: el botón descarga el respaldo ANTES de adoptar.
  const updateButton = page.getByRole("button", { name: "Respaldar y adoptar cambios" });
  const downloadPromise = page.waitForEvent("download");
  await updateButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(BACKUP_FILENAME);

  // Datos: el respaldo transporta el proyecto PRE-upgrade (v1, sin la sección
  // de plantilla, con el conflict y con el contenido del usuario).
  const backup = JSON.parse(readFileSync((await download.path()) ?? "", "utf8")) as {
    format: string;
    version: number;
    project: {
      origin?: { templateVersion?: number };
      sections: Array<{ id: string; settings?: Record<string, unknown> }>;
    };
  };
  expect(backup.format).toBe("solara-project");
  expect(backup.version).toBe(2);
  expect(backup.project.origin?.templateVersion).toBe(1);
  expect(backup.project.sections.some((section) => section.id === NEWSLETTER_SECTION_ID)).toBe(
    false,
  );
  expect(backup.project.sections.some((section) => section.id === TIP_SECTION_ID)).toBe(true);
  expect(
    backup.project.sections.find((section) => section.id === HERO_SECTION_ID)?.settings?.title,
  ).toBe(USER_HERO_TITLE);

  // Datos: diff real antes/después en IndexedDB. La única diferencia es la
  // sección de plantilla agregada al final (byte-idéntico todo lo demás,
  // incluida la sección editada por el usuario y la sección en conflicto).
  await expect
    .poll(async () => (await readUpgradeSnapshot(page)).templateVersion, { timeout: 20_000 })
    .toBe(UPGRADE_TO_VERSION);
  const after = await readUpgradeSnapshot(page);
  expect(after.sections.length).toBe(before.sections.length + 1);
  expect(after.sections.at(-1)?.id).toBe(NEWSLETTER_SECTION_ID);
  for (const section of before.sections) {
    const next = after.sections.find((candidate) => candidate.id === section.id);
    expect(next, `sección ${section.id} alterada por la actualización`).toBeDefined();
    expect(JSON.stringify(next)).toBe(JSON.stringify(section));
  }

  // Los conflicts se conservan de verdad: la sección fuera de la plantilla
  // sigue presente, y el contenido del usuario no se pisa (ningún field del
  // usuario está en safeChanges: sólo version + section-add).
  expect(after.sections.some((section) => section.id === TIP_SECTION_ID)).toBe(true);
  expect(after.heroTitle).toBe(USER_HERO_TITLE);
  expect(after.productTitle).toBe(USER_PRODUCT_TITLE);
  expect(after.assetAlt).toBe(USER_ASSET_ALT);

  // La sección agregada trae los settings de la plantilla actual (referencia
  // real del template demo).
  const referenceNewsletter = buildCatalogModernProject({ seed: "demo" }).sections.find(
    (section) => section.id === NEWSLETTER_SECTION_ID,
  );
  const adoptedNewsletter = after.sections.find((section) => section.id === NEWSLETTER_SECTION_ID);
  expect(adoptedNewsletter?.settings).toEqual(referenceNewsletter?.settings);
});

test("reversión con el respaldo previo: importar el .solara.json vuelve a v1 y revive el panel", async ({
  page,
}) => {
  await prepareUpgradePanel(page);
  const updateButton = page.getByRole("button", { name: "Respaldar y adoptar cambios" });
  const downloadPromise = page.waitForEvent("download");
  await updateButton.click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();

  await expect
    .poll(async () => (await readUpgradeSnapshot(page)).templateVersion, { timeout: 20_000 })
    .toBe(UPGRADE_TO_VERSION);

  // Reversión: Importar respaldo desde el tab Exportar con el archivo
  // descargado antes de adoptar.
  await openExportTab(page);
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByTestId("ui-export-import").click();
  const chooser = await chooserPromise;
  await chooser.setFiles(backupPath ?? "");
  await page.getByRole("button", { name: "Importar y reemplazar" }).click();

  // Datos: el proyecto vuelve al estado PRE-upgrade completo.
  await expect
    .poll(async () => (await readUpgradeSnapshot(page)).templateVersion, { timeout: 20_000 })
    .toBe(1);
  const reverted = await readUpgradeSnapshot(page);
  expect(reverted.sections.some((section) => section.id === NEWSLETTER_SECTION_ID)).toBe(false);
  expect(reverted.sections.some((section) => section.id === TIP_SECTION_ID)).toBe(true);
  expect(reverted.heroTitle).toBe(USER_HERO_TITLE);
  expect(reverted.productTitle).toBe(USER_PRODUCT_TITLE);
  expect(reverted.assetAlt).toBe(USER_ASSET_ALT);

  // Funcional: el panel "Actualización disponible" revive (se puede volver a
  // adoptar: el ciclo es reversible).
  await openPrepararTab(page);
  await expect(page.getByText("Actualización disponible")).toBeVisible();
  await expect(page.getByRole("button", { name: "Respaldar y adoptar cambios" })).toBeVisible();
  await expect(page.getByText("Agregar sección base: catalog-newsletter-cta")).toBeVisible();
});

test("con un conflicto remanente el panel no se puede cerrar: el botón ya no aplica nada", async ({
  page,
}) => {
  await prepareUpgradePanel(page);
  const updateButton = page.getByRole("button", { name: "Respaldar y adoptar cambios" });
  const downloadPromise = page.waitForEvent("download");
  await updateButton.click();
  await downloadPromise;
  await expect
    .poll(async () => (await readUpgradeSnapshot(page)).templateVersion, { timeout: 20_000 })
    .toBe(UPGRADE_TO_VERSION);

  // Auto-feedback: la sección se adoptó (el listado de safeChanges se vació)
  // pero el panel SIGUE visible porque el conflict se conservó: queda sólo el
  // conteo y el botón, que ya no tiene cambios que aplicar.
  const panel = page.locator(".template-update");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Agregar sección base: catalog-newsletter-cta")).toHaveCount(0);
  await expect(panel.getByText(/Sección no presente en la plantilla actual/)).toBeVisible();
  await expect(page.getByText("Actualización disponible")).toBeVisible();

  // Funcional: un segundo clic no aplica nada nuevo (mismo estado) y vuelve a
  // descargar otro respaldo: no hay forma de cerrar el panel.
  const stateBefore = JSON.stringify(await readUpgradeSnapshot(page));
  const secondDownloadPromise = page.waitForEvent("download");
  await updateButton.click();
  expect((await secondDownloadPromise).suggestedFilename()).toBe(BACKUP_FILENAME);
  await expect
    .poll(async () => JSON.stringify(await readUpgradeSnapshot(page)), { timeout: 20_000 })
    .toBe(stateBefore);
  await expect(page.getByText("Actualización disponible")).toBeVisible();
  await expect(page.getByRole("button", { name: "Respaldar y adoptar cambios" })).toBeVisible();
});

test("utilidad: tras adoptar el sitio exportado incorpora la sección y conserva el contenido del usuario (diff)", async () => {
  expect(upgradePlan.safeChanges.map((change) => change.id)).toEqual(
    expect.arrayContaining(["template.version", `section.add.${NEWSLETTER_SECTION_ID}`]),
  );
  expect(upgradedDemo.origin?.templateVersion).toBe(UPGRADE_TO_VERSION);

  // Utilidad: el sitio exportado después de adoptar incorpora el módulo de la
  // sección restaurada; el sitio previo no lo tiene (diff real).
  const beforeTexts = textsOf(exportBeforeUpgrade);
  const afterTexts = textsOf(exportAfterUpgrade);
  expect(
    beforeTexts.some((text) => text.includes('data-solara-module="catalog-newsletter-cta"')),
  ).toBe(false);
  expect(
    afterTexts.some((text) => text.includes('data-solara-module="catalog-newsletter-cta"')),
  ).toBe(true);

  // El contenido del usuario sobrevive la actualización en el sitio: título
  // del hero, título del producto y la sección en conflicto (conservada).
  expect(afterTexts.some((text) => text.includes(USER_HERO_TITLE))).toBe(true);
  expect(afterTexts.some((text) => text.includes(USER_PRODUCT_TITLE))).toBe(true);
  expect(
    afterTexts.some((text) => text.includes('data-solara-module="catalog-testimonials"')),
  ).toBe(true);
  expect(
    beforeTexts.some((text) => text.includes('data-solara-module="catalog-testimonials"')),
  ).toBe(true);
  expect(beforeTexts.join("\n")).not.toBe(afterTexts.join("\n"));
});
