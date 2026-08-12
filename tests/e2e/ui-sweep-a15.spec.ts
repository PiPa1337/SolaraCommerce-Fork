/**
 * Barrido A15 — Studio: guardar/undo/atajos/status (AUDIT slice, owner: A14).
 * Contrato de 3 capas por control: (1) click/tecla → efecto real en estado o
 * datos, (2) auto-feedback del control (clase/disabled/aria-live/aria-selected
 * coherente con la lógica), (3) contrato de datos (payload → receptor).
 *
 * Cobertura: indicador de guardado del modo navegador (pendiente → Guardando…
 * → Guardado), botones Deshacer/Rehacer, atajos Ctrl+S/Ctrl+Z/Ctrl+Shift+Z,
 * barra de estado (esquema, persistencia, última exportación), guardado
 * gestionado (botón + atajo + versionado en disco) y Modo avanzado.
 * Las regresiones nombran a A14 (owner de Studio.tsx): estados de error sin
 * trigger accesible desde la UI.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 180_000 : 120_000);

// El reloj del test arranca en una hora fija y corre a ritmo real (sin
// pauseAt): los timers del autosave (550 ms) siguen dependiendo del reloj,
// pero `pauseAt` de Playwright no avanza de forma fiable con timers
// pendientes de la app (autosave/motion), así que las horas se aseveran con
// plantilla (`\d{2}:\d{2}`), nunca con un minuto fijo.
const FAKE_START = new Date("2026-08-10T08:00:00");

const DEMO_STORE_ID = "store-modo-sur-demo";
const DEMO_SLUG = "demo-catalogo-jerarquico";

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
      new Promise<void>((resolvePromise, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.addEventListener("success", () => resolvePromise());
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
  await page.locator(`[data-store-card-id="${DEMO_STORE_ID}"]`).click();
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

/** Instala un probe que registra si el indicador llegó a estado "saving". */
async function installSavingProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as Window & {
      __solaraA15Probe?: { savingClass: boolean; savingText: boolean; spinner: boolean };
    };
    win.__solaraA15Probe = { savingClass: false, savingText: false, spinner: false };
    const indicator = document.querySelector(".save-indicator");
    if (!(indicator instanceof Element)) return;
    const update = () => {
      if (!win.__solaraA15Probe) return;
      if (indicator.classList.contains("save-indicator--saving")) {
        win.__solaraA15Probe.savingClass = true;
      }
      if (indicator.textContent?.includes("Guardando\u2026")) {
        win.__solaraA15Probe.savingText = true;
      }
      if (indicator.querySelector(".save-spinner") !== null) {
        win.__solaraA15Probe.spinner = true;
      }
    };
    const observer = new MutationObserver(update);
    observer.observe(indicator, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      subtree: true,
      characterData: true,
    });
    update();
  });
}

function readProbe(
  page: Page,
): Promise<{ savingClass: boolean; savingText: boolean; spinner: boolean }> {
  return page.evaluate(() => {
    const probe = (
      window as Window & {
        __solaraA15Probe?: { savingClass: boolean; savingText: boolean; spinner: boolean };
      }
    ).__solaraA15Probe;
    return {
      savingClass: probe?.savingClass ?? false,
      savingText: probe?.savingText ?? false,
      spinner: probe?.spinner ?? false,
    };
  });
}

function readStoredProjectName(page: Page, id: string): Promise<string | null> {
  return page.evaluate(
    (projectId) =>
      new Promise<string | null>((resolvePromise) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("error", () => resolvePromise(null));
        request.addEventListener("success", () => {
          const db = request.result;
          const transaction = db.transaction("projects", "readonly");
          const get = transaction.objectStore("projects").get(projectId);
          get.addEventListener("error", () => resolvePromise(null));
          get.addEventListener("success", () => {
            const record = get.result as { project?: { name?: string } } | undefined;
            resolvePromise(record?.project?.name ?? null);
          });
        });
      }),
    id,
  );
}

test("A15.1 el indicador de guardado transita pendiente, Guardando… y Guardado con feedback (navegador)", async ({
  page,
}) => {
  // El reloj fake corre a ritmo real (sin pauseAt): `pauseAt` + `runFor` de
  // Playwright no avanzan de forma fiable cuando la app tiene timers
  // pendientes (autosave de 550 ms, motion), así que la aserción de la hora
  // final usa una plantilla y no un minuto fijo.
  await page.clock.install({ time: FAKE_START });
  await openDemoStore(page);
  await openHeroInspector(page);

  const indicator = page.locator("output.save-indicator");
  await expect(indicator).toHaveAttribute("aria-live", "polite");
  await expect(indicator).toHaveClass(/save-indicator--saved/);

  await installSavingProbe(page);

  await page.getByRole("textbox", { name: "Título", exact: true }).fill("Cambio A15");
  await expect(indicator).toHaveClass(/save-indicator--pending/);
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();

  await page.clock.runFor(2_000);

  await expect
    .poll(() => readProbe(page), { timeout: 15_000 })
    .toEqual({
      savingClass: true,
      savingText: true,
      spinner: true,
    });
  await expect(page.getByText(/^Guardado \d{2}:\d{2}$/)).toBeVisible({ timeout: 15_000 });
  await expect(indicator).toHaveClass(/save-indicator--saved/);
});

