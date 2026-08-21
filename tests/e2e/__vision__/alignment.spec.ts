/**
 * Auditoría de alineación y espaciado: mide geometría real del Constructor
 * (builder-grid, nav, inspector) y del Dashboard (cards, toolbar) con
 * getBoundingClientRect. Complementa la captura visual de studio-vision.
 */
import { expect, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "../studio-server";

let server: Awaited<ReturnType<typeof startStudioServer>>["server"];
let url = "";

test.beforeAll(async () => {
  const started = await startStudioServer();
  server = started.server;
  url = started.url;
});

test.afterAll(async () => {
  await stopStudioServer(server);
});

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function boxOf(page: import("@playwright/test").Page, selector: string): Promise<Box> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`sin elemento: ${sel}`);
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, selector);
}

async function boxesOf(page: import("@playwright/test").Page, selector: string): Promise<Box[]> {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
  }, selector);
}

/** Limpia IndexedDB antes de navegar para partir del estado sembrado. */
async function cleanIndexedDb(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(url);
  await page.evaluate(
    () =>
      new Promise<void>((res, rej) => {
        const req = indexedDB.deleteDatabase("solara-commerce-studio");
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
      }),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({ timeout: 20000 });
}

/** Abre la tienda demo y navega al Constructor. */
async function openBuilder(page: import("@playwright/test").Page): Promise<void> {
  await cleanIndexedDb(page);
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Preparar" })).toBeVisible({ timeout: 20000 });
  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await page.waitForTimeout(700);
}

test.use({ viewport: { width: 1280, height: 800 } });

test.describe("alineacion constructor", () => {
  test("tabs del nav comparten alto y padding izquierdo", async ({ page }) => {
    await openBuilder(page);
    const tabs = await boxesOf(page, '.studio-nav [role="tablist"] button');
    expect(tabs.length).toBe(8);
    // El activo puede crecer por el indicador: exigir misma X y alto en escala.
    const heights = tabs.map((t) => Math.round(t.height));
    for (const tab of tabs) {
      expect(tab.x, "padding izquierdo uniforme").toBeCloseTo(tabs[0].x, 1);
      expect(heights, "altos de tabs solo dos valores").toEqual(
        heights.filter((h) => h === heights[0] || h === 50),
      );
    }
  });

  test("columnas del builder-grid arrancan en la misma Y", async ({ page }) => {
    await openBuilder(page);
    await expect(page.locator(".section-stack")).toBeVisible({ timeout: 10000 });
    const stack = await boxOf(page, ".section-stack");
    const canvas = await boxOf(page, ".builder-grid > *:nth-child(2)");
    expect(Math.abs(stack.y - canvas.y), "top alineado stack vs canvas").toBeLessThanOrEqual(4);
  });

  test("filas de secciones tienen alto consistente", async ({ page }) => {
    await openBuilder(page);
    await expect(page.locator(".section-row").first()).toBeVisible({ timeout: 10000 });
    const rows = await boxesOf(page, ".section-row");
    expect(rows.length).toBeGreaterThanOrEqual(2);
    // Filas del mismo grupo comparten alto; la seleccionada puede crecer.
    const heights = rows.map((r) => Math.round(r.height));
    const unique = [...new Set(heights)];
    expect(
      unique.length,
      `altos de section-row acotados: ${unique.join(", ")}`,
    ).toBeLessThanOrEqual(2);
  });

  test("dashboard: cards de tiendas comparten alto por fila", async ({ page }) => {
    await cleanIndexedDb(page);
    const cards = await boxesOf(page, ".dashboard-store-card");
    expect(cards.length).toBeGreaterThanOrEqual(1);
    for (const card of cards) {
      expect(card.height, "alto uniforme de cards").toBeCloseTo(cards[0].height, 0);
    }
  });
});
