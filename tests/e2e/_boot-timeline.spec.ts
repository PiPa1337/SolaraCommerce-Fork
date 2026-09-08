import type { Server } from "node:http";
import { expect, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

let server: Server;
let url: string;

test.beforeAll(async () => {
  const running = await startStudioServer();
  server = running.server;
  url = running.url;
});

test.afterAll(async () => stopStudioServer(server));

test("capture boot timeline", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const startedAt = Date.now();
  await page.goto(url, { waitUntil: "commit" });
  for (const elapsed of [0, 100, 400, 900, 1500, 2200, 3200, 5000]) {
    const wait = elapsed - (Date.now() - startedAt);
    if (wait > 0) await page.waitForTimeout(wait);
    const state = await page.evaluate(() => {
      const boot = document.querySelector<HTMLElement>('[data-testid="solara-app-boot"]');
      const field = boot?.querySelector<HTMLElement>(".dashboard-gravity-field");
      const canvas = field?.querySelector<HTMLCanvasElement>("canvas");
      const dashboard = document.querySelector<HTMLElement>(".dashboard-gargantua");
      return {
        solaraBoot: document.documentElement.dataset.solaraBoot ?? null,
        bootClass: boot?.className ?? null,
        bootOpacity: boot ? getComputedStyle(boot).opacity : null,
        fieldRenderer: field?.dataset.renderer ?? null,
        fieldState: field?.dataset.animationState ?? null,
        canvasOpacity: canvas ? getComputedStyle(canvas).opacity : null,
        canvasAnimation: canvas
          ? {
              name: getComputedStyle(canvas).animationName,
              duration: getComputedStyle(canvas).animationDuration,
              delay: getComputedStyle(canvas).animationDelay,
              playState: getComputedStyle(canvas).animationPlayState,
              fillMode: getComputedStyle(canvas).animationFillMode,
            }
          : null,
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        dashboardVisible: Boolean(dashboard && getComputedStyle(dashboard).display !== "none"),
        headingVisible: Boolean(
          [...document.querySelectorAll("h1")].some((element) => getComputedStyle(element).opacity !== "0"),
        ),
      };
    });
    console.log(`[boot ${elapsed}ms] ${JSON.stringify(state)}`);
    await page.screenshot({
      path: `C:/Users/PiPa/Drive/Documentos/Websave/OpenCode/SolaraCommerce/screenshots/boot-timeline-${elapsed}.png`,
    });
  }
  await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();
});
