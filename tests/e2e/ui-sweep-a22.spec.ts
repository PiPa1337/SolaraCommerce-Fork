/**
 * Barrido A22 — CatalogToolbar + Ui (owner de
 * `apps/studio/src/features/catalog/CatalogToolbar.tsx` y
 * `apps/studio/src/components/Ui.tsx`). Contrato de 3 capas por control:
 * (1) click → efecto real en filas/estado, (2) auto-feedback del control
 * (aria-expanded, aria-pressed, valor del campo, checked, disabled),
 * (3) payload del handler → receptor (estado de Catalog → @tanstack/react-table).
 *
 * Fixture determinista: la demo "Predeterminado" (seed demo) tiene 50
 * productos, marcas cíclicas y categorías con conteos conocidos (remeras 7,
 * basicas 3, jeans 2). Las aserciones de filas/columnas usan esos conteos.
 */
import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(120_000);

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
  await expect(page.getByRole("heading", { name: "Catálogo", exact: true })).toBeVisible();
  await expect(rows(page)).toHaveCount(50);
}

const rows = (page: Page) =>
  page.locator("tbody tr").filter({ hasNot: page.locator("td.table-empty") });
const searchBox = (page: Page) => page.getByRole("textbox", { name: "Buscar productos" });
const categoryFilter = (page: Page) => page.getByLabel("Filtrar categoría");
const columnsToggle = (page: Page) => page.getByTestId("ui-columns-toggle");
const columnsPopover = (page: Page) => page.getByTestId("ui-columns-popover");
const columnToggle = (page: Page, id: string) => page.getByTestId(`ui-column-toggle-${id}`);
const paginationSummary = (page: Page) => page.locator(".ui-pagination__summary");
const pageSizeSelect = (page: Page) => page.getByLabel("Filas por página");
const currentPage = (page: Page) => page.locator('.ui-pagination__page[aria-current="page"]');
const emptyMessage = (page: Page) => page.locator(".table-empty");
const titleOf = (page: Page, index: number) =>
  rows(page).nth(index).locator('input[aria-label^="Nombre de "]').inputValue();

test.describe("A22 — Búsqueda del toolbar", () => {
  test("el texto filtra de verdad, el campo lo refleja y vuelve a la página 1", async ({
    page,
  }) => {
    await openCatalog(page);

    await pageSizeSelect(page).selectOption("25");
    await expect(rows(page)).toHaveCount(25);
    await page.locator(".ui-pagination__page", { hasText: "2" }).click();
    await expect(paginationSummary(page)).toHaveText("26–50 de 50");
    await expect(currentPage(page)).toHaveText("2");

    await searchBox(page).fill("Remera");
    await expect(searchBox(page)).toHaveValue("Remera");
    await expect(rows(page)).toHaveCount(6);
    await expect(paginationSummary(page)).toHaveText("1–6 de 6");
    await expect(currentPage(page)).toHaveText("1");
    await expect(page.locator(".ui-pagination__page")).toHaveCount(1);

    await searchBox(page).fill("Gorra Visera");
    await expect(rows(page)).toHaveCount(1);
    await expect(titleOf(page, 0)).resolves.toBe("Gorra Visera");

    await searchBox(page).fill("Inexistente-ZZZ");
    await expect(rows(page)).toHaveCount(0);
    await expect(emptyMessage(page)).toContainText("No hay productos que coincidan");
    await expect(paginationSummary(page)).toHaveText("0 resultados");

    await searchBox(page).fill("");
    await expect(rows(page)).toHaveCount(25);
    await expect(searchBox(page)).toHaveValue("");
    await expect(paginationSummary(page)).toHaveText("1–25 de 50");
  });
});

test.describe("A22 — Filtro de categoría", () => {
  test("el select filtra por categoría, refleja el valor y combina con la búsqueda", async ({
    page,
  }) => {
    await openCatalog(page);

    await categoryFilter(page).selectOption("category-remeras");
    await expect(categoryFilter(page)).toHaveValue("category-remeras");
    await expect(rows(page)).toHaveCount(7);
    await expect(paginationSummary(page)).toHaveText("1–7 de 7");

    await searchBox(page).fill("Remera");
    await expect(rows(page)).toHaveCount(3);

    await searchBox(page).fill("");
    await categoryFilter(page).selectOption("");
    await expect(rows(page)).toHaveCount(50);
    await expect(categoryFilter(page)).toHaveValue("");
  });
});

