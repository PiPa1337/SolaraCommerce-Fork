import type { Server } from "node:http";
import { expect, test } from "@playwright/test";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

let server: Server;
let url: string;
test.beforeAll(async () => {
  const started = await startStudioServer();
  server = started.server;
  url = started.url;
});
test.afterAll(async () => stopStudioServer(server));

test("el espacio de trabajo conserva dispositivos y separa el inspector", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(url);
  await createCleanStore(page);
  await expect(page.locator(".preview-stage iframe")).toBeVisible();
  await page.screenshot({ path: "test-results/editor-workbench/initial.png" });
  for (const mode of ["desktop", "tablet", "mobile"] as const) {
    const label = mode === "desktop" ? "Vista de escritorio" : mode === "tablet" ? "Vista de tablet" : "Vista de móvil";
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
    await page.getByRole("button", { name: "Agregar producto", exact: true }).click();
    await expect(page.getByRole("button", { name: "Vista de tablet", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => page.evaluate(() => {
      const inspector = document.querySelector(".studio-inspector-dock")?.getBoundingClientRect();
      const frame = document.querySelector(".preview-stage iframe")?.getBoundingClientRect();
      return Boolean(inspector && frame && inspector.right <= frame.left && frame.right <= innerWidth);
    })).toBe(true);
    await page.getByRole("button", { name: "Cerrar editor", exact: true }).click();
    await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  await expect.poll(async () => page.evaluate(() => {
    const pane = document.querySelector(".editor-pane")?.getBoundingClientRect();
    const frame = document.querySelector(".preview-stage iframe")?.getBoundingClientRect();
    const stage = document.querySelector(".preview-stage")?.getBoundingClientRect();
    return Boolean(pane && frame && stage && pane.width <= 768 && Math.abs(frame.right - stage.right) <= 20);
  })).toBe(true);
});
