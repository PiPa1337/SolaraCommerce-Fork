import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

/** Fase 12 — Un perfil limpio queda con la única demo Predeterminado V2. */
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

test("el dashboard muestra sólo Predeterminado V2", async ({ page }) => {
  await page.goto(studioUrl);
  await wipeIndexedDb(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });

  const cards = page.locator("[data-store-card-id]");
  await expect(cards).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator('[data-store-card-id="store-modo-sur-demo"]')).toContainText(
    "Predeterminado",
  );
  await expect(page.locator('[data-store-card-id="store-modo-sur-demo-v1"]')).toHaveCount(0);

  await openStore(page, "store-modo-sur-demo");
  const v2Preview = page.frameLocator('iframe[title="Vista previa desktop"]');
  await expect
    .poll(() => v2Preview.locator('[data-design-family="catalog-modern-v2"]').count(), {
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

test("P2-B5: el avatar de Predeterminado conserva sus iniciales", async ({ page }) => {
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
  expect(marks).not.toContain("PV");
});

test("R3-P9-B5: el dashboard no desborda en viewport móvil", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
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

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log("R3-P9-B5 scrollWidth móvil:", scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

test("R4-P2-B5: la vista en lista del dashboard alterna y persiste", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
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

  const listButton = page.getByRole("button", { name: "Vista en lista" });
  await listButton.click();
  await page.waitForTimeout(600);
  const listActive = await listButton.getAttribute("aria-pressed");
  console.log("R4-P2-B5 lista activa:", listActive);
  expect(listActive).toBe("true");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  const persisted = await page
    .getByRole("button", { name: "Vista en lista" })
    .getAttribute("aria-pressed");
  console.log("R4-P2-B5 lista tras recargar:", persisted);
  expect(persisted).toBe("true");
});

test("R5-P5-B5: el filtro de estado del dashboard persiste al recargar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
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

  const filter = page.getByRole("combobox", { name: "Estado" });
  await filter.selectOption("archived");
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  const persisted = await page.getByRole("combobox", { name: "Estado" }).inputValue();
  console.log("R5-P5-B5 filtro tras recargar:", persisted);
  expect(persisted).toBe("archived");
});
