/**
 * T4.3/T4.4 — Tabla del catálogo: orden por columnas, columnas configurables
 * persistidas, edición inline de precio y estado, atajos de teclado, barras
 * fijas y vista de tarjetas.
 */
import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
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
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catálogo" })).toBeVisible();
}

async function reopenCatalog(page: Page) {
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catálogo" })).toBeVisible();
}

async function blurFocus(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
}

const priceValues = (page: Page) =>
  page
    .getByTestId("ui-price-edit")
    .evaluateAll((inputs) => inputs.map((input) => Number((input as HTMLInputElement).value)));

test("ordena por precio y por producto sobre el conjunto filtrado", async ({ page }) => {
  await openCatalog(page);

  await page.getByRole("button", { name: "Precio", exact: true }).click();
  const ascending = await priceValues(page);
  expect(ascending.length).toBe(50);
  expect(ascending).toEqual([...ascending].sort((a, b) => a - b));

  await page.getByRole("button", { name: "Precio", exact: true }).click();
  const descending = await priceValues(page);
  expect(descending).toEqual([...descending].sort((a, b) => b - a));

  await page.getByRole("button", { name: "Producto", exact: true }).click();
  const titles = await page
    .locator('tbody input[aria-label^="Nombre de"]')
    .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
  expect(titles).toEqual(
    [...titles].sort((a, b) => {
      const left = a.toLowerCase();
      const right = b.toLowerCase();
      return left === right ? 0 : left < right ? -1 : 1;
    }),
  );
});

test("oculta y persiste columnas configurables", async ({ page }) => {
  await openCatalog(page);
  const categoryHeaders = page.locator("thead th", { hasText: "Categorías" });
  await expect(categoryHeaders).toHaveCount(1);

  await page.getByTestId("ui-columns-toggle").click();
  await expect(page.getByTestId("ui-columns-popover")).toBeVisible();
  await page.getByTestId("ui-column-toggle-categories").uncheck();
  await page.getByTestId("ui-columns-toggle").click();
  await expect(categoryHeaders).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await reopenCatalog(page);
  await expect(categoryHeaders).toHaveCount(0);

  await page.getByTestId("ui-columns-toggle").click();
  await page.getByTestId("ui-column-toggle-categories").check();
  await page.getByTestId("ui-columns-toggle").click();
  await expect(categoryHeaders).toHaveCount(1);
});

test("edita el precio inline, rechaza valores inválidos y persiste tras recargar", async ({
  page,
}) => {
  await openCatalog(page);
  const priceInput = page.getByTestId("ui-price-edit").first();
  const original = Number(await priceInput.inputValue());
  const next = String(original + 137);

  await priceInput.fill(next);
  await priceInput.press("Enter");
  await expect(page.getByTestId("ui-price-edit").first()).toHaveValue(next);

  await page.getByTestId("ui-price-edit").first().fill("-7");
  await page.getByTestId("ui-price-edit").first().press("Enter");
  await expect(page.getByTestId("ui-price-error")).toBeVisible();
  await page.getByTestId("ui-price-edit").first().press("Escape");
  await expect(page.getByTestId("ui-price-edit").first()).toHaveValue(next);

  // El autosave debouncea 550 ms; recargar dentro de esa ventana pierde el
  // snapshot pendiente (beforeunload sólo avisa y la escritura IndexedDB no
  // sobrevive el teardown). Se espera a que el indicador confirme el guardado
  // antes de recargar para ejercitar la persistencia, no la carrera del timer.
  await expect(page.locator(".save-indicator")).toHaveClass(/save-indicator--saved/, {
    timeout: 15_000,
  });

  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await reopenCatalog(page);
  await expect(page.getByTestId("ui-price-edit").first()).toHaveValue(next);
});

test("edita el estado de una fila sin pasar por el editor", async ({ page }) => {
  await openCatalog(page);
  const trigger = page.getByTestId("ui-status-edit-trigger").first();
  const current = ((await trigger.textContent()) ?? "").trim();
  const nextLabel = current === "Activo" ? "Oculto" : "Activo";
  await expect(trigger).toHaveAttribute("aria-label", new RegExp(`^Estado de .+: ${current}$`));

  await trigger.click();
  const statusSelect = page.getByTestId("ui-status-edit").first();
  await expect(statusSelect).toBeVisible();
  await expect(statusSelect).toBeFocused();
  await statusSelect.selectOption(nextLabel === "Oculto" ? "hidden" : "active");
  const updatedTrigger = page.getByTestId("ui-status-edit-trigger").first();
  await expect(updatedTrigger).toHaveText(nextLabel);
  await expect(updatedTrigger).toBeFocused();
});

