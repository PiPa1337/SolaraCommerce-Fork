/**
 * Auditoría Preparar PR5 (2026-08-11) — Modo avanzado y protección de
 * estructura. Contrato de 4 capas (plan docs/superpowers/plans/2026-08-10-auditoria-preparar.md):
 * - funcional: "Modo avanzado" de Preparar navega al Constructor con la
 *   estructura desprotegida (tab aria-selected, banner "estructura protegida"
 *   fuera, "Agregar sección" habilitado); volver a Preparar resetea el modo y
 *   el Constructor vuelve a proteger la base (contrato F13);
 * - auto-feedback: el estado del modo avanzado NO tiene indicador propio
 *   (el botón de Preparar no expone aria-pressed ni ningún estado); la única
 *   señal visible es la descripción del Constructor;
 * - datos: la protección se deriva de `origin.seed === "clean"` + modo;
 *   la tienda demo nunca queda protegida; la edición de contenido del
 *   inspector sigue operativa bajo protección;
 * - utilidad: el modo avanzado habilita toda la matriz que la protección
 *   bloquea (agregar, mover, ocultar, duplicar, eliminar, reemplazar módulo y
 *   restaurar defaults), y el checklist guiado de Inicio también desprotege
 *   (mismo camino navigateFromGuided).
 */
import type { Server } from "node:http";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 150_000 : 90_000);

const DEMO_PROJECT_ID = "store-modo-sur-demo";
const PROTECTED_DESCRIPTION = "estructura base está protegida";
const UNPROTECTED_DESCRIPTION = "Ordená secciones y cambiá su módulo";
const HERO_ROW_TEXT = "Hero de catálogo";
const CLEAN_SECTION_COUNT = 11;
/** Default del módulo catalog-hero: "Restaurar valores por defecto" restaura
 *  los defaults del módulo, no los textos de la plantilla limpia. */
const MODULE_DEFAULT_HERO_TITLE = "Vestite con lo que te representa.";

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

async function setupCleanStore(page: Page, name: string): Promise<void> {
  await resetIndexedDb(page);
  await createCleanStore(page, name);
}

async function openDemoStore(page: Page): Promise<void> {
  await resetIndexedDb(page);
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

async function openConstructorTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
}

function heroRow(page: Page): Locator {
  return page.locator(".section-row").filter({ hasText: HERO_ROW_TEXT }).first();
}

function sectionModuleNames(page: Page): Promise<string[]> {
  return page.locator(".section-row .section-select strong").allTextContents();
}

/** Lee el título de una sección desde IndexedDB (contrato de datos). */
async function readSectionTitle(page: Page, storeName: string, sectionId: string): Promise<string> {
  return page.evaluate(
    ([name, id]) =>
      new Promise<string>((resolve, reject) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const db = request.result;
          const all = db.transaction("projects").objectStore("projects").getAll();
          all.addEventListener("success", () => {
            const records = all.result as Array<{
              name: string;
              project: { sections: Array<{ id: string; settings: Record<string, unknown> }> };
            }>;
            const record = records.find((item) => item.name === name);
            const section = record?.project.sections.find((candidate) => candidate.id === id);
            resolve(typeof section?.settings.title === "string" ? section.settings.title : "");
          });
          all.addEventListener("error", () => reject(all.error));
        });
      }),
    [storeName, sectionId],
  );
}

