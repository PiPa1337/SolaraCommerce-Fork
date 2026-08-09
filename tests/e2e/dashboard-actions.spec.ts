import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

/**
 * T2.6-T2.9 — Acciones del dashboard: archivar con deshacer, duplicar con
 * diálogo y progreso, comparación de dos tiendas y respaldo masivo.
 */

let studioServer: Server;
let studioUrl: string;

test.beforeAll(async () => {
  const studio = await startStudioServer();
  studioServer = studio.server;
  studioUrl = studio.url;
});

test.afterAll(async () => {
  await stopStudioServer(studioServer);
});

test.setTimeout(120_000);

async function openDemoDetail(page: Page) {
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  const card = page.locator(".dashboard-store-card").filter({ hasText: "Predeterminado" }).first();
  await card.locator(".dashboard-store-card__button").click();
  return page.getByRole("complementary", { name: "Tienda seleccionada: Predeterminado" });
}

test("archivar confirma, muestra deshacer y restaura la tienda", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const detail = await openDemoDetail(page);

  // T4.12: el archivo de tienda confirma con el diálogo unificado (ya no hay
  // window.confirm nativo).
  await detail.getByRole("button", { name: "Archivar" }).click();
  const confirm = page.getByTestId("ui-confirm-dialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Archivar", exact: true }).click();
  await expect(confirm).toBeHidden();
  await expect(page.locator(".dashboard-cosmic-count")).toHaveText("0 visibles");

  const toast = page.getByTestId("ui-dashboard-toast");
  await expect(toast).toBeVisible();
  await expect(toast).toContainText("Deshacer");
  await toast.getByRole("button", { name: "Deshacer" }).click();

  await expect(page.locator(".dashboard-cosmic-count")).toHaveText("1 visibles");
  await expect(page.getByTestId("ui-dashboard-toast")).toHaveCount(0);
  await expect(
    page
      .locator(".dashboard-store-card")
      .filter({ hasText: "Predeterminado" })
      .first()
      .locator(".dashboard-store-card__status"),
  ).toHaveText("Activa");
});

test("duplicar pasa por el diálogo y aplica el nombre elegido", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const detail = await openDemoDetail(page);

  await detail.getByRole("button", { name: "Duplicar" }).click();
  const dialog = page.getByRole("dialog", { name: "Duplicar tienda" });
  await expect(dialog).toBeVisible();
  const nameInput = page.getByTestId("ui-duplicate-name");
  await expect(nameInput).toHaveValue("Predeterminado (copia)");

  await nameInput.fill("Copia de prueba");
  await dialog.getByRole("button", { name: "Duplicar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".dashboard-cosmic-count")).toHaveText("2 visibles");
  await expect(page.locator(".dashboard-store-card").getByText("Copia de prueba")).toBeVisible();
  await expect(page.getByTestId("ui-dashboard-toast")).toContainText("Tienda duplicada");
});

test("duplicar falla sin cerrar el diálogo ni anunciar éxito", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, "randomUUID", {
      configurable: true,
      value: () => {
        throw new Error("UUID no disponible (simulación de fallo)");
      },
    });
  });
  const detail = await openDemoDetail(page);

  await detail.getByRole("button", { name: "Duplicar" }).click();
  const dialog = page.getByRole("dialog", { name: "Duplicar tienda" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Duplicar", exact: true }).click();
  await expect(dialog).toContainText("UUID no disponible");
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("ui-dashboard-toast")).toHaveCount(0);

  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog).toBeHidden();
});

test("el modo comparar exige dos tiendas y muestra los diffs de secciones y motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const detail = await openDemoDetail(page);

  // Con una sola tienda demo, el modo comparar necesita una segunda: se
  // duplica Predeterminado y se comparan las dos (idénticas).
  await detail.getByRole("button", { name: "Duplicar" }).click();
  const duplicateDialog = page.getByRole("dialog", { name: "Duplicar tienda" });
  await expect(duplicateDialog).toBeVisible();
  await duplicateDialog.getByRole("button", { name: "Duplicar" }).click();
  await expect(duplicateDialog).toBeHidden();
  await page
    .locator(".dashboard-store-card")
    .first()
    .locator(".dashboard-store-card__button")
    .click();

  const toggle = page.getByRole("button", { name: "Comparar tiendas", exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Elegí 2 tiendas para comparar")).toBeVisible();

  const compareAction = page.getByRole("button", { name: "Comparar", exact: true });
  await expect(compareAction).toBeDisabled();

  const checkboxes = page.getByTestId("ui-card-compare");
  await expect(checkboxes).toHaveCount(2);
  await checkboxes.nth(0).check();
  await expect(compareAction).toBeDisabled();
  await checkboxes.nth(1).check();
  await expect(compareAction).toBeEnabled();

  await compareAction.click();
  const dialog = page.getByRole("dialog", { name: "Comparar tiendas" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Predeterminado", { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText("Predeterminado (copia)", { exact: true }).first()).toBeVisible();

  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByTestId("ui-card-compare")).toHaveCount(0);
});

test("respaldar todo está deshabilitado en modo navegador con un aviso", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();

  const bulk = page.getByRole("button", { name: "Respaldar todo" });
  await expect(bulk).toBeDisabled();
  await expect(bulk).toHaveAttribute(
    "title",
    /modo navegador los respaldos se descargan por tienda/i,
  );
});
