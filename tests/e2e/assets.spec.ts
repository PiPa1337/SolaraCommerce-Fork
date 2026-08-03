import type { Server } from "node:http";
import { expect, test } from "@playwright/test";
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
  await page.getByRole("button", { name: "Mi primera tienda" }).click();
  await page.getByRole("button", { name: "Recursos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recursos" })).toBeVisible();
  const initialAssetCount = await page.locator(".asset-item").count();

  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: pixel,
  });

  await expect(page.locator("output").filter({ hasText: "1 imagen agregada" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator(".asset-item")).toHaveCount(initialAssetCount + 1);
  await expect(page.getByText("Guardado", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Mi primera tienda" }).click();
  await page.getByRole("button", { name: "Recursos", exact: true }).click();
  await expect(page.locator(".asset-item")).toHaveCount(initialAssetCount + 1);
});
