/**
 * Barrido A02 — Catálogo: acciones masivas, columnas y selección (auditoría,
 * slice de `apps/studio/src/features/Catalog.tsx`; NO lo edita: A1 es el
 * owner). Contrato de 3 capas por control: (1) click → efecto real en datos,
 * (2) auto-feedback del control (contadores, aria-expanded, aria-pressed,
 * checkbox), (3) payload del handler → receptor (`@solara/core`).
 *
 * Bugs que requieren cambio en Catalog.tsx: `test.fixme` nombrando a A1.
 */
import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(60_000);

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

async function openCatalog(page: Page): Promise<void> {
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
  await expect(page.locator("tbody tr")).toHaveCount(50);
}

async function reopenCatalog(page: Page): Promise<void> {
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catálogo" })).toBeVisible();
}

async function blurFocus(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
}

const rows = (page: Page) => page.locator("tbody tr");
const rowCheckbox = (page: Page, index: number) => rows(page).nth(index).getByRole("checkbox");
const priceInput = (page: Page, index: number) =>
  rows(page).nth(index).getByTestId("ui-price-edit");
const statusLabel = (page: Page, index: number) => rows(page).nth(index).locator(".status-label");
const headerCheckbox = (page: Page) => page.locator('thead input[type="checkbox"]');

const bulkPanel = (page: Page) => page.getByRole("region", { name: "Acciones masivas" });
const bulkStatusSelect = (page: Page) => bulkPanel(page).getByRole("combobox", { name: "Estado" });
const priceKindSelect = (page: Page) => bulkPanel(page).getByRole("combobox", { name: "Ajuste" });
const priceValueInput = (page: Page) =>
  bulkPanel(page).getByRole("spinbutton", { name: /Valor %|Centavos/ });

async function expectSelectedCount(page: Page, count: number): Promise<void> {
  await expect(page.getByText(`${count} seleccionados`, { exact: true })).toBeVisible();
  await expect(bulkPanel(page)).toContainText(`${count} productos seleccionados`);
}

test.describe("A2 — Catálogo: selección", () => {
  test("selección por fila: feedback en fila, contador, cabecera y limpieza", async ({ page }) => {
    await openCatalog(page);
    await expect(headerCheckbox(page)).not.toBeChecked();

    await rowCheckbox(page, 0).check();
    await expect(rows(page).nth(0)).toHaveAttribute("data-selected", "true");
    await expect(rows(page).nth(1)).toHaveAttribute("data-selected", "false");
    await expectSelectedCount(page, 1);
    await expect
      .poll(() =>
        headerCheckbox(page).evaluate((element) => (element as HTMLInputElement).indeterminate),
      )
      .toBe(true);
    await expect(headerCheckbox(page)).not.toBeChecked();

    await rowCheckbox(page, 1).check();
    await expectSelectedCount(page, 2);

    await headerCheckbox(page).check();
    await expectSelectedCount(page, 50);
    await expect(headerCheckbox(page)).toBeChecked();
    await expect(page.locator('tbody tr[data-selected="true"]')).toHaveCount(50);

    await page.getByRole("button", { name: "Limpiar", exact: true }).click();
    await expect(page.getByText("0 seleccionados", { exact: true })).toBeVisible();
    await expect(bulkPanel(page)).toHaveCount(0);
    await expect(headerCheckbox(page)).not.toBeChecked();
    await expect(page.locator('tbody tr[data-selected="true"]')).toHaveCount(0);
  });

  test("seleccionar filtrados y limpiar conserva el feedback de conteo", async ({ page }) => {
    await openCatalog(page);
    await page.getByPlaceholder("Buscar por producto, marca o estado").fill("Remera");
    await expect(rows(page)).toHaveCount(6);

    await page.getByTestId("select-filtered-products").click();
    await expectSelectedCount(page, 6);
    await expect(page.locator('tbody input[type="checkbox"]:checked')).toHaveCount(6);
    await expect(page.locator('tbody tr[data-selected="true"]')).toHaveCount(6);

    await rowCheckbox(page, 0).uncheck();
    await expectSelectedCount(page, 5);

    await page.getByRole("button", { name: "Limpiar", exact: true }).click();
    await expect(page.getByText("0 seleccionados", { exact: true })).toBeVisible();
    await expect(bulkPanel(page)).toHaveCount(0);
    await expect(page.locator('tbody input[type="checkbox"]:checked')).toHaveCount(0);
  });
});

