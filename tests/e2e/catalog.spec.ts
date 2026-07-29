import type { Server } from "node:http";
import { expect, test } from "@playwright/test";
import { exportProductsCsv, generatePerformanceFixture } from "@solara/core";
import { startStudioServer, stopStudioServer } from "./studio-server";

const performanceCsv = exportProductsCsv(generatePerformanceFixture(1_000).products);
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

async function openCatalog(page: import("@playwright/test").Page) {
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await page.getByRole("button", { name: /Casa Luma/ }).click();
  await page.getByRole("button", { name: "Catálogo" }).click();
  await expect(page.getByRole("heading", { name: "Catálogo" })).toBeVisible();
}

async function uploadCsv(page: import("@playwright/test").Page) {
  await page.locator('input[type="file"][accept*="csv"]').setInputFiles({
    name: "catalogo-1000.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(performanceCsv, "utf8"),
  });
  await expect(page.getByRole("heading", { name: "catalogo-1000.csv" })).toBeVisible();
}

async function clickDom(locator: import("@playwright/test").Locator) {
  await locator.evaluate((element: HTMLElement) => element.click());
}

test("edita variantes y conserva el último cambio al volver, recargar y reabrir", async ({
  page,
}) => {
  await openCatalog(page);
  await page.getByRole("button", { name: "Agregar producto" }).first().click();

  const dialog = page.locator("dialog.product-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Título" }).fill("Lámpara Horizonte");
  await dialog.getByRole("textbox", { name: "Slug" }).fill("lampara-horizonte");
  await dialog.getByRole("textbox", { name: "Marca" }).fill("Casa Luma");
  await dialog.getByRole("textbox", { name: "Descripción" }).fill("Luz puntual de lectura.");
  await dialog.getByRole("textbox", { name: "SKU" }).fill("LUZ-HOR-01");
  await dialog.getByRole("textbox", { name: "Opciones" }).fill("Color=Grafito");
  await dialog.getByRole("spinbutton", { name: "Precio en centavos" }).fill("125000");
  await dialog.getByRole("button", { name: "Agregar variante" }).click();

  const variants = dialog.locator(".variant-editor");
  await expect(variants).toHaveCount(2);
  await variants.nth(1).getByRole("textbox", { name: "Nombre" }).fill("Arena");
  await variants.nth(1).getByRole("textbox", { name: "SKU" }).fill("LUZ-HOR-02");
  await variants.nth(1).getByRole("textbox", { name: "Opciones" }).fill("Color=Arena");
  await variants.nth(1).getByRole("spinbutton", { name: "Precio en centavos" }).fill("129000");
  await dialog.getByRole("button", { name: "Crear producto" }).click();

  await page.getByPlaceholder("Buscar por producto, marca o estado").fill("Lámpara Horizonte");
  await expect(page.getByLabel("Nombre de Lámpara Horizonte")).toBeVisible();
  await page.getByLabel("Seleccionar Lámpara Horizonte").check();
  await page.getByLabel("Estado").selectOption("archived");
  await page.getByRole("button", { name: "Aplicar estado" }).click();
  await expect(page.locator("tbody .status-label", { hasText: "Archivado" })).toBeVisible();

  await page.getByRole("button", { name: "Volver a tiendas" }).click();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Casa Luma/ }).click();
  await page.getByRole("button", { name: "Catálogo" }).click();
  await page.getByPlaceholder("Buscar por producto, marca o estado").fill("Lámpara Horizonte");
  await expect(page.getByLabel("Nombre de Lámpara Horizonte")).toBeVisible();
  await expect(page.locator("tbody .status-label", { hasText: "Archivado" })).toBeVisible();

  await page.getByRole("button", { name: "Editar" }).click();
  await expect(page.getByRole("dialog").locator(".variant-editor")).toHaveCount(2);
});

test("previsualiza, cancela y confirma 1.000 productos con selección entre páginas", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openCatalog(page);
  await uploadCsv(page);

  const review = page.locator(".import-review");
  await expect(review.getByText("1000", { exact: true })).toBeVisible();
  await expect(review.getByText("2", { exact: true })).toBeVisible();
  await clickDom(page.getByRole("button", { name: "Cancelar" }));
  await expect(page.getByText("2 productos y 3 variantes.")).toBeVisible();

  await uploadCsv(page);
  await clickDom(page.getByRole("button", { name: "Reemplazar catálogo" }));
  await expect(page.getByText("1000 productos y 2000 variantes.")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("tbody tr")).toHaveCount(50);

  await clickDom(page.getByRole("button", { name: "Seleccionar 1000 filtrados" }));
  await expect(page.getByText("1000 seleccionados")).toBeVisible();
  await clickDom(page.getByRole("button", { name: "Siguiente" }));
  await expect(page.getByText("1000 seleccionados")).toBeVisible();
  await expect(page.locator('thead input[type="checkbox"]')).toBeChecked();

  await page.getByLabel("Estado").selectOption("archived");
  await clickDom(page.getByRole("button", { name: "Aplicar estado" }));
  await expect(page.locator("tbody .status-label", { hasText: "Archivado" }).first()).toBeVisible();
  await clickDom(page.getByRole("button", { name: "Deshacer" }));
  await expect(page.locator("tbody .status-label", { hasText: "Activo" }).first()).toBeVisible();
  await clickDom(page.getByRole("button", { name: "Rehacer" }));
  await expect(page.locator("tbody .status-label", { hasText: "Archivado" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Volver a tiendas" }).click();
  await page.reload();
  await page.getByRole("button", { name: /Casa Luma/ }).click();
  await page.getByRole("button", { name: "Catálogo" }).click();
  await expect(page.getByText("1000 productos y 2000 variantes.")).toBeVisible();
  expect(await page.locator("tbody tr").count()).toBeLessThanOrEqual(100);
});
