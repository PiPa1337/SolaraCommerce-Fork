import type { Server } from "node:http";
import { expect, test } from "@playwright/test";
import { createCleanStore } from "./project-helpers";
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

const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const TEAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAASSURBVBhXY2BoaPgPxhBGw38AQfQH/dpeE7AAAAAASUVORK5CYII=",
  "base64",
);

const IMAGE_INPUT = 'input[type="file"][accept*="image/"]';
const VIDEO_INPUT = 'input[type="file"][accept*="video/"]';
const DROPZONE = "[data-testid='ui-assets-dropzone']";

async function openAssetsTab(page: import("@playwright/test").Page): Promise<void> {
  await page.getByRole("tab", { name: "Recursos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recursos" })).toBeVisible();
}

async function dropFiles(
  page: import("@playwright/test").Page,
  files: Array<{ name: string; type: string; buffer: Buffer }>,
): Promise<void> {
  const dataTransfer = await page.evaluateHandle((payload) => {
    const transfer = new DataTransfer();
    for (const item of payload) {
      transfer.items.add(new File([item.buffer], item.name, { type: item.type }));
    }
    return transfer;
  }, files);
  await page.dispatchEvent(DROPZONE, "drop", { dataTransfer });
  await dataTransfer.dispose();
}

async function uploadPixel(page: import("@playwright/test").Page): Promise<void> {
  await page.locator(IMAGE_INPUT).setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: PIXEL_PNG,
  });
  await expect(page.getByTestId("ui-asset-batch-status")).toContainText("1 imagen agregada", {
    timeout: 15_000,
  });
}

test("sube un lote con progreso real por archivo, reporta duplicados y libera la UI", async ({
  page,
}) => {
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({ timeout: 20_000 });
  await createCleanStore(page, "Tienda barrido A17 lote");
  await openAssetsTab(page);

  const noiseA = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sin canvas");
    const image = ctx.createImageData(1024, 1024);
    for (let i = 0; i < image.data.length; i += 4) {
      image.data[i] = Math.floor(Math.random() * 256);
      image.data[i + 1] = Math.floor(Math.random() * 256);
      image.data[i + 2] = Math.floor(Math.random() * 256);
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((result) => resolve(result ?? new Blob()), "image/png"),
    );
    return Buffer.from(await blob.arrayBuffer());
  });
  const noiseB = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sin canvas");
    const image = ctx.createImageData(1024, 1024);
    for (let i = 0; i < image.data.length; i += 4) {
      image.data[i] = Math.floor(Math.random() * 256);
      image.data[i + 1] = Math.floor(Math.random() * 256);
      image.data[i + 2] = Math.floor(Math.random() * 256);
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((result) => resolve(result ?? new Blob()), "image/png"),
    );
    return Buffer.from(await blob.arrayBuffer());
  });

  const progress = page.getByTestId("ui-assets-progress");
  await page.locator(IMAGE_INPUT).setInputFiles([
    { name: "ruido-a.png", mimeType: "image/png", buffer: noiseA },
    { name: "ruido-b.png", mimeType: "image/png", buffer: noiseB },
    { name: "ruido-a.png", mimeType: "image/png", buffer: noiseA },
  ]);

  await expect(progress).toBeVisible({ timeout: 15_000 });
  await expect(progress).toHaveAttribute("aria-valuenow", "1", { timeout: 15_000 });

  await expect(page.getByTestId("ui-asset-batch-status")).toContainText("2 imágenes agregadas", {
    timeout: 15_000,
  });
  await expect(page.getByTestId("ui-asset-batch-status")).toContainText("1 duplicada omitida");
  await expect(page.locator(".asset-item")).toHaveCount(2);
  await expect(progress).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Cargar imágenes", exact: true })).toBeEnabled();
});

test("el dropzone acepta el drop, separa tandas mixtas y reporta archivos no compatibles", async ({
  page,
}) => {
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({ timeout: 20_000 });
  await createCleanStore(page, "Tienda barrido A17 drop");
  await openAssetsTab(page);

  await dropFiles(page, [{ name: "pixel.png", type: "image/png", buffer: PIXEL_PNG }]);
  await expect(page.getByTestId("ui-asset-batch-status")).toContainText("1 imagen agregada", {
    timeout: 15_000,
  });
  await expect(page.locator(".asset-item")).toHaveCount(1);

  await dropFiles(page, [{ name: "pixel.png", type: "image/png", buffer: PIXEL_PNG }]);
  await expect(page.getByTestId("ui-asset-batch-status")).toContainText("0 imágenes agregadas", {
    timeout: 15_000,
  });
  await expect(page.getByTestId("ui-asset-batch-status")).toContainText("1 duplicada omitida");
  await expect(page.locator(".asset-item")).toHaveCount(1);

  await dropFiles(page, [
    { name: "pixel.png", type: "image/png", buffer: PIXEL_PNG },
    { name: "clip.mp4", type: "video/mp4", buffer: Buffer.from("fake") },
  ]);
  await expect(page.getByText(/tandas separadas/)).toBeVisible();
  await expect(page.locator(".asset-item")).toHaveCount(1);

  await dropFiles(page, [{ name: "nota.txt", type: "text/plain", buffer: Buffer.from("hola") }]);
  await expect(page.getByText(/no es un archivo compatible/)).toBeVisible();
  await expect(page.locator(".asset-item")).toHaveCount(1);
});