test.describe("A2 — Catálogo: acciones masivas", () => {
  test("estado masivo: cambia sólo los seleccionados y el select conserva el valor", async ({
    page,
  }) => {
    await openCatalog(page);
    await rowCheckbox(page, 0).check();
    await rowCheckbox(page, 1).check();
    await expectSelectedCount(page, 2);

    await bulkStatusSelect(page).selectOption("hidden");
    await page.getByTestId("apply-bulk-status").click();

    await expect(statusLabel(page, 0)).toHaveText("Oculto");
    await expect(statusLabel(page, 1)).toHaveText("Oculto");
    await expect(statusLabel(page, 2)).toHaveText("Activo");
    await expectSelectedCount(page, 2);
    await expect(bulkStatusSelect(page)).toHaveValue("hidden");
  });

  test("archivo masivo: confirmación con cancelar y confirmar", async ({ page }) => {
    await openCatalog(page);
    await rowCheckbox(page, 0).check();
    await rowCheckbox(page, 1).check();
    await expectSelectedCount(page, 2);

    await blurFocus(page);
    await page.keyboard.press("Delete");
    const confirm = page.getByTestId("ui-confirm-dialog");
    await expect(confirm).toBeVisible();
    await expect(confirm.getByRole("heading", { name: "Archivar productos" })).toBeVisible();
    await expect(confirm).toContainText("¿Archivar los 2 productos seleccionados?");
    await expect(confirm.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();

    await confirm.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(confirm).toBeHidden();
    await expect(statusLabel(page, 0)).toHaveText("Activo");
    await expect(statusLabel(page, 1)).toHaveText("Activo");
    await expectSelectedCount(page, 2);

    await page.keyboard.press("Delete");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Archivar", exact: true }).click();
    await expect(confirm).toBeHidden();
    await expect(statusLabel(page, 0)).toHaveText("Archivado");
    await expect(statusLabel(page, 1)).toHaveText("Archivado");
    await expect(statusLabel(page, 2)).toHaveText("Activo");
  });

  test("ajuste porcentual: +10% sólo en los seleccionados", async ({ page }) => {
    await openCatalog(page);
    await rowCheckbox(page, 0).check();
    await rowCheckbox(page, 1).check();

    await priceValueInput(page).fill("10");
    await bulkPanel(page).getByRole("button", { name: "Ajustar precios" }).click();

    await expect(priceInput(page, 0)).toHaveValue("3173500");
    await expect(priceInput(page, 1)).toHaveValue("3267000");
    await expect(priceInput(page, 2)).toHaveValue("3055000");
    await expect(page.getByTestId("ui-inline-error")).toHaveCount(0);
  });

  test("ajuste en centavos y validación del mínimo -100%", async ({ page }) => {
    await openCatalog(page);
    await rowCheckbox(page, 0).check();
    await rowCheckbox(page, 1).check();

    await priceKindSelect(page).selectOption("amount");
    await priceValueInput(page).fill("100000");
    await bulkPanel(page).getByRole("button", { name: "Ajustar precios" }).click();
    await expect(priceInput(page, 0)).toHaveValue("2985000");
    await expect(priceInput(page, 1)).toHaveValue("3070000");
    await expect(priceInput(page, 2)).toHaveValue("3055000");

    await priceKindSelect(page).selectOption("percentage");
    await priceValueInput(page).fill("-150");
    await bulkPanel(page).getByRole("button", { name: "Ajustar precios" }).click();
    await expect(page.getByTestId("ui-inline-error")).toContainText("mínimo -100%");
    await expect(priceInput(page, 0)).toHaveValue("2985000");
    await expect(priceInput(page, 1)).toHaveValue("3070000");
  });

  test(
    "A1: el error de validación obsoleto se limpia tras un ajuste exitoso",
    async ({ page }) => {
      await openCatalog(page);
      await rowCheckbox(page, 0).check();

      await priceKindSelect(page).selectOption("percentage");
      await priceValueInput(page).fill("-150");
      await bulkPanel(page).getByRole("button", { name: "Ajustar precios" }).click();
      await expect(page.getByTestId("ui-inline-error")).toContainText("mínimo -100%");

      await priceValueInput(page).fill("5");
      await bulkPanel(page).getByRole("button", { name: "Ajustar precios" }).click();
      await expect(priceInput(page, 0)).toHaveValue("3029250");
      await expect(page.getByTestId("ui-inline-error")).toBeHidden();
    },
  );
});

test.describe("A2 — Catálogo: columnas y vista", () => {
  test("columnas: toggle con aria-expanded, efecto en la tabla y persistencia", async ({
    page,
  }) => {
    await openCatalog(page);
    const toggle = page.getByTestId("ui-columns-toggle");
    const priceHeader = page.locator("thead th").filter({ hasText: /^Precio$/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("ui-columns-popover")).toBeVisible();
    await expect(page.locator('.catalog-columns__popover input[type="checkbox"]')).toHaveCount(8);
    await expect(
      page.locator('.catalog-columns__popover input[type="checkbox"]:checked'),
    ).toHaveCount(8);

    await page.getByTestId("ui-column-toggle-price").uncheck();
    await expect(priceHeader).toHaveCount(0);
    await expect(page.getByTestId("ui-price-edit")).toHaveCount(0);
    await expect(rows(page)).toHaveCount(50);

    await page.getByTestId("ui-column-toggle-price").check();
    await expect(priceHeader).toHaveCount(1);
    await expect(page.getByTestId("ui-price-edit")).toHaveCount(50);

    await page.getByTestId("ui-column-toggle-price").uncheck();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("solara-catalog-columns:store-modo-sur-demo") ?? "{}"),
    );
    expect(stored.price).toBe(false);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
    await reopenCatalog(page);
    await expect(priceHeader).toHaveCount(0);
    await page.getByTestId("ui-columns-toggle").click();
    await expect(page.getByTestId("ui-column-toggle-price")).not.toBeChecked();
  });

  test("vista lista/tarjetas: aria-pressed, layout y persistencia", async ({ page }) => {
    await openCatalog(page);
    const listButton = page.getByRole("button", { name: "Lista", exact: true });
    const cardsButton = page.getByRole("button", { name: "Tarjetas", exact: true });
    await expect(listButton).toHaveAttribute("aria-pressed", "true");
    await expect(cardsButton).toHaveAttribute("aria-pressed", "false");

    await cardsButton.click();
    await expect(cardsButton).toHaveAttribute("aria-pressed", "true");
    await expect(listButton).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("ui-catalog-cards")).toBeVisible();
    await expect(page.getByTestId("ui-catalog-card")).toHaveCount(50);
    await expect(page.locator(".table-shell")).toHaveCount(0);

    expect(
      await page.evaluate(() => localStorage.getItem("solara-catalog-view:store-modo-sur-demo")),
    ).toBe("cards");

    await page.reload();
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
    await reopenCatalog(page);
    await expect(page.getByTestId("ui-catalog-cards")).toBeVisible();

    await page.getByRole("button", { name: "Lista", exact: true }).click();
    await expect(page.locator("tbody tr")).toHaveCount(50);
    await expect(page.getByRole("button", { name: "Lista", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("button", { name: "Tarjetas", exact: true })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