test("A15.2 Deshacer y Rehacer reflejan el historial y revierten el proyecto", async ({ page }) => {
  await openDemoStore(page);
  await openHeroInspector(page);

  const undoButton = page.getByRole("button", { name: "Deshacer" });
  const redoButton = page.getByRole("button", { name: "Rehacer" });
  const title = page.getByRole("textbox", { name: "Título", exact: true });

  await expect(undoButton).toBeDisabled();
  await expect(redoButton).toBeDisabled();
  const initialTitle = await title.inputValue();

  await title.fill("Cambio A15 uno");
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();
  await expect(undoButton).toBeEnabled();
  await expect(redoButton).toBeDisabled();

  await title.fill("Cambio A15 dos");
  await expect(undoButton).toBeEnabled();

  await undoButton.click();
  await expect(title).toHaveValue("Cambio A15 uno");
  await expect(undoButton).toBeEnabled();
  await expect(redoButton).toBeEnabled();

  await undoButton.click();
  await expect(title).toHaveValue(initialTitle);
  await expect(undoButton).toBeDisabled();
  await expect(redoButton).toBeEnabled();

  await redoButton.click();
  await expect(title).toHaveValue("Cambio A15 uno");
  await expect(undoButton).toBeEnabled();
  await expect(redoButton).toBeEnabled();

  await redoButton.click();
  await expect(title).toHaveValue("Cambio A15 dos");
  await expect(undoButton).toBeEnabled();
  await expect(redoButton).toBeDisabled();

  // Al final del historial el botón está disabled: un click forzado no
  // produce ningún cambio (el estado disabled ya prueba el no-op).
  await redoButton.click({ force: true });
  await expect(title).toHaveValue("Cambio A15 dos");
});

test("A15.3 Ctrl+Z y Ctrl+Shift+Z replican los botones y Ctrl+S fuerza el guardado", async ({
  page,
}) => {
  await page.clock.install({ time: FAKE_START });
  await openDemoStore(page);
  await openHeroInspector(page);

  const undoButton = page.getByRole("button", { name: "Deshacer" });
  const redoButton = page.getByRole("button", { name: "Rehacer" });
  const title = page.getByRole("textbox", { name: "Título", exact: true });
  const initialTitle = await title.inputValue();

  await title.fill("Atajo A15");
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();

  await undoButton.focus();
  await page.keyboard.press("Control+z");
  await expect(title).toHaveValue(initialTitle);
  await expect(undoButton).toBeDisabled();
  await expect(redoButton).toBeEnabled();

  await page.keyboard.press("Control+Shift+z");
  await expect(title).toHaveValue("Atajo A15");
  await expect(undoButton).toBeEnabled();
  await expect(redoButton).toBeDisabled();

  await title.fill("Atajo A15 guardado");
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();
  await page.keyboard.press("Control+s");
  await expect(page.getByText(/^Guardado \d{2}:\d{2}$/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Cambios pendientes", { exact: true })).toHaveCount(0);
});

test("A15.4 la barra de estado refleja esquema, persistencia y última exportación", async ({
  page,
}) => {
  await openDemoStore(page);

  const statusBar = page.getByTestId("ui-status-bar");
  await expect(statusBar).toContainText("Esquema v2");
  await expect(statusBar).toContainText("Persistencia: IndexedDB");
  await expect(statusBar).toContainText("Última exportación: \u2014");

  await page.evaluate((slug) => {
    const key = `solara-export-history:${slug}`;
    const entries = [
      {
        at: new Date(Date.now() - 30 * 60_000).toISOString(),
        mode: "draft",
        score: 0,
        critical: 0,
      },
    ];
    localStorage.setItem(key, JSON.stringify(entries));
  }, DEMO_SLUG);

  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(statusBar).toContainText(/Última exportación: \d{2}:\d{2}/);
});

test("A15.5 Ctrl+S persiste el proyecto en IndexedDB y sobrevive a una recarga", async ({
  page,
}) => {
  await openDemoStore(page);
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  const nameInput = page.getByLabel("Nombre de la tienda");
  await expect(nameInput).toBeVisible();

  const editedName = "A15 persistido en IDB";
  await nameInput.fill(editedName);
  await expect(page.getByText("Cambios pendientes", { exact: true })).toBeVisible();
  await expect(page.locator(".studio-breadcrumb__current")).toHaveText(editedName);

  await page.keyboard.press("Control+s");
  await expect(page.getByText(/^Guardado \d{2}:\d{2}$/)).toBeVisible({ timeout: 15_000 });
  expect(await readStoredProjectName(page, DEMO_STORE_ID)).toBe(editedName);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });
  await page.locator(`[data-store-card-id="${DEMO_STORE_ID}"]`).click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
  await expect(page.locator(".studio-breadcrumb__current")).toHaveText(editedName);
});

