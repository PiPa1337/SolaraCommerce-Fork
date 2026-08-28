/**
 * Barrido A01 — Catálogo: filas, búsqueda, orden y paginación (owner de
 * `apps/studio/src/features/Catalog.tsx`). Contrato de 3 capas por control:
 * (1) click → efecto real en filas/estado, (2) auto-feedback del control
 * (aria-sort, aria-current, contadores, data-selected, select con su valor),
 * (3) payload del handler → receptor (estado de Catalog → @tanstack/react-table).
 *
 * Fixture determinista: la demo integrada (seed demo) tiene 50 productos
 * ("Remera esencial de algodón", "Remera gráfica Horizonte", …), marca
 * cíclica de 5 (Predeterminado, Línea Base, Taller Norte, Estudio Liso, Bruma),
 * todos activos, precios 2800000 + n·85000 centavos y variantes [8,2,2,2,1,…].
 * Categorías por índice i (0-49): raíz = i%8 (remeras, camisas, pantalones,
 * abrigos, vestidos, tejidos, calzado, accesorios); las hijas de remeras y
 * pantalones eligen [basicas,graficas,manga-larga]/[jeans,sastreros,shorts]
 * con i%3. Conteos: remeras 7, basicas 3, camisas 7, pantalones 6, jeans 2,
 * abrigos/vestidos/tejidos/calzado/accesorios 6.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { openMutableScaleStore } from "./project-helpers";
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
  await openMutableScaleStore(page, "Tienda escala A01");
  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catálogo" })).toBeVisible();
  await expect(rows(page)).toHaveCount(50);
}

const rows = (page: Page) =>
  page.locator("tbody tr").filter({ hasNot: page.locator("td.table-empty") });
const titles = (page: Page) => rows(page).locator('input[aria-label^="Nombre de "]');
const titleOf = (page: Page, index: number) => titles(page).nth(index).inputValue();
const priceInput = (page: Page, index: number) =>
  rows(page).nth(index).getByTestId("ui-price-edit");
const searchBox = (page: Page) => page.getByPlaceholder("Buscar por producto, marca o estado");
const categoryFilter = (page: Page) => page.getByLabel("Filtrar categoría");
const paginationSummary = (page: Page) => page.locator(".ui-pagination__summary");
const pageSizeSelect = (page: Page) => page.getByLabel("Filas por página");
const currentPage = (page: Page) => page.locator('.ui-pagination__page[aria-current="page"]');
const pageButton = (page: Page, label: string) =>
  page.locator(".ui-pagination__page", { hasText: label });
const emptyMessage = (page: Page) => page.locator(".table-empty");
const bulkPanel = (page: Page) => page.getByRole("region", { name: "Acciones masivas" });

async function blurFocus(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
}

const priceKindSelect = (page: Page) => bulkPanel(page).getByRole("combobox", { name: "Ajuste" });
const priceValueInput = (page: Page) =>
  bulkPanel(page).getByRole("spinbutton", { name: /Valor %|Centavos/ });

const commercialHeader =
  "producto_id,variante_id,slug,titulo,descripcion,marca,estado,categorias,colecciones,etiquetas,imagenes,variante,sku,opciones,precio_centavos,precio_anterior_centavos,disponible,estado_stock,gtin,mpn,imagen_variante,creado_en,actualizado_en";

const fecha = "2026-08-07T10:00:00.000Z";

test.describe("A1 — Catálogo: búsqueda", () => {
  test("busca por título, marca y estado; limpiar restaura las 50 filas", async ({ page }) => {
    await openCatalog(page);

    await searchBox(page).fill("Remera");
    await expect(rows(page)).toHaveCount(6);
    await expect(titleOf(page, 0)).resolves.toBe("Remera esencial de algodón");

    await searchBox(page).fill("Predeterminado");
    await expect(rows(page)).toHaveCount(10);
    const brands = await rows(page)
      .locator('input[aria-label^="Marca de "]')
      .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
    expect(brands.every((brand) => brand === "Predeterminado")).toBe(true);

    await searchBox(page).fill("Activo");
    await expect(rows(page)).toHaveCount(50);

    await searchBox(page).fill("Archivado");
    await expect(rows(page)).toHaveCount(0);
    await expect(emptyMessage(page)).toContainText("No hay productos que coincidan");
    await expect(paginationSummary(page)).toHaveText("0 resultados");
    await expect(currentPage(page)).toHaveText("1");

    await searchBox(page).fill("");
    await expect(rows(page)).toHaveCount(50);
    await expect(titleOf(page, 0)).resolves.toBe("Remera esencial de algodón");
  });
});

test.describe("A1 — Catálogo: filtro de categoría", () => {
  test("filtra por raíz e hija y restaurar devuelve las 50", async ({ page }) => {
    await openCatalog(page);

    await categoryFilter(page).selectOption({ label: "Remeras" });
    await expect(rows(page)).toHaveCount(7);
    await expect(paginationSummary(page)).toHaveText("1–7 de 7");
    await expect(titleOf(page, 0)).resolves.toBe("Remera esencial de algodón");

    await categoryFilter(page).selectOption({ label: "Básicas" });
    await expect(rows(page)).toHaveCount(3);
    await expect(titleOf(page, 0)).resolves.toBe("Remera esencial de algodón");

    await categoryFilter(page).selectOption({ label: "Camisas" });
    await expect(rows(page)).toHaveCount(7);
    await expect(titleOf(page, 0)).resolves.toBe("Remera gráfica Horizonte");

    await categoryFilter(page).selectOption({ label: "Jeans" });
    await expect(rows(page)).toHaveCount(2);
    await expect(paginationSummary(page)).toHaveText("1–2 de 2");
    await expect(titleOf(page, 0)).resolves.toBe("Gorra Visera");

    await categoryFilter(page).selectOption("");
    await expect(rows(page)).toHaveCount(50);
    await expect(paginationSummary(page)).toHaveText("1–50 de 50");
  });

  test("el filtro de categoría se combina con la búsqueda", async ({ page }) => {
    await openCatalog(page);

    await categoryFilter(page).selectOption({ label: "Remeras" });
    await searchBox(page).fill("Remera");
    await expect(rows(page)).toHaveCount(3);

    await searchBox(page).fill("");
    await expect(rows(page)).toHaveCount(7);

    await categoryFilter(page).selectOption("");
    await expect(rows(page)).toHaveCount(50);
  });
});

test.describe("A1 — Catálogo: orden", () => {
  test("título: asc → desc → sin orden, con aria-sort y reorden real", async ({ page }) => {
    await openCatalog(page);
    const header = page.locator("th", { hasText: "Producto" });
    const sortButton = page.getByRole("button", { name: "Producto", exact: true });

    await sortButton.click();
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await expect(titleOf(page, 0)).resolves.toBe("Abrigo corto Umbral");
    await expect(titleOf(page, 49)).resolves.toBe("Zapatilla Urbana");
    await expect(header.locator(".table-sort svg")).toHaveCount(1);

    await sortButton.click();
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await expect(titleOf(page, 0)).resolves.toBe("Zapatilla Urbana");
    await expect(titleOf(page, 49)).resolves.toBe("Abrigo corto Umbral");

    await sortButton.click();
    await expect(header).not.toHaveAttribute("aria-sort", /ascending|descending/);
    await expect(header.locator(".table-sort svg")).toHaveCount(0);
    await expect(titleOf(page, 0)).resolves.toBe("Remera esencial de algodón");
  });

  test("variantes: reordena de verdad por cantidad de variantes", async ({ page }) => {
    await openCatalog(page);
    const variantsCell = (index: number) => rows(page).nth(index).locator("td").nth(7);

    await page.getByRole("button", { name: "Variantes", exact: true }).click();
    await expect(page.locator("th", { hasText: "Variantes" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await expect(titleOf(page, 0)).resolves.toBe("Camisa Rayas Finas");
    await expect(variantsCell(0)).toHaveText("1");
    await expect(variantsCell(46)).toHaveText("2");
    await expect(variantsCell(49)).toHaveText("8");
    await expect(titleOf(page, 49)).resolves.toBe("Remera esencial de algodón");

    await page.getByRole("button", { name: "Variantes", exact: true }).click();
    await expect(page.locator("th", { hasText: "Variantes" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    await expect(titleOf(page, 0)).resolves.toBe("Remera esencial de algodón");
    await expect(variantsCell(0)).toHaveText("8");
    await expect(variantsCell(1)).toHaveText("2");
    await expect(variantsCell(4)).toHaveText("1");
  });

  test("precio: el más barato primero (centavos enteros)", async ({ page }) => {
    await openCatalog(page);

    await page.getByRole("button", { name: "Precio", exact: true }).click();
    await expect(page.locator("th", { hasText: "Precio" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await expect(priceInput(page, 0)).toHaveValue("2885000");
    await expect(priceInput(page, 49)).toHaveValue("7050000");
  });
});

test.describe("A1 — Catálogo: selección de fila", () => {
  test("el checkbox de fila marca la fila y el contador es honesto", async ({ page }) => {
    await openCatalog(page);

    await rows(page).nth(0).getByRole("checkbox").check();
    await expect(rows(page).nth(0)).toHaveAttribute("data-selected", "true");
    await expect(rows(page).nth(1)).toHaveAttribute("data-selected", "false");
    await expect(page.getByText("1 seleccionados", { exact: true })).toBeVisible();
    await expect(bulkPanel(page)).toContainText("1 productos seleccionados");

    await rows(page).nth(0).getByRole("checkbox").uncheck();
    await expect(page.getByText("0 seleccionados", { exact: true })).toBeVisible();
    await expect(bulkPanel(page)).toHaveCount(0);
  });
});

test.describe("A1 — Catálogo: paginación", () => {
  test("con 50 filas: una página marcada y conteo honesto", async ({ page }) => {
    await openCatalog(page);

    await expect(paginationSummary(page)).toHaveText("1–50 de 50");
    await expect(page.locator(".ui-pagination__page")).toHaveCount(1);
    await expect(currentPage(page)).toHaveText("1");
    await expect(page.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });

  test("tamaño 25: navegación con página actual marcada y resumen honesto", async ({ page }) => {
    await openCatalog(page);

    await pageSizeSelect(page).selectOption("25");
    await expect(rows(page)).toHaveCount(25);
    await expect(paginationSummary(page)).toHaveText("1–25 de 50");
    await expect(currentPage(page)).toHaveText("1");
    await expect(page.getByRole("button", { name: "Siguiente" })).toBeEnabled();

    await pageButton(page, "2").click();
    await expect(rows(page)).toHaveCount(25);
    await expect(paginationSummary(page)).toHaveText("26–50 de 50");
    await expect(currentPage(page)).toHaveText("2");
    await expect(titleOf(page, 0)).resolves.toBe("Remera gráfica Ruta");
    await expect(page.getByRole("button", { name: "Anterior" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Siguiente" })).toBeDisabled();

    await page.getByRole("button", { name: "Anterior" }).click();
    await expect(paginationSummary(page)).toHaveText("1–25 de 50");
    await expect(currentPage(page)).toHaveText("1");
    await expect(titleOf(page, 0)).resolves.toBe("Remera esencial de algodón");
  });

  test("la búsqueda vuelve a la página 1 con resumen honesto", async ({ page }) => {
    await openCatalog(page);

    await pageSizeSelect(page).selectOption("25");
    await pageButton(page, "2").click();
    await expect(currentPage(page)).toHaveText("2");

    await searchBox(page).fill("Predeterminado");
    await expect(rows(page)).toHaveCount(10);
    await expect(paginationSummary(page)).toHaveText("1–10 de 10");
    await expect(currentPage(page)).toHaveText("1");
    await expect(page.locator(".ui-pagination__page")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Anterior" })).toBeDisabled();
  });

  test("regresión: encoger el filtro activo vuelve a la última página válida", async ({ page }) => {
    await openCatalog(page);

    await pageSizeSelect(page).selectOption("25");
    await searchBox(page).fill("Activo");
    await expect(rows(page)).toHaveCount(25);
    await expect(paginationSummary(page)).toHaveText("1–25 de 50");
    await pageButton(page, "2").click();
    await expect(currentPage(page)).toHaveText("2");

    await page.locator('thead input[type="checkbox"]').check();
    await bulkPanel(page).getByRole("combobox", { name: "Estado" }).selectOption("archived");
    await page.getByTestId("apply-bulk-status").click();

    await expect(rows(page)).toHaveCount(25);
    await expect(paginationSummary(page)).toHaveText("1–25 de 25");
    await expect(currentPage(page)).toHaveText("1");
    await expect(emptyMessage(page)).toHaveCount(0);
    await expect(titleOf(page, 0)).resolves.toBe("Remera esencial de algodón");
  });
});

test.describe("A1 — Catálogo: acciones por fila", () => {
  test("Editar por fila abre el editor con el producto correcto", async ({ page }) => {
    await openCatalog(page);

    await rows(page).nth(1).getByRole("button", { name: "Editar" }).click();
    const dialog = page.locator("dialog.product-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Título" })).toHaveValue(
      "Remera gráfica Horizonte",
    );
    await expect(dialog.getByRole("textbox", { name: "Slug" })).toHaveValue(
      "remera-grafica-horizonte",
    );
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
  });

  test("la tecla e abre el editor del producto seleccionado", async ({ page }) => {
    await openCatalog(page);

    await rows(page).nth(0).getByRole("checkbox").check();
    await expect(page.getByText("1 seleccionados", { exact: true })).toBeVisible();
    await blurFocus(page);
    await page.keyboard.press("e");

    const dialog = page.locator("dialog.product-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Título" })).toHaveValue(
      "Remera esencial de algodón",
    );
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
  });
});

test.describe("A1 — Regresión: contratos del barrido (A2/A3)", () => {
  test("el error de ajuste obsoleto (-100%) se limpia tras un ajuste exitoso", async ({ page }) => {
    await openCatalog(page);
    await rows(page).nth(0).getByRole("checkbox").check();
    await expect(bulkPanel(page)).toBeVisible();

    await priceKindSelect(page).selectOption("percentage");
    await priceValueInput(page).fill("-150");
    await bulkPanel(page).getByRole("button", { name: "Ajustar precios" }).click();
    await expect(bulkPanel(page).getByTestId("ui-field-error")).toContainText("mínimo -100%");
    await expect(priceInput(page, 0)).toHaveValue("2885000");

    await priceValueInput(page).fill("5");
    await bulkPanel(page).getByRole("button", { name: "Ajustar precios" }).click();
    await expect(priceInput(page, 0)).toHaveValue("3029250");
    await expect(bulkPanel(page).getByTestId("ui-field-error")).toHaveCount(0);
  });

  test("la revisión de paquete avisa la imagen faltante y la fusión aplica", async ({ page }) => {
    await openCatalog(page);
    const directory = mkdtempSync(join(tmpdir(), "solara-a01-paquete-faltante-"));
    try {
      const csv = [
        commercialHeader,
        [
          "",
          "",
          "taza-faltante",
          "Taza con imagen faltante",
          "",
          "Marca A01",
          "active",
          "",
          "",
          "",
          "imagenes/faltante.png",
          "Única",
          "TAZA-001",
          "",
          "125000",
          "",
          "true",
          "in_stock",
          "",
          "",
          "imagenes/faltante.png",
          fecha,
          fecha,
        ].join(","),
      ].join("\r\n");
      writeFileSync(join(directory, "productos.csv"), csv, "utf8");
      await page.locator('input[type="file"][webkitdirectory]').setInputFiles(directory);

      const review = page.locator(".catalog-package-review");
      await expect(review).toBeVisible();
      await expect(review.getByText(/No se encontraron: imagenes\/faltante\.png/)).toBeVisible();

      await review.getByRole("button", { name: "Agregar y actualizar" }).click();
      await expect(page.getByText("51 productos y 61 variantes.")).toBeVisible();
      await expect(review).toHaveCount(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("con el panel de acciones abierto las filas de la tabla siguen clickeables", async ({
    page,
  }) => {
    await openCatalog(page);
    await rows(page).nth(0).getByRole("checkbox").check();
    await expect(bulkPanel(page)).toBeVisible();
    await expect(page.getByText("1 seleccionados", { exact: true })).toBeVisible();

    await rows(page).nth(1).getByRole("checkbox").check();
    await expect(rows(page).nth(1)).toHaveAttribute("data-selected", "true");
    await expect(page.getByText("2 seleccionados", { exact: true })).toBeVisible();
    await expect(bulkPanel(page)).toContainText("2 productos seleccionados");

    await rows(page).nth(2).getByRole("checkbox").check();
    await expect(page.getByText("3 seleccionados", { exact: true })).toBeVisible();
    await expect(bulkPanel(page)).toContainText("3 productos seleccionados");

    await rows(page).nth(1).getByRole("checkbox").uncheck();
    await expect(page.getByText("2 seleccionados", { exact: true })).toBeVisible();
  });
});