test.describe("A22 — Toggle de columnas", () => {
  test("aria-expanded, tabla de verdad del popover y persistencia", async ({ page }) => {
    await openCatalog(page);
    const stockHeader = page.locator("th", { hasText: "Stock" });

    await expect(columnsToggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(columnsToggle(page)).not.toHaveAttribute("aria-controls");
    await expect(columnsPopover(page)).toHaveCount(0);
    await expect(stockHeader).toHaveCount(1);

    await columnsToggle(page).click();
    await expect(columnsToggle(page)).toHaveAttribute("aria-expanded", "true");
    await expect(columnsPopover(page)).toBeVisible();
    await expect(columnsPopover(page).locator('input[type="checkbox"]')).toHaveCount(8);
    await expect(columnToggle(page, "stock")).toBeChecked();
    const popoverId = await columnsPopover(page).getAttribute("id");
    expect(popoverId, "popover con id").toBeTruthy();
    await expect(columnsToggle(page)).toHaveAttribute("aria-controls", popoverId ?? "");

    await columnToggle(page, "stock").uncheck();
    await expect(stockHeader).toHaveCount(0);
    await expect(rows(page)).toHaveCount(50);

    await columnToggle(page, "stock").check();
    await expect(stockHeader).toHaveCount(1);

    await columnToggle(page, "stock").uncheck();
    await columnsToggle(page).click();
    await expect(columnsToggle(page)).toHaveAttribute("aria-expanded", "false");

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("solara-catalog-columns:store-modo-sur-demo") ?? "{}"),
    );
    expect(stored.stock).toBe(false);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
    await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
    await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
    await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Catálogo", exact: true })).toBeVisible();
    await expect(stockHeader).toHaveCount(0);
  });

  test("Escape cierra el popover y devuelve el foco al botón; el click fuera cierra", async ({
    page,
  }) => {
    await openCatalog(page);

    await columnsToggle(page).click();
    await expect(columnsPopover(page)).toBeVisible();
    await columnToggle(page, "price").focus();
    await page.keyboard.press("Escape");
    await expect(columnsPopover(page)).toHaveCount(0);
    await expect(columnsToggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(columnsToggle(page)).toBeFocused();

    await columnsToggle(page).click();
    await expect(columnsPopover(page)).toBeVisible();
    await searchBox(page).click();
    await expect(columnsPopover(page)).toHaveCount(0);
    await expect(columnsToggle(page)).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("A22 — Toggle de vista (estados presionados)", () => {
  test("lista/tarjetas: aria-pressed, layout real y persistencia", async ({ page }) => {
    await openCatalog(page);
    const listButton = page.getByRole("button", { name: "Lista", exact: true });
    const cardsButton = page.getByRole("button", { name: "Tarjetas", exact: true });

    await expect(listButton).toHaveAttribute("aria-pressed", "true");
    await expect(cardsButton).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".table-shell")).toBeVisible();
    await expect(page.getByTestId("ui-catalog-cards")).toHaveCount(0);

    await cardsButton.click();
    await expect(cardsButton).toHaveAttribute("aria-pressed", "true");
    await expect(listButton).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("ui-catalog-cards")).toBeVisible();
    await expect(page.getByTestId("ui-catalog-card")).toHaveCount(50);
    await expect(page.locator(".table-shell")).toHaveCount(0);
    await expect(
      await page.evaluate(() => localStorage.getItem("solara-catalog-view:store-modo-sur-demo")),
    ).toBe("cards");

    await listButton.click();
    await expect(listButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".table-shell")).toBeVisible();
    await expect(rows(page)).toHaveCount(50);
  });
});

test.describe("A22 — Selección desde el toolbar", () => {
  test("seleccionar filtrados marca sólo los visibles y limpiar restaura el conteo", async ({
    page,
  }) => {
    await openCatalog(page);
    await searchBox(page).fill("Remera");
    await expect(rows(page)).toHaveCount(6);

    await page.getByTestId("select-filtered-products").click();
    await expect(page.getByText("6 seleccionados", { exact: true })).toBeVisible();
    await expect(page.locator('tbody input[type="checkbox"]:checked')).toHaveCount(6);
    await expect(page.locator('tbody tr[data-selected="true"]')).toHaveCount(6);

    await page.getByRole("button", { name: "Limpiar", exact: true }).click();
    await expect(page.getByText("0 seleccionados", { exact: true })).toBeVisible();
    await expect(page.locator('tbody input[type="checkbox"]:checked')).toHaveCount(0);
  });

  test("el botón de seleccionar filtrados usa el singular con un solo resultado", async ({
    page,
  }) => {
    await openCatalog(page);
    await searchBox(page).fill("Gorra Visera");
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByTestId("select-filtered-products")).toContainText(
      "Seleccionar 1 filtrado",
    );
  });
});

