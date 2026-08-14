import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

/**
 * Fase 12 — Tras la purga única, un perfil limpio queda con una sola tienda
 * (Predeterminado) y su preview renderiza la familia `catalog-modern-v2`.
 */
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

async function wipeIndexedDb(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("solara-commerce-studio");
        request.addEventListener("success", () => resolve());
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("blocked", () =>
          reject(new Error("No se pudo limpiar la base de Studio.")),
        );
      }),
  );
}

test("el dashboard queda con Predeterminado V2 y sin otras tiendas", async ({ page }) => {
  await page.goto(studioUrl);
  await wipeIndexedDb(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });

  const cards = page.locator("[data-store-card-id]");
  await expect(cards).toHaveCount(1, { timeout: 15_000 });
  const card = page.locator('[data-store-card-id="store-modo-sur-demo"]');
  await expect(card).toContainText("Predeterminado");

  await card.click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();

  const preview = page.frameLocator('iframe[title="Vista previa desktop"]');
  await expect
    .poll(() => preview.locator('[data-design-family="catalog-modern-v2"]').count(), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);
});
