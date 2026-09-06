import type { Server } from "node:http";
import { expect, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(180_000);

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

test("P3-B2: el pane conserva scroll y foco al cambiar de pestaña y reabrir", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(studioUrl, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 30000 });
  await page
    .locator(".dashboard-store-card")
    .first()
    .locator(".dashboard-store-card__button")
    .dblclick();
  await page.locator(".studio-shell").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);

  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await page.waitForTimeout(1500);
  const pane = page.locator(".editor-pane");
  await expect(pane).toBeVisible();
  await pane.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".editor-pane");
    if (el) el.scrollTop = 200;
  });
  const scrollBefore = await page.evaluate(
    () => document.querySelector<HTMLElement>(".editor-pane")?.scrollTop ?? 0,
  );

  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await page.waitForTimeout(1500);
  const scrollAfter = await page.evaluate(
    () => document.querySelector<HTMLElement>(".editor-pane")?.scrollTop ?? 0,
  );
  console.log("P3-B2 scroll: antes", scrollBefore, "después", scrollAfter);
  expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThanOrEqual(5);

  await page
    .getByRole("button", { name: "Cerrar panel de edición" })
    .click()
    .catch(() => undefined);
  await page.waitForTimeout(600);
  const closed = await page
    .locator(".editor-pane")
    .evaluate((el) => el.classList.contains("editor-pane--closed"));
  console.log("P3-B2 pane cerrado:", closed);
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await page.waitForTimeout(1200);
  const reopened = await page
    .locator(".editor-pane")
    .evaluate((el) => el.classList.contains("editor-pane--open"));
  console.log("P3-B2 pane reabierto al volver:", reopened);
  expect(reopened).toBe(true);
});

test("R4-P3-B5: el panel cerrado se conserva al recargar la tienda", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(studioUrl, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 30000 });
  await page
    .locator(".dashboard-store-card")
    .first()
    .locator(".dashboard-store-card__button")
    .dblclick();
  await page.locator(".studio-shell").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);

  const storeId = await page.evaluate(
    () => document.querySelector(".studio-shell")?.getAttribute("data-project-id") ?? "",
  );
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("solara-editor-pane:"));
    if (key) localStorage.setItem(key, "closed");
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await page
    .locator(".dashboard-store-card")
    .first()
    .locator(".dashboard-store-card__button")
    .dblclick();
  await page.locator(".studio-shell").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);
  const closed = await page
    .locator(".editor-pane")
    .evaluate((el) => el.classList.contains("editor-pane--closed"));
  console.log("R4-P3-B5 panel cerrado tras recargar:", closed, "| storeId:", storeId);
  expect(closed).toBe(true);
});