test.describe("A22 — Paginación del toolbar", () => {
  test("tamaño 25: navegación con página actual marcada y botones coherentes", async ({ page }) => {
    await openCatalog(page);

    await pageSizeSelect(page).selectOption("25");
    await expect(rows(page)).toHaveCount(25);
    await expect(paginationSummary(page)).toHaveText("1–25 de 50");
    await expect(currentPage(page)).toHaveText("1");
    await expect(page.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Siguiente" })).toBeEnabled();

    await page.locator(".ui-pagination__page", { hasText: "2" }).click();
    await expect(paginationSummary(page)).toHaveText("26–50 de 50");
    await expect(currentPage(page)).toHaveText("2");
    await expect(page.getByRole("button", { name: "Anterior" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });
});

test.describe("A22 — Primitivas Ui en uso real", () => {
  test("Field asocia el label con aria-labelledby y muestra el error con aria-describedby", async ({
    page,
  }) => {
    await openCatalog(page);
    await rows(page).nth(0).getByRole("button", { name: "Editar" }).click();
    const dialog = page.locator("dialog.product-dialog");
    await expect(dialog).toBeVisible();

    const titleInput = dialog.getByRole("textbox", { name: "Título" });
    const titleField = titleInput.locator("xpath=ancestor::fieldset[1]");
    const labelledBy = await titleInput.getAttribute("aria-labelledby");
    expect(labelledBy, "aria-labelledby presente").toBeTruthy();
    await expect(dialog.locator(`#${labelledBy}`)).toHaveText("Título");

    await titleInput.fill("");
    const fieldError = titleField.getByTestId("ui-field-error");
    await expect(fieldError).toContainText("Escribí un título");
    const describedBy = await titleInput.getAttribute("aria-describedby");
    expect(describedBy, "aria-describedby presente con error").toBeTruthy();
    await expect(dialog.locator(`#${describedBy}`)).toHaveText(/Escribí un título/);
    await expect(titleInput).toHaveAttribute("aria-invalid", "true");
    await expect(titleField).toHaveAttribute("aria-invalid", "true");

    await titleInput.fill("Remera esencial de algodón");
    await expect(titleField.getByTestId("ui-field-error")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(dialog).toBeHidden();
  });

  test("IconButton expone label como aria-label y title", async ({ page }) => {
    await openCatalog(page);
    await rows(page).nth(0).getByRole("button", { name: "Editar" }).click();
    const dialog = page.locator("dialog.product-dialog");
    await expect(dialog).toBeVisible();

    const close = dialog.getByRole("button", { name: "Cerrar editor" });
    await expect(close).toHaveAttribute("aria-label", "Cerrar editor");
    await expect(close).toHaveAttribute("title", "Cerrar editor");
    await expect(close).toHaveAttribute("type", "button");

    await close.click();
    await expect(dialog).toBeHidden();
  });

  test("Button disabled: la paginación deshabilita Anterior/Siguiente en los extremos", async ({
    page,
  }) => {
    await openCatalog(page);
    await expect(page.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });

  test("EmptyState en catálogo vacío con acción y InlineError con role=alert", async ({ page }) => {
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
    await createCleanStore(page, "Tienda A22");
    await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Catálogo", exact: true })).toBeVisible();

    const empty = page.getByTestId("ui-empty-state").filter({ hasText: "El catálogo está vacío" });
    await expect(empty).toBeVisible();
    await expect(empty.getByRole("button", { name: "Agregar producto" })).toBeVisible();

    await page.getByRole("button", { name: "Volver a tiendas" }).click();
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
    await page.getByRole("button", { name: "Nueva tienda", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Crear tienda" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Continuar", exact: true }).click();

    const inlineError = page.getByTestId("ui-inline-error");
    await expect(inlineError).toBeVisible();
    await expect(inlineError).toHaveAttribute("role", "alert");
    await expect(inlineError).toContainText("Escribí un nombre");

    await page.getByLabel("Nueva tienda").fill("Tienda A22 OK");
    await dialog.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(inlineError).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});
