/**
 * Auditoría Preparar PR5 (2026-08-11) — Modo avanzado y protección de
 * estructura. Contrato de 4 capas (plan docs/superpowers/plans/2026-08-10-auditoria-preparar.md,
 * fix Ola 3 por contrato PT4 Opción A):
 * - funcional: "Modo avanzado" de Preparar es un toggle (aria-pressed + label
 *   "Modo avanzado activado") que navega al Constructor con la estructura
 *   desprotegida (tab aria-selected, banner "estructura protegida" fuera,
 *   "Agregar sección" habilitado); el modo PERSISTE entre Preparar y
 *   Constructor en la sesión (no hay reset asimétrico) y es reversible desde
 *   el mismo toggle; el banner protegido del Constructor es accionable con el
 *   botón "Desbloquear" (PR5-F1/PT4-Q3);
 * - auto-feedback: el toggle expone aria-pressed y cambia de label; el
 *   Constructor muestra el indicador "Modo avanzado activado" (PR5-F1);
 * - datos: la protección se deriva de `origin.seed === "clean"` + modo;
 *   la tienda demo nunca queda protegida; la edición de contenido del
 *   inspector sigue operativa bajo protección;
 * - utilidad: el modo avanzado habilita toda la matriz que la protección
 *   bloquea (agregar, mover, ocultar, duplicar, eliminar, reemplazar módulo y
 *   restaurar defaults), y el checklist guiado de Inicio también desprotege
 *   (mismo camino navigateFromGuided).
 * El modo es sesión-only: nace en false al abrir la tienda y no sobrevive a
 * recargas (documentado en Studio.tsx).
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

test("Modo avanzado desde Preparar navega al Constructor con la estructura desprotegida (toggle accesible, tab aria-selected, banner fuera)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda PR5 avanzado");
  await openPrepararTab(page);

  // Auto-feedback: el toggle de Preparar expone su estado (PR5-F1).
  const advancedButton = page.getByRole("button", { name: "Modo avanzado" });
  await expect(advancedButton).toHaveAttribute("aria-pressed", "false");
  await advancedButton.click();

  // El tab Constructor queda seleccionado y el banner protegido desaparece.
  await expect(page.getByRole("tab", { name: "Constructor", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  await expect(page.getByText(UNPROTECTED_DESCRIPTION)).toBeVisible();
  await expect(page.getByText(PROTECTED_DESCRIPTION)).toHaveCount(0);

  // Auto-feedback: el Constructor indica el modo activo (PR5-F1).
  await expect(
    page.getByRole("status").filter({ hasText: "Modo avanzado activado" }),
  ).toBeVisible();

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

test("el modo persiste entre Preparar y Constructor en la sesión: toggle accesible, banner accionable y reversible", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda PR5 vuelta");

  // Preparar la condición del recorrido desde la UI: el título del hero queda
  // pendiente para que el botón guiado tenga un destino de Constructor real.
  await openConstructorTab(page);
  await heroRow(page).locator(".section-select").click();
  await page.getByLabel("Título", { exact: true }).first().fill("");
  await page.getByLabel("Título", { exact: true }).first().blur();
  await page
    .locator(".section-row .section-select")
    .filter({ hasText: "Barra informativa moderna" })
    .click();
  await openPrepararTab(page);
  const advancedButton = page.getByRole("button", { name: "Modo avanzado" });
  await expect(advancedButton).toHaveAttribute("aria-pressed", "false");
  await advancedButton.click();
  await expect(page.getByText(UNPROTECTED_DESCRIPTION)).toBeVisible();

  // Contrato PT4 Opción A: volver a Preparar NO resetea el modo (no hay
  // reset asimétrico); el toggle refleja el estado activo con label propio.
  await openPrepararTab(page);
  const activeButton = page.getByRole("button", { name: "Modo avanzado activado" });
  await expect(activeButton).toHaveAttribute("aria-pressed", "true");

  // Entrar al Constructor por la pestaña conserva la desprotección.
  await openConstructorTab(page);
  await expect(page.getByText(UNPROTECTED_DESCRIPTION)).toBeVisible();
  await expect(page.getByText(PROTECTED_DESCRIPTION)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeEnabled();

  // El toggle permite volver a proteger desde Preparar (reversible in situ).
  await openPrepararTab(page);
  await activeButton.click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  await expect(page.getByText(PROTECTED_DESCRIPTION)).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeDisabled();

  // El checklist guiado de Inicio desprotege por el mismo camino que el botón
  // (navigateFromGuided): un requisito del hero navega al Constructor con la
  // estructura editable.
  await openPrepararTab(page);
  const homeRequirement = page.getByTestId("ui-guided-requirement").filter({
    hasText: "Título principal",
  });
  await homeRequirement.getByRole("button", { name: /^Editar / }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  await expect(page.getByText(PROTECTED_DESCRIPTION)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeEnabled();

  // El modo sigue activo tras el ciclo completo (persistencia de sesión).
  await openPrepararTab(page);
  await expect(page.getByRole("button", { name: "Modo avanzado activado" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
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
  await expect(page.getByLabel("Título", { exact: true }).first()).toHaveValue(
    "Título editado bajo protección",
  );
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeDisabled();
});

test("Desbloquear activa el modo avanzado desde el Constructor protegido", async ({ page }) => {
  await setupCleanStore(page, "Tienda PR5 desbloquear");
  await openConstructorTab(page);

  const unlock = page.getByRole("button", { name: "Desbloquear", exact: true });
  await expect(page.getByText(PROTECTED_DESCRIPTION)).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeDisabled();
  await expect(unlock).toBeVisible();

  await unlock.click();

  await expect(page.getByText(PROTECTED_DESCRIPTION)).toHaveCount(0);
  await expect(page.getByText(UNPROTECTED_DESCRIPTION)).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeEnabled();
  await expect(
    page.getByRole("status").filter({ hasText: "Modo avanzado activado" }),
  ).toBeVisible();
  await expect(unlock).toHaveCount(0);
});

test("utilidad: el modo avanzado habilita toda la matriz que la protección bloquea", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda PR5 matriz");
  await openPrepararTab(page);
  await page.getByRole("button", { name: "Modo avanzado" }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();

  const cleanSectionCount = (await sectionModuleNames(page)).length;
  expect(cleanSectionCount).toBeGreaterThan(0);

  // Agregar sección: picker con módulo compatible de contenido. (El nombre de
  // la sección agregada coincide con la sección base de Marcas; las aserciones
  // posteriores usan posición para no confundirlas.)
  await page.getByRole("button", { name: "Agregar sección" }).click();
  await expect(page.getByTestId("ui-module-picker")).toBeVisible();
  await page.getByTestId("ui-module-search").fill("Franja");
  await page.getByTestId("ui-module-option").filter({ hasText: "Franja de marcas" }).click();
  await expect(page.getByTestId("ui-module-picker")).toHaveCount(0);
  await expect.poll(() => sectionModuleNames(page)).toHaveLength(cleanSectionCount + 1);

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
  const moduleSelect = page.getByLabel("Módulo");
  await moduleSelect.selectOption({ label: "Mosaico de categorías" });
  const replaceDialog = page.getByRole("dialog", { name: "Cambiar módulo de sección" });
  await expect(replaceDialog).toBeVisible();
  await expect(replaceDialog.locator(".confirm-dialog__body")).toContainText(
    "Mosaico de categorías",
  );
  await replaceDialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(moduleSelect).toHaveValue("catalog-brand-strip");
  await expect(brandsRow.locator(".section-select strong")).toHaveText("Franja de marcas");

  await moduleSelect.selectOption({ label: "Mosaico de categorías" });
  await page
    .getByRole("dialog", { name: "Cambiar módulo de sección" })
    .getByRole("button", { name: "Cambiar módulo", exact: true })
    .click();
  await expect(moduleSelect).toHaveValue("catalog-category-bento");
  await expect(brandsRow.locator(".section-select strong")).toHaveText("Mosaico de categorías");
  await moduleSelect.selectOption({ label: "Franja de marcas" });
  await page
    .getByRole("dialog", { name: "Cambiar módulo de sección" })
    .getByRole("button", { name: "Cambiar módulo", exact: true })
    .click();
  await expect(moduleSelect).toHaveValue("catalog-brand-strip");
  await expect(brandsRow.locator(".section-select strong")).toHaveText("Franja de marcas");

  // Restaurar valores por defecto: el título editado vuelve a los defaults
  // del módulo (no a los textos de la plantilla limpia).
  await heroRow(page).locator(".section-select").click();
  await page.getByLabel("Título", { exact: true }).fill("Título PR5 antes de restaurar");
  await page.getByTestId("ui-restore-defaults").click();
  await expect(page.getByRole("dialog", { name: "Restaurar valores por defecto" })).toBeVisible();
  await page
    .getByRole("dialog", { name: "Restaurar valores por defecto" })
    .getByRole("button", { name: "Restaurar valores", exact: true })
    .click();
  await expect(page.getByLabel("Título", { exact: true }).first()).toHaveValue(
    MODULE_DEFAULT_HERO_TITLE,
  );

  // Duplicar la sección base.
  await heroRow(page).getByRole("button", { name: "Duplicar sección" }).click();
  expect(await sectionModuleNames(page)).toHaveLength(cleanSectionCount + 2);

  // Eliminar: primero la sección agregada y después la duplicada; la tienda
  // vuelve a la línea base sin pérdidas.
  await page
    .locator(".section-row")
    .last()
    .getByRole("button", { name: "Eliminar sección" })
    .click();
  await page
    .getByTestId("ui-confirm-dialog")
    .getByRole("button", { name: "Eliminar sección", exact: true })
    .click();
  expect(await sectionModuleNames(page)).toHaveLength(cleanSectionCount + 1);
  await page
    .locator(".section-row")
    .nth(4)
    .getByRole("button", { name: "Eliminar sección" })
    .click();
  await page
    .getByTestId("ui-confirm-dialog")
    .getByRole("button", { name: "Eliminar sección", exact: true })
    .click();
  await expect.poll(() => sectionModuleNames(page)).toHaveLength(cleanSectionCount);
  await heroRow(page).locator(".section-select").click();
  await expect(page.getByLabel("Título", { exact: true }).first()).toHaveValue(
    MODULE_DEFAULT_HERO_TITLE,
  );
});

test("la plantilla Predeterminado permanece protegida aunque se active el modo avanzado", async ({
  page,
}) => {
  await openDemoStore(page);
  await openConstructorTab(page);

  // Predeterminado es la plantilla base protegida; las pruebas mutables usan
  // una copia o una tienda nueva.
  await expect(page.getByText(PROTECTED_DESCRIPTION)).toBeVisible();
  await expect(page.getByText(UNPROTECTED_DESCRIPTION)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeDisabled();

  await openPrepararTab(page);
  await page.getByRole("button", { name: "Modo avanzado" }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar sección" })).toBeDisabled();
  await expect(page.getByText(PROTECTED_DESCRIPTION)).toBeVisible();
});