test("el detalle muestra usos coherentes con las referencias del proyecto", async ({ page }) => {
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({ timeout: 20_000 });
  const card = page
    .locator(".dashboard-store-card")
    .filter({ has: page.getByText("Predeterminado", { exact: true }) });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Abrir esta tienda" }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
  await openAssetsTab(page);

  const heroAsset = page.locator(".asset-item").filter({
    has: page.locator('input[value="Campaña Modo Sur"]'),
  });
  await expect(heroAsset).toBeVisible();
  await heroAsset.getByTestId("ui-asset-detail-open").click();
  const detail = page.getByTestId("ui-asset-detail");
  await expect(detail).toBeVisible();

  // Referencias del fixture demo: sección hero (posterAssetId), categorías raíz
  // (imageId) y colecciones «Recién llegados» y «Fin de temporada» (imageId).
  await expect(detail).toContainText("Sección hero");
  await expect(detail).toContainText("Recién llegados");
  await expect(detail).toContainText("Fin de temporada");
  await expect(detail).toContainText("Imagen de categoría");
  expect(await detail.getByTestId("ui-asset-use").count()).toBeGreaterThanOrEqual(4);
  await expect(page.getByTestId("ui-asset-delete")).toBeDisabled();

  await page.getByTestId("ui-asset-detail-close").click();
  await expect(detail).not.toBeAttached();

  const productAsset = page.locator(".asset-item").filter({
    has: page.locator('input[value="Remera esencial negra"]'),
  });
  await expect(productAsset).toBeVisible();
  await productAsset.getByTestId("ui-asset-detail-open").click();
  await expect(detail).toBeVisible();
  await expect(detail).toContainText("Imagen de producto");
  await expect(detail).toContainText("Más elegidos");
  await expect(page.getByTestId("ui-asset-delete")).toBeDisabled();
});

test("eliminar sin usos: confirmar quita la imagen y cancelar la conserva", async ({ page }) => {
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({ timeout: 20_000 });
  await createCleanStore(page, "Tienda barrido A17 borrar");
  await openAssetsTab(page);
  await uploadPixel(page);

  const assetItem = page
    .locator(".asset-item")
    .filter({ has: page.locator('input[value="pixel"]') });
  await expect(assetItem).toBeVisible();
  await assetItem.getByTestId("ui-asset-detail-open").click();
  const detail = page.getByTestId("ui-asset-detail");
  await expect(detail.getByTestId("ui-asset-uses")).toContainText("Sin usos");
  await expect(page.getByTestId("ui-asset-delete")).toBeEnabled();

  await page.getByTestId("ui-asset-delete").click();
  const dialog = page.getByTestId("ui-confirm-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Eliminar imagen");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog).not.toBeAttached();
  await expect(page.locator(".asset-item")).toHaveCount(1);

  await page.getByTestId("ui-asset-delete").click();
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("ui-confirm-accept").click();
  await expect(page.locator(".asset-item")).toHaveCount(0);
  await expect(page.getByText("No hay imágenes")).toBeVisible();
  await expect(page.getByTestId("ui-asset-detail")).not.toBeAttached();
});

test("video: fallos aislados por archivo con límites, hints y estado final", async ({ page }) => {
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({ timeout: 20_000 });
  await createCleanStore(page, "Tienda barrido A17 videos");
  await openAssetsTab(page);

  await page.locator(VIDEO_INPUT).setInputFiles([
    { name: "clip.mov", mimeType: "video/quicktime", buffer: Buffer.from("mov falso") },
    { name: "roto.mp4", mimeType: "video/mp4", buffer: Buffer.from("no es un video") },
    {
      name: "pesado.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.alloc(30 * 1024 * 1024 + 1, 1),
    },
  ]);

  const failures = page.getByTestId("ui-asset-errors");
  await expect(failures).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("ui-asset-error")).toHaveCount(3);
  await expect(failures).toContainText("clip.mov");
  await expect(failures).toContainText("Sólo se aceptan videos MP4 o WebM");
  await expect(failures).toContainText("roto.mp4");
  await expect(failures).toContainText("No se pudo leer la metadata");
  await expect(failures).toContainText("pesado.mp4");
  await expect(failures).toContainText("supera los 30 MB");
  await expect(failures).toContainText("MP4 o WebM de hasta 30 MB");
  await expect(page.getByTestId("ui-asset-batch-status")).toContainText("0 videos agregados");
  await expect(page.getByRole("button", { name: "Cargar video", exact: true })).toBeEnabled();
});

test("el selector de archivos avisa cuando se eligen archivos no compatibles", async ({ page }) => {
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({ timeout: 20_000 });
  await createCleanStore(page, "Tienda barrido A17 picker");
  await openAssetsTab(page);

  await page.locator(IMAGE_INPUT).setInputFiles({
    name: "nota.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hola"),
  });
  await expect(page.getByText(/no es un archivo compatible/)).toBeVisible();
  await expect(page.locator(".asset-item")).toHaveCount(0);

  await page.locator(IMAGE_INPUT).setInputFiles([
    { name: "pixel.png", mimeType: "image/png", buffer: PIXEL_PNG },
    { name: "extra.png", mimeType: "application/octet-stream", buffer: TEAL_PNG },
  ]);
  await expect(page.getByText(/no es un archivo compatible/)).toBeVisible();
  await expect(page.locator(".asset-item")).toHaveCount(0);
});
