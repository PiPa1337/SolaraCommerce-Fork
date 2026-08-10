import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

/**
 * F11 — Regresión del flujo guiado (hallazgos H8 de Overview/GuidedOverview).
 * Cubre: reapertura del panel al navegar desde el checklist (H8-B3, arreglado
 * por F2 en Studio.tsx; aquí se fija el contrato observable), pasos hacia el
 * área correspondiente (H8-21/H8-22), ida y vuelta con Modo avanzado y estado
 * conservado (H8-25/H8-26/H8-27), y la actualización "Respaldar y adoptar
 * cambios" con persistencia (H8-24).
 */

test.setTimeout(process.env.CI ? 60_000 : 30_000);

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

async function expectPaneClosed(page: Page): Promise<void> {
  await expect(editorPane(page)).toHaveAttribute("aria-hidden", "true");
  await expect(editorPane(page)).toHaveClass(/editor-pane--closed/);
}

async function expectPaneOpen(page: Page): Promise<void> {
  await expect(editorPane(page)).toHaveAttribute("aria-hidden", "false");
  await expect(editorPane(page)).toHaveClass(/editor-pane--open/);
}

/** Dispara el handler del checklist aunque el panel esté colapsado (H8-B3):
 *  cerrado, el contenido queda `visibility: hidden` y `pointer-events: none`,
 *  así que el clic real no llega; el contrato es que la navegación guiada
 *  reabra el panel para mostrar el destino. */
async function dispatchGuidedClick(locator: ReturnType<Page["getByTestId"]>): Promise<void> {
  await locator.dispatchEvent("click");
}

test("la navegación guiada reabre el panel de edición cerrado (H8-B3)", async ({ page }) => {
  await setupCleanStore(page, "Tienda panel guiado");

  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();

  await page.getByRole("button", { name: "Cerrar panel de edición" }).click();
  await expectPaneClosed(page);

  // "Siguiente" con el panel cerrado debe abrirlo y mostrar el destino.
  await dispatchGuidedClick(page.getByTestId("ui-guided-next"));
  await expectPaneOpen(page);
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();

  // "Editar" de un requisito pendiente, con el panel cerrado, idem.
  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar panel de edición" }).click();
  await expectPaneClosed(page);

  const firstRequirement = page.getByTestId("ui-guided-requirement").first();
  // Con el panel cerrado el contenido queda fuera del árbol de accesibilidad:
  // el botón "Editar" se resuelve por CSS para poder despachar el clic.
  const editButton = firstRequirement.locator('button[aria-label^="Editar "]');
  await expect(editButton).toHaveCount(1);
  await dispatchGuidedClick(editButton);
  await expectPaneOpen(page);
  await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
});

test("los pasos del checklist llevan a su área y el modo avanzado conserva el estado (H8-21/22/25/26/27)", async ({
  page,
}) => {
  await setupCleanStore(page, "Tienda pasos guiados");

  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();

  // Un requisito del hero (Inicio) navega al Constructor.
  const homeRequirement = page
    .getByTestId("ui-guided-requirement")
    .filter({ hasText: "Inicio ·" })
    .first();
  await homeRequirement.getByRole("button", { name: /^Editar / }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();

  // El estado editado en Resumen sobrevive a la ida y vuelta de modos.
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await page.getByLabel("Descripción", { exact: true }).fill("Descripción conservada entre modos");
  await expect(page.getByTestId("ui-save-indicator")).toContainText("Cambios guardados", {
    timeout: 5_000,
  });

  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await page.getByRole("button", { name: "Modo avanzado" }).click();
  await expect(page.getByRole("heading", { name: "Constructor", exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Preparar tienda" })).toBeVisible();

  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await expect(page.getByLabel("Descripción", { exact: true })).toHaveValue(
    "Descripción conservada entre modos",
  );
});

async function seedTemplateVersion(page: Page, name: string, version: number): Promise<void> {
  const updated = await page.evaluate(
    ([storeName, nextVersion]) =>
      new Promise<boolean>((resolve, reject) => {
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
              project: { origin?: { templateVersion?: number } };
            }>;
            const record = records.find((item) => item.name === storeName);
            if (!record) {
              resolve(false);
              return;
            }
            store.put({
              ...record,
              project: {
                ...record.project,
                origin: { ...(record.project.origin ?? {}), templateVersion: nextVersion },
              },
            });
          });
          all.addEventListener("error", () => reject(all.error));
          transaction.addEventListener("complete", () => resolve(true));
          transaction.addEventListener("error", () => reject(transaction.error));
        });
      }),
    [name, version],
  );
  expect(updated).toBe(true);
}

async function readTemplateVersion(page: Page, name: string): Promise<number | undefined> {
  return page.evaluate(
    ([storeName]) =>
      new Promise<number | undefined>((resolve, reject) => {
        const request = indexedDB.open("solara-commerce-studio");
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const db = request.result;
          const all = db.transaction("projects").objectStore("projects").getAll();
          all.addEventListener("success", () => {
            const records = all.result as Array<{
              name: string;
              project: { origin?: { templateVersion?: number } };
            }>;
            resolve(
              records.find((item) => item.name === storeName)?.project.origin?.templateVersion,
            );
          });
          all.addEventListener("error", () => reject(all.error));
        });
      }),
    [name],
  );
}

test("Respaldar y adoptar cambios aplica la actualización y persiste (H8-24)", async ({ page }) => {
  const storeName = "Tienda actualizable";
  await setupCleanStore(page, storeName);

  // Deja que el autosave del primer arranque se asiente antes de sembrar.
  await page.waitForTimeout(900);
  await seedTemplateVersion(page, storeName, 1);

  await page.reload();
  const card = page.locator(".dashboard-store-card", { hasText: storeName });
  await expect(card.getByTestId("ui-card-open")).toBeVisible();
  await card.getByTestId("ui-card-open").click();

  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByText("Actualización disponible")).toBeVisible();

  const updateButton = page.getByRole("button", { name: "Respaldar y adoptar cambios" });
  await expect(updateButton).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await updateButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-antes-de-actualizar\.solara\.json$/);

  await expect(page.getByText("Actualización disponible")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Respaldar y adoptar cambios" })).toHaveCount(0);

  await expect.poll(async () => readTemplateVersion(page, storeName), { timeout: 10_000 }).toBe(2);

  await page.reload();
  const reopened = page.locator(".dashboard-store-card", { hasText: storeName });
  await expect(reopened.getByTestId("ui-card-open")).toBeVisible();
  await reopened.getByTestId("ui-card-open").click();
  await page.getByRole("tab", { name: "Preparar", exact: true }).click();
  await expect(page.getByText("Actualización disponible")).toHaveCount(0);
});
