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

const viewports = [
  { name: "1920x950", width: 1920, height: 950 },
  { name: "1920x1080", width: 1920, height: 1080 },
] as const;

for (const viewport of viewports) {
  test(`el dashboard maximizado cabe completo a ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(studioUrl);
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();

    const layout = await page.locator(".dashboard-page.dashboard-cosmic").evaluate((main) => ({
      documentHeight: document.documentElement.scrollHeight,
      documentClientHeight: document.documentElement.clientHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      mainHeight: main.scrollHeight,
      mainClientHeight: main.clientHeight,
      mainWidth: main.scrollWidth,
      mainClientWidth: main.clientWidth,
    }));

    expect(layout.documentHeight).toBeLessThanOrEqual(layout.documentClientHeight + 1);
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.documentClientWidth + 1);
    expect(layout.mainHeight).toBeLessThanOrEqual(layout.mainClientHeight + 1);
    expect(layout.mainWidth).toBeLessThanOrEqual(layout.mainClientWidth + 1);
  });
}
