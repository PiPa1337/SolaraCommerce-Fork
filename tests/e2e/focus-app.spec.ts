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

test("P1-L2: el foco del teclado es visible en tabs, pane y botones del editor", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(studioUrl, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 30000 });
  await page
    .locator(".dashboard-store-card")
    .first()
    .locator(".dashboard-store-card__button")
    .dblclick();
  await page.locator(".studio-shell").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);

  const invisible: string[] = [];
  const checkFocus = async (label: string) => {
    const focus = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active || active === document.body) return null;
      const style = getComputedStyle(active);
      const visible =
        (parseFloat(style.outlineWidth) > 0 && style.outlineStyle !== "none") ||
        (style.boxShadow !== "none" && style.boxShadow.length > 4);
      return { tag: active.tagName, cls: String(active.className).slice(0, 40), visible };
    });
    if (focus && !focus.visible) invisible.push(`${label}: ${focus.tag} ${focus.cls}`);
  };

  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press("Tab");
    await checkFocus(`tab ${i + 1}`);
  }
  for (const tab of ["Catálogo", "Constructor", "Exportar"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await page.waitForTimeout(1000);
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      await checkFocus(`${tab} tab ${i + 1}`);
    }
  }
  await page.keyboard.press("Shift+Tab");
  await checkFocus("shift-tab");

  console.log("P1-L2 foco invisible:", JSON.stringify(invisible));
  expect(invisible).toEqual([]);
});
