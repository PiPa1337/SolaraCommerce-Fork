/**
 * F2 — Shell del Studio: regresiones de los hallazgos H3.
 * 1. El punto de sucio aparece con UN solo cambio (la marca se limpiaba en el
 *    mismo commit del cambio, antes del aviso "Cambios pendientes").
 * 2. El scroll del panel se conserva al cambiar de pestaña (sin remount).
 * 3. El panel cerrado no se reabre al cambiar de pestaña.
 * 4. Ctrl+S fuerza el guardado en modo navegador (flush del autosave).
 * 5. Ctrl+Z / Ctrl+Shift+Z deshacen/rehacen el proyecto fuera de campos de
 *    texto, y no secuestran el undo nativo dentro de un campo.
 * 6. La base protegida es alcanzable en tiendas limpias (banner + bloqueo de
 *    "Agregar sección"), y el Modo avanzado la desactiva.
 */
import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 120_000 : 90_000);

// El reloj del test arranca en una hora fija y se pausa más adelante: los
// timers del autosave (550 ms) dejan de depender del reloj real.
const FAKE_START = new Date("2026-08-10T08:00:00");
const FAKE_PAUSE = new Date("2026-08-10T08:30:00");

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

async function wipeIndexedDb(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.addEventListener("success", () => resolve());
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("blocked", () =>
          reject(new Error("No se pudo limpiar la base de Studio.")),
        );
      }),
  );
}

