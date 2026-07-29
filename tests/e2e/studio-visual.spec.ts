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

test("Studio mantiene jerarquía y no desborda en desktop ni móvil", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await page.getByRole("button", { name: /Casa Luma/ }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
  await expect(page.locator("iframe")).toBeVisible();
  await expect(
    page.frameLocator("iframe").getByRole("heading", { name: "Una casa con materia y calma." }),
  ).toBeVisible();

  const desktopOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(desktopOverflow).toBe(false);
  await page.screenshot({ path: "test-results/studio-overview-desktop.png", fullPage: true });

  await page.getByRole("button", { name: "Constructor" }).click();
  await expect(page.getByRole("heading", { name: "Constructor" })).toBeVisible();
  for (const selector of [".workspace-section", ".section-header", ".builder-grid"]) {
    const hasInternalOverflow = await page
      .locator(selector)
      .evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(hasInternalOverflow, `${selector} no debe recortar contenido`).toBe(false);
  }
  await page.screenshot({ path: "test-results/studio-builder-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(mobileOverflow).toBe(false);
  await page.screenshot({ path: "test-results/studio-builder-mobile.png", fullPage: true });
  expect(runtimeErrors).toEqual([]);
});
