import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

/**
 * Fase 12 — Tras la purga única, un perfil limpio queda con las dos
 * referencias de la demo (Predeterminado V2 y Predeterminado V1) y sus
 * previews renderizan la familia correspondiente.
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

async function openStore(page: Page, cardId: string): Promise<void> {
  const card = page.locator(`[data-store-card-id="${cardId}"]`);
  await card.click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
}

test("el dashboard muestra Predeterminado V2 y Predeterminado V1 como tiendas separadas", async ({
  page,
}) => {
  await page.goto(studioUrl);
  await wipeIndexedDb(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });

  const cards = page.locator("[data-store-card-id]");
  await expect(cards).toHaveCount(2, { timeout: 15_000 });
  await expect(page.locator('[data-store-card-id="store-modo-sur-demo"]')).toContainText(
    "Predeterminado",
  );
  await expect(page.locator('[data-store-card-id="store-modo-sur-demo-v1"]')).toContainText(
    "Predeterminado V1",
  );

  await openStore(page, "store-modo-sur-demo");
  const v2Preview = page.frameLocator('iframe[title="Vista previa desktop"]');
  await expect
    .poll(() => v2Preview.locator('[data-design-family="catalog-modern-v2"]').count(), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Volver a tiendas" }).click();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();

  await openStore(page, "store-modo-sur-demo-v1");
  const v1Preview = page.frameLocator('iframe[title="Vista previa desktop"]');
  await expect
    .poll(() => v1Preview.locator('[data-design-family="catalog-modern-v1"]').count(), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);
});

test("P9-B5: el aviso global de reset se cierra y no vuelve a aparecer", async ({ page }) => {
  await page.goto(studioUrl);
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
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();

  const notice = page.locator(".global-notice");
  const hadNotice = (await notice.count()) > 0;
  console.log("P9-B5 aviso presente en primer arranque:", hadNotice);
  if (hadNotice) {
    await notice.getByRole("button", { name: "Cerrar aviso" }).click();
    await expect(notice).toBeHidden();
  }

  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  const afterReload = await page.locator(".global-notice").count();
  console.log("P9-B5 aviso tras recargar:", afterReload);
  expect(afterReload).toBe(0);
});

test("P2-B5: los avatares distinguen tiendas con el mismo prefijo (PR vs PV)", async ({ page }) => {
  await page.goto(studioUrl);
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
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();

  const marks = await page.locator(".dashboard-store-card__mark").allInnerTexts();
  console.log("P2-B5 marks:", JSON.stringify(marks));
  expect(marks).toContain("PR");
  expect(marks).toContain("PV");
});