async function openDemoStore(page: Page): Promise<void> {
  await page.goto(studioUrl);
  await wipeIndexedDb(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
}

/** Selecciona la sección Hero en el Constructor de la tienda demo. */
async function openHeroInspector(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  const hero = page.getByRole("listitem").filter({ hasText: "Hero de catálogo" });
  await hero.getByRole("button").first().click();
  await expect(page.getByRole("textbox", { name: "Título", exact: true })).toBeVisible();
}

test("el punto de sucio aparece con un único cambio y se limpia al guardar (H3-B1)", async ({
  page,
}) => {
  // Reloj congelado tras el boot: el debounce del autosave (550 ms) no corre
  // solo; el test decide cuándo avanza el tiempo y la ventana del punto deja
  // de ser una carrera contra el reloj real.
  await page.clock.install({ time: FAKE_START });
  await openDemoStore(page);
  await openHeroInspector(page);
  await page.clock.pauseAt(FAKE_PAUSE);

  const title = page.getByRole("textbox", { name: "Título", exact: true });
  await title.fill("Cambio único");
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();

  // Constructor y Resumen quedaron visitados en el commit del cambio; las
  // otras 6 pestañas tienen el punto.
  await expect(page.getByTestId("ui-tab-dirty")).toHaveCount(6);

  await page.clock.runFor(1_000);
  await expect(page.getByText(/^Guardado \d{2}:\d{2}$/)).toBeVisible();
  await expect(page.getByTestId("ui-tab-dirty")).toHaveCount(0);
});

test("el scroll del panel se conserva al cambiar de pestaña (H3-B2)", async ({ page }) => {
  await openDemoStore(page);
  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catálogo", exact: true })).toBeVisible();

  const pane = page.locator("[data-studio-editor-pane]");
  await pane.evaluate((element) => {
    element.scrollTop = 600;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await expect.poll(() => pane.evaluate((element) => element.scrollTop)).toBe(600);

  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catálogo", exact: true })).toBeVisible();
  await expect.poll(() => pane.evaluate((element) => element.scrollTop)).toBe(600);
});

test("el panel cerrado no se reabre al cambiar de pestaña (H3-B3)", async ({ page }) => {
  await openDemoStore(page);
  const pane = page.locator("[data-studio-editor-pane]");

  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await expect(pane).toHaveClass(/editor-pane--open/);

  await page.getByRole("button", { name: "Cerrar panel de edición" }).click();
  await expect(pane).toHaveClass(/editor-pane--closed/);
  await expect(pane).toHaveAttribute("aria-hidden", "true");

  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(pane).toHaveClass(/editor-pane--closed/);
  await expect(pane).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByRole("button", { name: "Abrir panel de edición" })).toBeVisible();

  const stored = await page.evaluate(() =>
    localStorage.getItem("solara-editor-pane:store-modo-sur-demo"),
  );
  expect(stored).toBe("closed");
});

test("Ctrl+S fuerza el guardado en modo navegador (H3-B4)", async ({ page }) => {
  await page.clock.install({ time: FAKE_START });
  await openDemoStore(page);
  await openHeroInspector(page);
  await page.clock.pauseAt(FAKE_PAUSE);

  const title = page.getByRole("textbox", { name: "Título", exact: true });
  await title.fill("Cambio para Ctrl+S");
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();

  await page.keyboard.press("Control+s");
  await expect(page.getByText(/^Guardado \d{2}:\d{2}$/)).toBeVisible();
  await expect(page.getByText("Cambios pendientes", { exact: true })).toHaveCount(0);
});

test("Ctrl+Z deshace un cambio de catálogo y Ctrl+Shift+Z lo rehace (H3-B5)", async ({ page }) => {
  await page.clock.install({ time: FAKE_START });
  await openDemoStore(page);
  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catálogo", exact: true })).toBeVisible();
  await page.clock.pauseAt(FAKE_PAUSE);

  const statusTrigger = page.getByTestId("ui-status-edit-trigger").first();
  const initialLabel = (await statusTrigger.textContent())?.trim() ?? "";
  expect(initialLabel).not.toBe("");

  await statusTrigger.click();
  const statusSelect = page.getByTestId("ui-status-edit").first();
  const other = initialLabel === "Activo" ? "hidden" : "active";
  await statusSelect.selectOption(other);
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();
  await expect(statusTrigger).toContainText(initialLabel === "Activo" ? "Oculto" : "Activo");

  await page.keyboard.press("Control+z");
  await expect(statusTrigger).toContainText(initialLabel);

  await page.keyboard.press("Control+Shift+z");
  await expect(statusTrigger).toContainText(initialLabel === "Activo" ? "Oculto" : "Activo");
});

test("Ctrl+Z dentro de un campo de texto deja el undo nativo (H3-B5)", async ({ page }) => {
  await openDemoStore(page);
  await openHeroInspector(page);

  const undoButton = page.getByRole("button", { name: "Deshacer" });
  await expect(undoButton).toBeDisabled();

  const title = page.getByRole("textbox", { name: "Título", exact: true });
  await title.fill("Texto con historial");
  await expect(page.getByRole("button", { name: "Deshacer" })).toBeEnabled();

  // Con el foco dentro del input, Ctrl+Z no debe consumir el historial del
  // editor (el undo nativo del navegador actúa sobre el campo).
  await page.keyboard.press("Control+z");
  await expect(page.getByRole("button", { name: "Deshacer" })).toBeEnabled();
});

test("la estructura protegida es alcanzable en una tienda limpia (F13)", async ({ page }) => {
  await page.goto(studioUrl);
  await wipeIndexedDb(page);
  await page.reload();
  await createCleanStore(page, "Tienda limpia");

  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  await expect(page.getByText(/estructura base está protegida/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar sección", exact: true })).toBeDisabled();

  // El Modo avanzado (desde Preparar) sigue siendo la puerta para editar la
  // estructura: el banner desaparece y "Agregar sección" se habilita.
  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();
  await page.getByRole("button", { name: "Modo avanzado", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  await expect(page.getByText(/estructura base está protegida/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agregar sección", exact: true })).toBeEnabled();
});

test("la tienda demo no protege la estructura", async ({ page }) => {
  await openDemoStore(page);
  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  await expect(page.getByText(/estructura base está protegida/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agregar sección", exact: true })).toBeEnabled();
});