test("Modo avanzado desde Preparar navega al Constructor con la estructura desprotegida (tab aria-selected, banner fuera)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda PR5 avanzado");
  await openPrepararTab(page);

  await page.getByRole("button", { name: "Modo avanzado" }).click();

  // El tab Constructor queda seleccionado y el banner protegido desaparece.
  await expect(page.getByRole("tab", { name: "Constructor", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  await expect(page.getByText(UNPROTECTED_DESCRIPTION)).toBeVisible();
  await expect(page.getByText(PROTECTED_DESCRIPTION)).toHaveCount(0);

  // Estructura desbloqueada: agregar, mover, ocultar, duplicar, eliminar,
  // reemplazar módulo y restaurar defaults.
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeEnabled();
  await expect(heroRow(page).getByRole("button", { name: "Mover arriba" })).toBeEnabled();
  await expect(heroRow(page).getByRole("button", { name: "Mover abajo" })).toBeEnabled();
  await expect(heroRow(page).getByRole("button", { name: "Ocultar sección" })).toBeEnabled();
  await expect(heroRow(page).getByRole("button", { name: "Duplicar sección" })).toBeEnabled();
  await expect(heroRow(page).getByRole("button", { name: "Eliminar sección" })).toBeEnabled();
  await expect(page.getByLabel("Módulo")).toBeEnabled();
  await expect(page.getByTestId("ui-restore-defaults")).toBeEnabled();
});

test("volver a Preparar resetea el modo: el Constructor vuelve a proteger la base y el botón no indica estado", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda PR5 vuelta");
  await openPrepararTab(page);
  await page.getByRole("button", { name: "Modo avanzado" }).click();
  await expect(page.getByText(UNPROTECTED_DESCRIPTION)).toBeVisible();

  // Vuelta a Preparar: el modo se resetea (selectTab("guided")), y entrar al
  // Constructor por la pestaña vuelve a dejar la estructura protegida.
  await openPrepararTab(page);
  const advancedButton = page.getByRole("button", { name: "Modo avanzado" });
  // Auto-feedback: el botón no expone ningún estado (sin aria-pressed ni
  // marca): el modo es invisible salvo por la descripción del Constructor.
  expect(await advancedButton.getAttribute("aria-pressed")).toBeNull();

  await openConstructorTab(page);
  await expect(page.getByText(PROTECTED_DESCRIPTION)).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeDisabled();
  await expect(heroRow(page).getByRole("button", { name: "Mover abajo" })).toBeDisabled();

  // El checklist guiado de Inicio desprotege por el mismo camino que el botón
  // (navigateFromGuided): un requisito del hero navega al Constructor con la
  // estructura editable.
  await openPrepararTab(page);
  const homeRequirement = page
    .getByTestId("ui-guided-requirement")
    .filter({ hasText: "Inicio ·" })
    .first();
  await homeRequirement.getByRole("button", { name: /^Editar / }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  await expect(page.getByText(PROTECTED_DESCRIPTION)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeEnabled();

  // El ciclo completo se puede repetir: volver a Preparar re-protege.
  await openPrepararTab(page);
  await openConstructorTab(page);
  await expect(page.getByText(PROTECTED_DESCRIPTION)).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeDisabled();
});

test("tienda limpia sin modo avanzado: la protección bloquea la estructura pero deja editar el contenido", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda PR5 protegida");
  await openConstructorTab(page);

  await expect(page.getByText(PROTECTED_DESCRIPTION)).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeDisabled();

  // Secciones base protegidas: sin mover, ocultar, duplicar ni eliminar.
  await expect(heroRow(page).getByRole("button", { name: "Mover arriba" })).toBeDisabled();
  await expect(heroRow(page).getByRole("button", { name: "Mover abajo" })).toBeDisabled();
  await expect(heroRow(page).getByRole("button", { name: "Ocultar sección" })).toBeDisabled();
  await expect(heroRow(page).getByRole("button", { name: "Duplicar sección" })).toBeDisabled();
  await expect(heroRow(page).getByRole("button", { name: "Eliminar sección" })).toBeDisabled();
  await expect(page.getByLabel("Módulo")).toBeDisabled();
  await expect(page.getByTestId("ui-restore-defaults")).toBeDisabled();

  // El contenido NO está protegido: el título del hero se edita y persiste.
  await heroRow(page).locator(".section-select").click();
  const titleInput = page.getByLabel("Título", { exact: true });
  await expect(titleInput).toBeEnabled();
  await titleInput.fill("Título editado bajo protección");

  // Datos: el autosave commitea el título al proyecto en IndexedDB.
  await expect
    .poll(async () => readSectionTitle(page, "Tienda PR5 protegida", "modo-section-hero"), {
      timeout: 15_000,
    })
    .toBe("Título editado bajo protección");

  await openPrepararTab(page);
  await openConstructorTab(page);
  await heroRow(page).locator(".section-select").click();
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue(
    "Título editado bajo protección",
  );
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeDisabled();
});

test("utilidad: el modo avanzado habilita toda la matriz que la protección bloquea", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda PR5 matriz");
  await openPrepararTab(page);
  await page.getByRole("button", { name: "Modo avanzado" }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();

  expect(await sectionModuleNames(page)).toHaveLength(CLEAN_SECTION_COUNT);

  // Agregar sección: picker con módulo compatible de contenido. (El nombre de
  // la sección agregada coincide con la sección base de Marcas; las aserciones
  // posteriores usan posición para no confundirlas.)
  await page.getByRole("button", { name: "Agregar sección" }).click();
  await expect(page.getByTestId("ui-module-picker")).toBeVisible();
  await page.getByTestId("ui-module-search").fill("Franja");
  await page.getByTestId("ui-module-option").filter({ hasText: "Franja de marcas" }).click();
  await expect(page.getByTestId("ui-module-picker")).toHaveCount(0);
  expect(await sectionModuleNames(page)).toHaveLength(CLEAN_SECTION_COUNT + 1);

  // Seleccionar el hero para editar su estructura y contenido.
  await heroRow(page).locator(".section-select").click();

  // Mover: el hero pasa de la posición 2 a la 3 (intercambia con Marcas).
  const beforeMove = await sectionModuleNames(page);
  expect(beforeMove[2]).toBe(HERO_ROW_TEXT);
  await heroRow(page).getByRole("button", { name: "Mover abajo" }).click();
  const afterMove = await sectionModuleNames(page);
  expect(afterMove[3]).toBe(HERO_ROW_TEXT);
  expect(afterMove[2]).toBe("Franja de marcas");

  // Ocultar y volver a mostrar la sección base.
  await heroRow(page).getByRole("button", { name: "Ocultar sección" }).click();
  await expect(heroRow(page).getByRole("button", { name: "Mostrar sección" })).toBeVisible();
  await heroRow(page).getByRole("button", { name: "Mostrar sección" }).click();
  await expect(heroRow(page).getByRole("button", { name: "Ocultar sección" })).toBeVisible();

  // Reemplazar módulo (estructura) y volver al original: el hero sólo ofrece
  // su propio módulo (los legacy son compatibility-only), así que se prueba
  // sobre la sección de Marcas (posición 2 tras el movimiento del hero), que
  // acepta módulos de contenido. La posición es estable y evita confundir la
  // sección agregada (que también se llama "Franja de marcas").
  const brandsRow = page.locator(".section-row").nth(2);
  await brandsRow.locator(".section-select").click();
  await page.getByLabel("Módulo").selectOption({ label: "Mosaico de categorías" });
  await expect(brandsRow.locator(".section-select strong")).toHaveText("Mosaico de categorías");
  await page.getByLabel("Módulo").selectOption({ label: "Franja de marcas" });
  await expect(brandsRow.locator(".section-select strong")).toHaveText("Franja de marcas");

  // Restaurar valores por defecto: el título editado vuelve a los defaults
  // del módulo (no a los textos de la plantilla limpia).
  await heroRow(page).locator(".section-select").click();
  await page.getByLabel("Título", { exact: true }).fill("Título PR5 antes de restaurar");
  await page.getByTestId("ui-restore-defaults").click();
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue(MODULE_DEFAULT_HERO_TITLE);

  // Duplicar la sección base.
  await heroRow(page).getByRole("button", { name: "Duplicar sección" }).click();
  expect(await sectionModuleNames(page)).toHaveLength(CLEAN_SECTION_COUNT + 2);

  // Eliminar: primero la sección agregada y después la duplicada; la tienda
  // vuelve a la línea base sin pérdidas.
  await page
    .locator(".section-row")
    .last()
    .getByRole("button", { name: "Eliminar sección" })
    .click();
  expect(await sectionModuleNames(page)).toHaveLength(CLEAN_SECTION_COUNT + 1);
  await page
    .locator(".section-row")
    .nth(4)
    .getByRole("button", { name: "Eliminar sección" })
    .click();
  expect(await sectionModuleNames(page)).toHaveLength(CLEAN_SECTION_COUNT);
  await heroRow(page).locator(".section-select").click();
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue(MODULE_DEFAULT_HERO_TITLE);
});

test("la tienda demo nunca queda protegida: el modo avanzado no cambia nada observable", async ({
  page,
}) => {
  await openDemoStore(page);
  await openConstructorTab(page);

  // seed=demo → protectedBase siempre false: sin banner y sin bloqueos.
  await expect(page.getByText(PROTECTED_DESCRIPTION)).toHaveCount(0);
  await expect(page.getByText(UNPROTECTED_DESCRIPTION)).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeEnabled();

  await openPrepararTab(page);
  await page.getByRole("button", { name: "Modo avanzado" }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeEnabled();
  await expect(page.getByText(PROTECTED_DESCRIPTION)).toHaveCount(0);
});
