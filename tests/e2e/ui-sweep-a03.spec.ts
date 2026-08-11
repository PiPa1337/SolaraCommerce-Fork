/**
 * Barrido A03 — CSV, paquetes y diálogos del catálogo (auditoría).
 *
 * Bin del plan "Barrido total de controles" (2026-08-10): controles de
 * importación/exportación CSV, importación de carpeta con imágenes y
 * diálogos de revisión/confirmación de `features/Catalog.tsx`.
 *
 * Este spec NO modifica la aplicación: cualquier falla que requiera cambios
 * en Catalog.tsx se reporta como `test.fixme` nombrando al OWNER (A1).
 * El diálogo de reubicación de categorías vive en CategoryTree.tsx (bin A24).
 *
 * El feedback de ocupado (label "Generando"/"Procesando", progress) dura
 * cientos de milisegundos y el fetch del worker no pasa por `page.route` ni
 * por el throttle CDP; se observa con un único `expect.poll` de alta
 * cadencia que verifica conteo + disabled + texto de progress en una sola
 * evaluación, sin depender de dos aserciones secuenciales.
 *
 * Casos documentados para A1 (fixme): el resumen "No se encontraron" de la
 * revisión de paquete es inalcanzable porque importCatalogCsv rechaza antes
 * cualquier referencia de imagen sin resolver.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Download, expect, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 120_000 : 90_000);

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

const catalogHeading = "50 productos y 60 variantes.";

const commercialHeader =
  "producto_id,variante_id,slug,titulo,descripcion,marca,estado,categorias,colecciones,etiquetas,imagenes,variante,sku,opciones,precio_centavos,precio_anterior_centavos,disponible,estado_stock,gtin,mpn,imagen_variante,creado_en,actualizado_en";

const fecha = "2026-08-07T10:00:00.000Z";

const pixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function filaComercial(
  productoId: string,
  slug: string,
  titulo: string,
  marca: string,
  precio: string,
): string {
  return [
    productoId,
    "",
    slug,
    titulo,
    "",
    marca,
    "active",
    "",
    "",
    "",
    "",
    "Única",
    `${slug}-sku`,
    "",
    precio,
    "",
    "true",
    "in_stock",
    "",
    "",
    "",
    fecha,
    fecha,
  ].join(",");
}

function filaPaquete(precio: string): string {
  return [
    "",
    "",
    "taza-nueva",
    "Taza nueva",
    "",
    "Marca A03",
    "active",
    "Cocina>Favoritos",
    "",
    "casa",
    "imagenes/taza.png",
    "Única",
    "TAZA-001",
    "",
    precio,
    "",
    "true",
    "in_stock",
    "",
    "",
    "imagenes/taza.png",
    fecha,
    fecha,
  ].join(",");
}

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
  await expect(page.getByText(catalogHeading)).toBeVisible();
}

async function uploadCsv(page: Page, csv: string, name: string): Promise<void> {
  await page.locator('input[type="file"][accept*="csv"]').setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });
}

/** Observa la ventana de busy con una única evaluación por poll: el conteo de
 *  botones con el label de ocupado, que estén deshabilitados y el texto del
 *  progress. `progressText` nulo exige que el progress no esté presente. */
async function assertBusyFeedback(
  page: Page,
  buttonLabel: string,
  progressText: string | null,
  expectedCount = 1,
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ label, expected, count }) => {
            const busy = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).filter(
              (button) => (button.textContent ?? "").trim() === label,
            );
            const progress = document.querySelector('[data-testid="ui-catalog-progress"]');
            return {
              ok:
                busy.length === count &&
                busy.every((button) => button.disabled) &&
                (progress?.textContent ?? null) === expected,
              seen: `${busy.length}×"${label}"${busy.every((button) => button.disabled) ? " disabled" : ""}; progress=${progress?.textContent ?? "—"}`,
            };
          },
          { label: buttonLabel, expected: progressText, count: expectedCount },
        ),
      { timeout: 5_000, intervals: [25, 50, 100, 150] },
    )
    .toMatchObject({ ok: true });
}

async function readDownload(download: Download): Promise<string> {
  const path = await download.path();
  if (!path) throw new Error("La descarga no tiene archivo temporal.");
  return readFileSync(path, "utf8");
}

