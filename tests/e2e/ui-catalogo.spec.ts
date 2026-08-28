/**
 * Regresión H4-S2 — La búsqueda del catálogo encuentra un estado tanto por su
 * etiqueta visible ("Activo"/"Oculto"/"Archivado") como por su valor crudo
 * ("active"/"hidden"/"archived"), según promete el placeholder del toolbar.
 */
import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { openMutableScaleStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

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

async function openCatalog(page: Page) {
  await page.goto(studioUrl);
  await page.evaluate(
    () =>
      new Promise<void>((resolveDelete, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.addEventListener("success", () => resolveDelete());
        request.addEventListener("error", () => reject(request.error));
      }),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await openMutableScaleStore(page, "Catálogo mutable H4-S2");
  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catálogo", exact: true })).toBeVisible();
}

const searchBox = (page: Page) => page.getByPlaceholder("Buscar por producto, marca o estado");

const rowStatusLabels = (page: Page) =>
  page
    .locator("tbody .status-label")
    .allTextContents()
    .then((labels) => labels.map((label) => label.trim()));

async function setRowStatus(page: Page, rowIndex: number, value: string, label: string) {
  const row = page.locator("tbody tr").nth(rowIndex);
  await row.getByTestId("ui-status-edit-trigger").click();
  const statusSelect = row.getByTestId("ui-status-edit");
  await expect(statusSelect).toBeVisible();
  await statusSelect.selectOption(value);
  await expect(row.locator(".status-label")).toHaveText(label);
}

test("busca por estado con la etiqueta visible y conserva el valor crudo", async ({ page }) => {
  await openCatalog(page);
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(50);

  await setRowStatus(page, 0, "hidden", "Oculto");
  await setRowStatus(page, 1, "archived", "Archivado");

  const search = searchBox(page);
  await search.fill("Activo");
  await expect(rows).toHaveCount(48);
  expect((await rowStatusLabels(page)).every((label) => label === "Activo")).toBe(true);

  await search.fill("active");
  await expect(rows).toHaveCount(48);

  await search.fill("Oculto");
  await expect(rows).toHaveCount(1);
  await expect(rows.locator(".status-label")).toHaveText(["Oculto"]);

  await search.fill("Archivado");
  await expect(rows).toHaveCount(1);
  await expect(rows.locator(".status-label")).toHaveText(["Archivado"]);

  await search.fill("ARCHIV");
  await expect(rows).toHaveCount(1);

  await search.fill("");
  await expect(rows).toHaveCount(50);
});
