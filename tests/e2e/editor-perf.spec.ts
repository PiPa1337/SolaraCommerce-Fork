import type { Server } from "node:http";
import { expect, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

/**
 * Budgets de arranque del editor, en milisegundos. Se fijaron midiendo una
 * ejecución de referencia y aplicando un margen de 1.5× sobre la peor muestra
 * (ver .superpowers/sdd/ola0-c-report.md).
 *
 * La fixture actual de escala renderiza 50 filas en el primer acceso a
 * Catálogo. Cinco muestras aisladas midieron 333–347 ms; se aplica el margen
 * definido en el plan (347 × 1.5 = 520.5 ms) y se redondea a 550 ms. La carga
 * del módulo se precarga al abrir Studio, por lo que el budget cubre el
 * montaje real de la tabla y no una carrera de red. La apertura del editor
 * mide 450 ms aislada, 659 ms con cuatro workers y hasta 965 ms dentro de la
 * suite completa de ocho workers; el margen de 1.5× sobre ese último caso se
 * redondea a 1.500 ms para no convertir la contención de CPU del host en un
 * falso rojo del benchmark.
 */
const BOOT_BUDGET_MS = process.env.CI ? 1_000 : 800;
const OPEN_STORE_BUDGET_MS = 1_500;
const TAB_SWITCH_BUDGET_MS = 550;

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