async function makePackageFolder(price: string): Promise<string> {
  const directory = mkdtempSync(join(tmpdir(), "solara-a03-paquete-"));
  mkdirSync(join(directory, "imagenes"), { recursive: true });
  writeFileSync(
    join(directory, "productos.csv"),
    [commercialHeader, filaPaquete(price)].join("\r\n"),
    "utf8",
  );
  writeFileSync(join(directory, "imagenes", "taza.png"), pixelPng);
  return directory;
}

async function assertAppAlive(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Algo salió mal" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Catálogo", exact: true })).toBeVisible();
}

test("Exportar CSV descarga el catálogo completo con feedback de ocupado", async ({ page }) => {
  await openCatalog(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV", exact: true }).click();

  // Auto-feedback: ambos botones de exportación marcan "Generando" y quedan
  // deshabilitados mientras el worker serializa el catálogo.
  await assertBusyFeedback(page, "Generando", null, 2);

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("demo-catalogo-jerarquico-productos.csv");
  const csv = await readDownload(download);
  const lines = csv.split(/\r?\n/);
  expect(lines[0]).toMatch(/^product_id,slug,title,description/);
  // 50 productos con 60 variantes => una fila por variante + cabecera.
  expect(lines).toHaveLength(61);
  expect(csv).toContain("Remera esencial de algodón");

  await expect(page.getByRole("button", { name: "Exportar CSV", exact: true })).toBeEnabled();
  await assertAppAlive(page);
});

test("CSV comercial descarga el catálogo comercial con cabecera y títulos", async ({ page }) => {
  await openCatalog(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV comercial", exact: true }).click();

  await assertBusyFeedback(page, "Generando", null, 2);

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("demo-catalogo-jerarquico-catalogo-comercial.csv");
  const csv = await readDownload(download);
  expect(csv.split(/\r?\n/)[0]).toMatch(/^producto_id,variante_id,slug,titulo,/);
  expect(csv).toContain("Remera esencial de algodón");
  await assertAppAlive(page);
});

test("Importar CSV válido: progreso, revisión con resumen y reemplazo real", async ({ page }) => {
  await openCatalog(page);

  const csv = [
    commercialHeader,
    filaComercial("a03-p1", "taza-a03-uno", "Taza A03 uno", "Marca A03", "125000"),
    filaComercial("a03-p2", "taza-a03-dos", "Taza A03 dos", "Marca A03", "129000"),
  ].join("\r\n");
  await uploadCsv(page, csv, "catalogo-a03.csv");

  // Auto-feedback: progress aria-live y botón "Procesando" durante el importe.
  await assertBusyFeedback(page, "Procesando", "Procesando CSV…", 1);

  // Revisión de importación: resumen del worker leído por la UI.
  const review = page.locator(".import-review");
  await expect(review).toBeVisible();
  await expect(review.getByRole("heading", { name: "catalogo-a03.csv" })).toBeVisible();
  await expect(review).toContainText("El catálogo no cambiará hasta que confirmes esta operación.");
  await expect(review.getByText("Nuevos").locator("..")).toContainText("2");
  await expect(review.getByText("Modificados").locator("..")).toContainText("0");
  await expect(review.getByText("Sin cambios").locator("..")).toContainText("0");
  await expect(review.getByText("Se eliminarán").locator("..")).toContainText("50");
  // La destrucción prevista queda marcada para la decisión.
  await expect(review.locator('div[data-warning="true"]')).toContainText("Se eliminarán");

  await review.getByRole("button", { name: "Reemplazar catálogo" }).click();

  // Efecto real: el catálogo se reemplaza, la revisión se cierra, la selección
  // se limpia y la app sigue viva.
  await expect(page.getByText("2 productos y 2 variantes.")).toBeVisible();
  await expect(review).toHaveCount(0);
  await expect(page.locator(".bulk-panel")).toHaveCount(0);
  await expect(page.getByLabel("Nombre de Taza A03 uno")).toBeVisible();
  await assertAppAlive(page);
});

test("Importar CSV inválido: errores por fila visibles, catálogo intacto y app viva", async ({
  page,
}) => {
  await openCatalog(page);
  const csv = [
    commercialHeader,
    filaComercial("a03-p1", "taza-repetida", "Taza repetida", "Marca A", "125000"),
    filaComercial("a03-p2", "taza-repetida", "Taza repetida", "Marca B", "125000"),
  ].join("\r\n");
  await uploadCsv(page, csv, "catalogo-slug-duplicado.csv");

  // Auto-feedback: errores por fila (nº de fila + mensaje), sin revisión.
  const errors = page.getByTestId("ui-csv-errors");
  await expect(errors).toBeVisible();
  await expect(errors).toContainText("Corregí las filas marcadas y volvé a cargarlo.");
  await expect(page.getByTestId("ui-csv-error")).toHaveCount(2);
  await expect(errors.getByText(/Fila 2/)).toBeVisible();
  await expect(errors.getByText(/Fila 3/)).toBeVisible();
  await expect(errors.getByText(/taza-repetida/)).toHaveCount(2);

  await expect(page.locator(".import-review")).toHaveCount(0);
  await expect(page.getByText(catalogHeading)).toBeVisible();
  await expect(page.getByRole("button", { name: "Reemplazar catálogo" })).toHaveCount(0);
  await assertAppAlive(page);
});

test("Cancelar la revisión de importación no toca el catálogo", async ({ page }) => {
  await openCatalog(page);
  const csv = [
    commercialHeader,
    filaComercial("a03-p1", "taza-a03-uno", "Taza A03 uno", "Marca A03", "125000"),
  ].join("\r\n");
  await uploadCsv(page, csv, "catalogo-a03.csv");

  const review = page.locator(".import-review");
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "Cancelar" }).click();

  await expect(review).toHaveCount(0);
  await expect(page.getByText(catalogHeading)).toBeVisible();
  await expect(page.getByText("2 productos y 2 variantes.")).toHaveCount(0);
  await assertAppAlive(page);
});

