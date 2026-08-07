/**
 * T0.7 — Workers del editor: errores y progreso.
 * Verifica que el import CSV muestre errores por fila, que las imágenes
 * fallidas se reporten por archivo con mensaje accionable y que la exportación
 * tenga estado "generando" y resultado (éxito o bloqueo crítico).
 */
import type { Server } from "node:http";
import { expect, test } from "@playwright/test";
import { exportProductsCsv, generatePerformanceFixture } from "@solara/core";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 120_000 : 60_000);

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

async function openDemoCatalog(page: import("@playwright/test").Page) {
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

async function openDemoAssets(page: import("@playwright/test").Page) {
  await openDemoCatalog(page);
  await page.getByRole("tab", { name: "Recursos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recursos" })).toBeVisible();
}

const commercialHeader =
  "producto_id,variante_id,slug,titulo,descripcion,marca,estado,categorias,colecciones,etiquetas,imagenes,variante,sku,opciones,precio_centavos,precio_anterior_centavos,disponible,estado_stock,gtin,mpn,imagen_variante,creado_en,actualizado_en";

const fecha = "2026-08-07T10:00:00.000Z";

test("importa CSV y muestra el error de cada fila inválida sin tocar el catálogo", async ({
  page,
}) => {
  await openDemoCatalog(page);
  const filaConPrecioInvalido = [
    "",
    "",
    "taza-rota",
    "Taza rota",
    "",
    "Marca A",
    "active",
    "",
    "",
    "casa",
    "",
    "Única",
    "",
    "",
    "abc",
    "",
    "true",
    "in_stock",
    "",
    "",
    "",
    fecha,
    fecha,
  ];
  const filaConOpcionInvalida = [
    "",
    "",
    "taza-mal-opcion",
    "Taza con opción inválida",
    "",
    "Marca B",
    "active",
    "",
    "",
    "casa",
    "",
    "Única",
    "",
    "Color",
    "12500",
    "",
    "true",
    "in_stock",
    "",
    "",
    "",
    fecha,
    fecha,
  ];
  const filaValida = [
    "",
    "",
    "taza-buena",
    "Taza buena",
    "",
    "Marca C",
    "active",
    "",
    "",
    "casa",
    "",
    "Única",
    "TAZA-001",
    "",
    "125000",
    "",
    "true",
    "in_stock",
    "",
    "",
    "",
    fecha,
    fecha,
  ];
  const csv = [
    commercialHeader,
    filaConPrecioInvalido.join(","),
    filaConOpcionInvalida.join(","),
    filaValida.join(","),
  ].join("\r\n");
  await page.locator('input[type="file"][accept*="csv"]').setInputFiles({
    name: "catalogo-con-errores.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });

  const errors = page.getByTestId("ui-csv-errors");
  await expect(errors).toBeVisible();
  await expect(page.getByTestId("ui-csv-error")).toHaveCount(2);
  await expect(errors.getByText(/Fila 2/)).toBeVisible();
  await expect(errors.getByText(/precio_centavos/)).toBeVisible();
  await expect(errors.getByText(/Fila 3/)).toBeVisible();
  await expect(errors.getByText(/opciones/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Reemplazar catálogo" })).toHaveCount(0);
  await expect(page.getByText("50 productos y 60 variantes.")).toBeVisible();
});

test("deshabilita las acciones y muestra progreso mientras importa un CSV grande", async ({
  page,
}) => {
  await openDemoCatalog(page);
  const csv = exportProductsCsv(generatePerformanceFixture(1_000).products);
  const importButton = page.getByTestId("ui-csv-import");
  await page.locator('input[type="file"][accept*="csv"]').setInputFiles({
    name: "catalogo-1000.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });
  await expect(importButton).toBeDisabled();
  await expect(importButton).toContainText("Procesando");
  await expect(page.getByTestId("ui-catalog-progress")).toContainText("Procesando CSV");
  await page.getByRole("button", { name: "Reemplazar catálogo" }).click({ timeout: 30_000 });
  await expect(page.getByText("1000 productos y 2000 variantes.")).toBeVisible({
    timeout: 30_000,
  });
});

test("reporta por archivo las imágenes que no se pudieron procesar y conserva el resto", async ({
  page,
}) => {
  await openDemoAssets(page);
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  await page.locator('input[type="file"][accept*="webp"]').setInputFiles([
    { name: "taza.png", mimeType: "image/png", buffer: pixel },
    { name: "logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>", "utf8") },
  ]);

  const failures = page.getByTestId("ui-asset-errors");
  await expect(failures).toBeVisible();
  await expect(page.getByTestId("ui-asset-error")).toHaveCount(1);
  await expect(failures).toContainText("logo.svg");
  await expect(failures).toContainText("JPEG, PNG o WebP");
  await expect(page.getByTestId("ui-asset-batch-status")).toContainText("1 imagen agregada");
  await expect(page.locator(".asset-item").last().locator("input").first()).toHaveValue("taza");
});

test("exporta el borrador con estado generando y resultado de éxito", async ({ page }) => {
  test.setTimeout(process.env.CI ? 150_000 : 90_000);
  await openDemoCatalog(page);
  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Exportar" })).toBeVisible();

  const draftButton = page.getByTestId("ui-export-draft");
  await draftButton.click();
  await expect(draftButton).toBeDisabled();
  await expect(draftButton).toContainText("Generando");
  await expect(page.getByTestId("ui-export-progress")).toContainText("sitio borrador");
  await expect(page.getByTestId("ui-export-result")).toContainText("Exportación correcta", {
    timeout: 60_000,
  });
});

test("bloquea la exportación de producción cuando hay errores críticos visibles", async ({
  page,
}) => {
  await openDemoCatalog(page);
  await page.getByRole("button", { name: "Volver a tiendas" }).click();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await createCleanStore(page, "Tienda de auditoría");
  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Exportar" })).toBeVisible();

  await expect(page.getByText(/errores críticos deben resolverse/)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("ui-export-production")).toBeDisabled();
});
