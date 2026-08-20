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

test("procesa una imagen, muestra el lote y persiste el asset", async ({ page }) => {
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
  await createCleanStore(page, "Tienda de recursos");
  await page.getByRole("tab", { name: "Recursos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recursos" })).toBeVisible();
  const initialAssetCount = await page.locator(".asset-item").count();

  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  await page.locator('input[type="file"][accept*="image/"]').setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: pixel,
  });

  await expect(page.locator("output").filter({ hasText: "1 imagen agregada" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator(".asset-item")).toHaveCount(initialAssetCount + 1);
  await expect(page.getByText(/^Guardado/, { exact: false })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Tienda de recursos" }).click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await page.getByRole("tab", { name: "Recursos", exact: true }).click();
  await expect(page.locator(".asset-item")).toHaveCount(initialAssetCount + 1);
});

test("el asset del hero de Predeterminado muestra su uso y no se puede borrar", async ({
  page,
}) => {
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 20_000,
  });
  const card = page
    .locator(".dashboard-store-card")
    .filter({ has: page.getByText("Predeterminado", { exact: true }) });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Abrir esta tienda" }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
  await page.getByRole("tab", { name: "Recursos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recursos" })).toBeVisible();

  // El hero de la demo usa posterAssetId "asset-hero".
  const heroAsset = page.locator(".asset-item").filter({
    has: page.locator('input[value="Campaña de temporada"]'),
  });
  await expect(heroAsset).toBeVisible();
  await heroAsset.getByTestId("ui-asset-detail-open").click();

  const detail = page.getByTestId("ui-asset-detail");
  await expect(detail).toBeVisible();
  await expect(detail.getByTestId("ui-asset-use").first()).toBeVisible();
  await expect(detail).toContainText("catalog-hero");
  await expect(detail).toContainText("Sección hero");
  await expect(page.getByTestId("ui-asset-delete")).toBeDisabled();
});