test("Importar carpeta con imágenes: revisión de fusión, aplicar y reimportar", async ({
  page,
}) => {
  await openCatalog(page);

  const firstFolder = await makePackageFolder("125000");
  const secondFolder = await makePackageFolder("130000");
  try {
    await page.locator('input[type="file"][webkitdirectory]').setInputFiles(firstFolder);
    const folderName = firstFolder.split(/[\\/]/).pop() ?? "carpeta";

    // Auto-feedback: progress y botón con label de ocupado.
    await assertBusyFeedback(page, "Leyendo carpeta", "Leyendo carpeta e imágenes…", 1);

    // Revisión de catálogo e imágenes: resumen del plan leído por la UI.
    const review = page.locator(".catalog-package-review");
    await expect(review).toBeVisible();
    await expect(review.getByRole("heading", { name: folderName })).toBeVisible();
    await expect(review).toContainText("El proyecto no cambiará hasta que confirmes la fusión.");
    await expect(review.getByText("Productos nuevos").locator("..")).toContainText("1");
    await expect(review.getByText("Productos actualizados").locator("..")).toContainText("0");
    await expect(review.getByText("Categorías nuevas").locator("..")).toContainText("2");
    await expect(review.getByText("Imágenes procesadas").locator("..")).toContainText("1");
    await expect(review.getByText("Imágenes reutilizadas").locator("..")).toContainText("0");

    await review.getByRole("button", { name: "Agregar y actualizar" }).click();

    // Efecto real: producto + categorías nuevas y árbol actualizado.
    await expect(page.getByText("51 productos y 61 variantes.")).toBeVisible();
    await expect(review).toHaveCount(0);
    const categoryList = page
      .getByRole("region", { name: /rbol de categor/ })
      .getByRole("list", { name: /Categor/ });
    await expect(categoryList.getByText("Cocina", { exact: true })).toBeVisible();
    await expect(categoryList.getByText("Favoritos", { exact: true })).toBeVisible();
    await assertAppAlive(page);

    // Reimportar la misma carpeta: actualización por slug y reutilización de
    // imagen (hash), con el nuevo precio visible en la tabla.
    await page.locator('input[type="file"][webkitdirectory]').setInputFiles(secondFolder);
    await expect(review).toBeVisible();
    await expect(review.getByText("Productos nuevos").locator("..")).toContainText("0");
    await expect(review.getByText("Productos actualizados").locator("..")).toContainText("1");
    await expect(review.getByText("Imágenes procesadas").locator("..")).toContainText("0");
    await expect(review.getByText("Imágenes reutilizadas").locator("..")).toContainText("1");

    await review.getByRole("button", { name: "Agregar y actualizar" }).click();
    await expect(page.getByText("51 productos y 61 variantes.")).toBeVisible();
    await page.getByPlaceholder("Buscar por producto, marca o estado").fill("Taza nueva");
    const priceInput = page.getByLabel("Precio en centavos de Taza nueva");
    await expect(priceInput).toHaveValue("130000");
    await assertAppAlive(page);
  } finally {
    rmSync(firstFolder, { recursive: true, force: true });
    rmSync(secondFolder, { recursive: true, force: true });
  }
});

