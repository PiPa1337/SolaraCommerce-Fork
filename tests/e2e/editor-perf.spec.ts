import type { Server } from "node:http";
import { expect, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

/**
 * Budgets de arranque del editor, en milisegundos. Se fijaron midiendo una
 * ejecución de referencia y aplicando un margen de 1.5× sobre la peor muestra
 * (ver .superpowers/sdd/ola0-c-report.md).
 *
 * El presupuesto de cambio de pestaña se recalibró para el bundle de la ola 3:
 * la muestra aislada mide 76–84 ms, pero bajo suite completa (presión de
 * memoria del proceso Chromium compartido por ~50 contextos previos) la peor
 * muestra es 154.5 ms. 154.5 × 1.5 = 231.75 ms → budget 250 ms (redondeo a
 * múltiplo cómodo con margen adicional).
 */
const BOOT_BUDGET_MS = 800;
const OPEN_STORE_BUDGET_MS = 700;
const TAB_SWITCH_BUDGET_MS = 250;

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

test.setTimeout(180_000);

test("mide el arranque del dashboard hasta el título Tus tiendas", async ({ page }) => {
  const navigationStart = Date.now();
  await page.goto(studioUrl);
  const start = await page.evaluate(() => performance.now());
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  const bootMs = (await page.evaluate(() => performance.now())) - start;
  const totalMs = Date.now() - navigationStart;
  console.log(
    `perf: arranque dashboard ${bootMs.toFixed(0)} ms (navegación total ${totalMs} ms, budget ${BOOT_BUDGET_MS} ms)`,
  );
  expect(bootMs).toBeLessThanOrEqual(BOOT_BUDGET_MS);
});

test("mide la apertura de Predeterminado hasta Resumen y el cambio a Catálogo", async ({
  page,
}) => {
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();

  const results = await page.evaluate(async () => {
    const waitFor = async (predicate: () => boolean, timeoutMs = 30_000): Promise<boolean> => {
      const deadline = performance.now() + timeoutMs;
      while (!predicate()) {
        if (performance.now() > deadline) return false;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      return true;
    };
    const headingVisible = (text: string) =>
      [...document.querySelectorAll("h1, h2, h3")].some(
        (heading) => heading.textContent?.trim() === text,
      );
    const tabByName = (name: string) =>
      [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
        (tab) => tab.textContent?.trim() === name,
      );

    const cardReady = await waitFor(() => {
      const cards = [...document.querySelectorAll(".dashboard-store-card")];
      return cards.some((card) => card.textContent?.includes("Predeterminado"));
    });
    if (!cardReady) return { openMs: Number.POSITIVE_INFINITY, switchMs: Number.POSITIVE_INFINITY };

    const card = [...document.querySelectorAll(".dashboard-store-card")].find((element) =>
      element.textContent?.includes("Predeterminado"),
    );
    const startOpen = performance.now();
    card?.querySelector<HTMLButtonElement>(".dashboard-store-card__open")?.click();
    await waitFor(() => document.querySelector('[role="tablist"]') !== null);
    tabByName("Resumen")?.click();
    await waitFor(() => headingVisible("Resumen"));
    const openMs = performance.now() - startOpen;

    const startSwitch = performance.now();
    tabByName("Catálogo")?.click();
    await waitFor(() => headingVisible("Catálogo"));
    const switchMs = performance.now() - startSwitch;

    return { openMs, switchMs };
  });

  console.log(
    `perf: apertura de tienda ${results.openMs.toFixed(0)} ms (budget ${OPEN_STORE_BUDGET_MS} ms), cambio de tab ${results.switchMs.toFixed(0)} ms (budget ${TAB_SWITCH_BUDGET_MS} ms)`,
  );
  expect(results.openMs).toBeLessThanOrEqual(OPEN_STORE_BUDGET_MS);
  expect(results.switchMs).toBeLessThanOrEqual(TAB_SWITCH_BUDGET_MS);
});