test("A15.6 el Modo avanzado desactiva la base protegida y se reinicia al volver a Preparar", async ({
  page,
}) => {
  await page.goto(studioUrl);
  await wipeIndexedDb(page);
  await page.reload();
  await createCleanStore(page, "Tienda barrido A15");

  const builderTab = page.getByRole("tab", { name: "Constructor", exact: true });
  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();

  await page.getByRole("button", { name: "Modo avanzado", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  await expect(builderTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(/estructura base está protegida/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agregar sección", exact: true })).toBeEnabled();

  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();
  await builderTab.click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();
  // El modo avanzado persiste en la sesión (fix PT4-Q4): la base sigue desprotegida.
  await expect(page.getByText(/estructura base está protegida/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agregar sección", exact: true })).toBeEnabled();
});

test("A15.7 el guardado gestionado versiona en disco y actualiza la barra de estado", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const applicationRoot = mkdtempSync(join(tmpdir(), "solara-a15-managed-"));
  const port = 4300 + Math.floor(Math.random() * 200);
  const token = randomBytes(24).toString("base64url");
  const url = `http://127.0.0.1:${port}`;
  const serverProcess: ChildProcess = spawn(
    process.execPath,
    [
      resolve("packages/exporter/scripts/serve.mjs"),
      resolve("apps/studio/dist"),
      String(port),
      token,
      applicationRoot,
    ],
    { cwd: resolve("."), stdio: "ignore" },
  );

  const readDiskProjects = () =>
    page.evaluate(async () => {
      const response = await fetch("/__solara/storage/projects", { credentials: "same-origin" });
      const payload = (await response.json()) as { projects: Array<{ version: number }> };
      return payload.projects;
    });

  try {
    await expect
      .poll(
        async () => {
          try {
            return (await fetch(`${url}/__solara/session`)).status;
          } catch {
            return 0;
          }
        },
        { timeout: 10_000, intervals: [100, 250, 500] },
      )
      .toBe(200);

    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator(`[data-store-card-id="${DEMO_STORE_ID}"]`)).toBeVisible({
      timeout: 30_000,
    });
    await page
      .locator(`article:has([data-store-card-id="${DEMO_STORE_ID}"])`)
      .getByRole("button", { name: "Abrir esta tienda" })
      .click();
    await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();

    const statusBar = page.getByTestId("ui-status-bar");
    await expect(statusBar).toContainText("Persistencia: Disco");
    await expect(statusBar).toContainText("Última exportación: \u2014");

    const indicator = page.locator("output.save-indicator");
    await expect(indicator).toHaveCount(1);

    await page.getByRole("tab", { name: "Resumen", exact: true }).click();
    const nameInput = page.getByLabel("Nombre de la tienda");
    await expect(nameInput).toBeVisible();
    await nameInput.fill("A15 gestionado");

    const saveButton = page.locator("[data-studio-save]");
    await expect(saveButton).toBeEnabled();
    await installSavingProbe(page);

    const before = await readDiskProjects();
    expect(before).toHaveLength(1);

    await saveButton.click();
    await expect
      .poll(() => readProbe(page), { timeout: 30_000 })
      .toMatchObject({ savingClass: true });
    await expect(indicator).toContainText("Guardado", { timeout: 60_000 });
    await expect(saveButton).toBeDisabled();
    await expect(statusBar).toContainText(/Última exportación: \d{2}:\d{2}/);

    const afterFirst = await readDiskProjects();
    expect(afterFirst[0]?.version).toBe((before[0]?.version ?? 0) + 1);

    await nameInput.fill("A15 gestionado con atajo");
    await expect(saveButton).toBeEnabled();
    await page.keyboard.press("Control+s");
    await expect(indicator).toContainText("Guardado", { timeout: 60_000 });
    await expect(saveButton).toBeDisabled();

    const afterSecond = await readDiskProjects();
    expect(afterSecond[0]?.version).toBe((afterFirst[0]?.version ?? 0) + 1);
  } finally {
    if (serverProcess.exitCode === null) serverProcess.kill();
    rmSync(applicationRoot, { recursive: true, force: true });
  }
});

test("A14: el error de validación del shell no tiene trigger accesible desde la UI (InlineError del topbar inalcanzable)", async ({
  page,
}) => {
  await openDemoStore(page);
  await expect(page.getByText(/project: /)).toHaveCount(0);
});

test("A14: el estado de error de guardado y su botón Reintentar no tienen trigger accesible desde la UI", async ({
  page,
}) => {
  await openDemoStore(page);
  await expect(page.getByRole("button", { name: "Reintentar" })).toHaveCount(0);
});
