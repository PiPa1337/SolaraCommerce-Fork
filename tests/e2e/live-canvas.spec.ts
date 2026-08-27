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

async function openCleanStore(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(studioUrl);
  await createCleanStore(page, "Canvas verificable");
  await expect(page.locator('iframe[title="Vista previa desktop"]')).toBeVisible();
  await expect(page.getByTestId("ui-canvas-toggle")).toBeVisible();
}

test("Ctrl+clic selecciona un binding, edita texto y conserva undo/redo", async ({ page }) => {
  test.setTimeout(60_000);
  await openCleanStore(page);
  const frame = page.frameLocator('iframe[title="Vista previa desktop"]');
  const title = frame.locator('[data-canvas-edit="ce-modo-section-hero-title"]');
  await expect(title).toBeVisible({ timeout: 20_000 });

  await title.click({ modifiers: ["Control"] });

  const popover = page.getByRole("dialog", { name: "Editar Título del hero" });
  await expect(popover).toBeVisible();
  await expect(popover.getByRole("textbox")).toHaveValue("Titulo del hero");
  await popover.getByRole("textbox").fill("Título escrito desde Canvas");
  await popover.getByRole("button", { name: "Aplicar" }).click();

  await expect(frame.locator('[data-solara-module="catalog-hero"] h1')).toContainText(
    "Título escrito desde Canvas",
    { timeout: 20_000 },
  );
  await expect(page.getByRole("button", { name: "Deshacer" })).toBeEnabled();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(frame.locator('[data-solara-module="catalog-hero"] h1')).toContainText(
    "Titulo del hero",
    { timeout: 20_000 },
  );
  await page.getByRole("button", { name: "Rehacer" }).click();
  await expect(frame.locator('[data-solara-module="catalog-hero"] h1')).toContainText(
    "Título escrito desde Canvas",
    { timeout: 20_000 },
  );
});

test("el modo accesible permite seleccionar y subir una imagen desde Canvas", async ({ page }) => {
  test.setTimeout(60_000);
  await openCleanStore(page);
  const frame = page.frameLocator('iframe[title="Vista previa desktop"]');
  const toggle = page.getByTestId("ui-canvas-toggle");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  const image = frame.locator('[data-canvas-image="ce-modo-section-hero-posterAssetId"]');
  await expect(image).toBeVisible({ timeout: 20_000 });
  await image.click();
  const popover = page.getByRole("dialog", { name: "Editar Imagen principal del hero" });
  await expect(popover).toBeVisible();
  await expect(popover.getByRole("combobox")).toBeVisible();
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  await popover.locator('input[type="file"]').setInputFiles({
    name: "canvas-pixel.png",
    mimeType: "image/png",
    buffer: pixel,
  });
  await expect(popover).toBeHidden({ timeout: 20_000 });
  await expect(frame.locator('[data-solara-module="catalog-hero"] img')).toHaveCount(1);
});