test("Escape en el estado inline cancela y devuelve el foco al disparador", async ({ page }) => {
  await openCatalog(page);
  const trigger = page.getByTestId("ui-status-edit-trigger").first();
  const current = ((await trigger.textContent()) ?? "").trim();

  await trigger.click();
  const statusSelect = page.getByTestId("ui-status-edit").first();
  await expect(statusSelect).toBeFocused();
  await page.keyboard.press("Escape");

  await expect(statusSelect).toHaveCount(0);
  await expect(trigger).toHaveText(current);
  await expect(trigger).toBeFocused();
});

test("alterna la vista de tarjetas y la persiste", async ({ page }) => {
  await openCatalog(page);
  await page.getByRole("button", { name: "Tarjetas", exact: true }).click();
  const cards = page.getByTestId("ui-catalog-card");
  await expect(cards).toHaveCount(50);
  await expect(cards.first()).toContainText("$");
  await expect(cards.first().getByRole("button", { name: "Editar" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await reopenCatalog(page);
  await expect(page.getByTestId("ui-catalog-cards")).toBeVisible();

  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(50);
});

test("los atajos editan, duplican y archivan la selección sin tocar formularios", async ({
  page,
}) => {
  await openCatalog(page);
  const rows = page.locator("tbody tr");
  let targetIndex = 0;
  const rowCount = await rows.count();
  for (let index = 0; index < rowCount; index += 1) {
    const label = (await rows.nth(index).locator(".status-label").textContent()) ?? "";
    if (label.trim() !== "Archivado") {
      targetIndex = index;
      break;
    }
  }
  await rows.nth(targetIndex).getByRole("checkbox").check();
  await blurFocus(page);

  await page.keyboard.press("e");
  const dialog = page.locator("dialog.product-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeHidden();

  await page.keyboard.press("d");
  await expect(page.getByText(/51 productos y /)).toBeVisible();

  // T4.12: archivar por Supr pasa por el diálogo de confirmación unificado.
  await page.keyboard.press("Delete");
  const confirm = page.getByTestId("ui-confirm-dialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Archivar", exact: true }).click();
  await expect(confirm).toBeHidden();
  await expect(rows.nth(targetIndex).locator(".status-label")).toHaveText("Archivado");

  await page.getByPlaceholder("Buscar por producto, marca o estado").fill("e");
  await page.keyboard.press("e");
  await expect(page.locator("dialog.product-dialog")).toHaveCount(0);
  await page.getByPlaceholder("Buscar por producto, marca o estado").fill("");
});

test("mantiene el encabezado y permite alcanzar la barra masiva al hacer scroll", async ({
  page,
}) => {
  await openCatalog(page);

  const shell = page.locator(".table-shell");
  await shell.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const shellTop = await shell.evaluate((element) => element.getBoundingClientRect().top);
  const headerTop = await page
    .locator("thead th")
    .first()
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(Math.abs(headerTop - shellTop)).toBeLessThan(4);

  await page.getByTestId("select-filtered-products").click();
  const bulk = page.locator(".bulk-panel");
  await expect(bulk).toBeVisible();
  const pane = page.locator(".editor-pane");
  await bulk.scrollIntoViewIfNeeded();
  const paneBox = await pane.boundingBox();
  const bulkBox = await bulk.boundingBox();
  expect(paneBox).not.toBeNull();
  expect(bulkBox).not.toBeNull();
  expect(bulkBox?.y).toBeGreaterThanOrEqual((paneBox?.y ?? 0) - 1);
  expect(bulkBox?.y + (bulkBox?.height ?? 0)).toBeLessThanOrEqual(
    (paneBox?.y ?? 0) + (paneBox?.height ?? 0) + 1,
  );
  await expect(bulk.getByRole("button", { name: "Aplicar estado" })).toBeVisible();
});

test("P5-B5: archivar un producto inline y restaurarlo sin perder la fila", async ({ page }) => {
  await openCatalog(page);

  const rows = page.locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  const firstTrigger = page.getByTestId("ui-status-edit-trigger").first();
  const firstRowName = await rows.first().locator("td").nth(1).innerText();
  await firstTrigger.click();
  const statusSelect = page.getByTestId("ui-status-edit").first();
  await statusSelect.selectOption("archived");
  await page.waitForTimeout(600);
  const labelAfter = await rows.first().locator(".status-label").innerText();
  console.log("P5-B5 estado tras archivar:", JSON.stringify(labelAfter));
  expect(labelAfter).toContain("Archivad");

  const namesAfter = await rows.locator("td").nth(1).allInnerTexts();
  expect(namesAfter).toContain(firstRowName);

  const archivedTrigger = page.getByTestId("ui-status-edit-trigger").first();
  await archivedTrigger.click();
  const archivedSelect = page.getByTestId("ui-status-edit").first();
  await archivedSelect.selectOption("active");
  await page.waitForTimeout(600);
  const labelRestored = await rows.first().locator(".status-label").innerText();
  console.log("P5-B5 estado tras restaurar:", JSON.stringify(labelRestored));
  expect(labelRestored).toContain("Activo");
});