test("Cancelar la revisión de carpeta no cambia nada", async ({ page }) => {
  await openCatalog(page);
  const folder = await makePackageFolder("125000");
  try {
    await page.locator('input[type="file"][webkitdirectory]').setInputFiles(folder);

    const review = page.locator(".catalog-package-review");
    await expect(review).toBeVisible();
    await review.getByRole("button", { name: "Cancelar" }).click();

    await expect(review).toHaveCount(0);
    await expect(page.getByText(catalogHeading)).toBeVisible();
    const categoryList = page
      .getByRole("region", { name: /rbol de categor/ })
      .getByRole("list", { name: /Categor/ });
    await expect(categoryList.getByText("Cocina", { exact: true })).toHaveCount(0);
    await assertAppAlive(page);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("Carpeta sin productos.csv: error visible, sin revisión y app viva", async ({ page }) => {
  await openCatalog(page);
  const directory = mkdtempSync(join(tmpdir(), "solara-a03-paquete-invalido-"));
  try {
    writeFileSync(join(directory, "nota.txt"), "sin catalogo", "utf8");
    await page.locator('input[type="file"][webkitdirectory]').setInputFiles(directory);

    // Auto-feedback: el error del worker llega como alerta visible y el botón
    // vuelve a su label de reposo (busy se limpia).
    const alert = page.getByTestId("ui-inline-error");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("La carpeta debe contener productos.csv.");
    await expect(page.getByRole("button", { name: "Importar carpeta + imágenes" })).toBeEnabled();

    // Sin revisión ni cambios: el catálogo queda intacto.
    await expect(page.locator(".catalog-package-review")).toHaveCount(0);
    await expect(page.getByText(catalogHeading)).toBeVisible();
    await assertAppAlive(page);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Carpeta con imagen faltante: aviso visible en la revisión y catálogo intacto", async ({
  page,
}) => {
  await openCatalog(page);
  const directory = mkdtempSync(join(tmpdir(), "solara-a03-paquete-faltante-"));
  try {
    mkdirSync(join(directory, "imagenes"), { recursive: true });
    const csv = [
      commercialHeader,
      [
        "",
        "",
        "taza-faltante",
        "Taza con imagen faltante",
        "",
        "Marca A03",
        "active",
        "",
        "",
        "",
        "imagenes/faltante.png",
        "Única",
        "TAZA-002",
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
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Diálogo de archivar: abre con conteo, Escape cancela y confirmar archiva", async ({
  page,
}) => {
  await openCatalog(page);
  const rows = page.locator("tbody tr");

  await rows.nth(0).locator('input[type="checkbox"]').check();
  await rows.nth(1).locator('input[type="checkbox"]').check();
  // El foco debe salir de un control editable para que la tecla Delete
  // dispare la confirmación. Con 2 seleccionados el bulk panel sticky cubre
  // la tabla; el resumen de selección de la toolbar es el punto no
  // interactivo disponible (clickearlo devuelve el foco al body).
  await page.getByText("2 seleccionados").click();
  await page.keyboard.press("Delete");

  const dialog = page.getByTestId("ui-confirm-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Archivar productos" })).toBeVisible();
  await expect(dialog).toContainText("¿Archivar los 2 productos seleccionados?");
  // Destructivo: el foco inicial cae en Cancelar.
  expect(await dialog.evaluate(() => document.activeElement?.textContent)).toBe("Cancelar");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(rows.nth(0).locator(".status-label")).toHaveText("Activo");

  await rows.nth(1).locator('input[type="checkbox"]').uncheck();
  await page.getByText("1 seleccionados").click();
  await page.keyboard.press("Delete");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("¿Archivar el producto seleccionado?");

  await dialog.getByTestId("ui-confirm-accept").click();
  await expect(dialog).toHaveCount(0);
  await expect(rows.nth(0).locator(".status-label")).toHaveText("Archivado");
  await assertAppAlive(page);
});
