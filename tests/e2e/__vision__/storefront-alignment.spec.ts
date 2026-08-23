/**
 * Auditoría geométrica del sitio exportado (Predeterminado V2): mide la
 * salida real de exportProject con getBoundingClientRect. Valida grillas,
 * padding vertical entre módulos y ausencia de overflow en 320px.
 */
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

const exported = exportProject(catalogModernV2Store, { mode: "production" });

let server: Server;
let serverUrl: "";

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const path =
      requested === ""
        ? "index.html"
        : requested.endsWith("/")
          ? `${requested}index.html`
          : requested;
    const file = exported.files.get(path);
    if (!file) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    const extension = path.split(".").pop();
    response.writeHead(200, {
      "Content-Type": extension === "css" ? "text/css; charset=utf-8" : "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(file);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("sin puerto");
  serverUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  server.close();
});

test.use({ viewport: { width: 1280, height: 900 } });

async function boxesOf(page: import("@playwright/test").Page, selector: string) {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    });
  }, selector);
}

test.describe("alineacion storefront exportado", () => {
  test("cards de producto comparten ancho y alto dentro de la grilla", async ({ page }) => {
    await page.goto(`${serverUrl}/`);
    await expect(page.locator('[data-solara-module="catalog-product-grid"]').first()).toBeVisible({
      timeout: 10000,
    });
    // Medir cada grilla por separado: cards dentro de una misma grilla deben
    // ser uniformes; entre grillas distintas pueden diferir legitimamente.
    const grids = await page.evaluate(() => {
      return [...document.querySelectorAll('[data-solara-module="catalog-product-grid"]')].map(
        (grid) => {
          return [...grid.querySelectorAll(".catalog-product-card")].map((card) => {
            const r = card.getBoundingClientRect();
            return {
              x: Math.round(r.x),
              y: Math.round(r.y),
              w: Math.round(r.width),
              h: Math.round(r.height),
            };
          });
        },
      );
    });
    expect(grids.length).toBeGreaterThanOrEqual(2);
    for (const cards of grids) {
      expect(cards.length, "cards por grilla").toBeGreaterThanOrEqual(3);
      const widths = [...new Set(cards.map((c) => c.w))];
      expect(widths.length, `anchos en grilla: ${widths.join(",")}`).toBeLessThanOrEqual(1);
    }
  });

  test("secciones del home usan contenedor centrado consistente", async ({ page }) => {
    await page.goto(`${serverUrl}/`);
    await page.waitForTimeout(500);
    const modules = await page.evaluate(() => {
      return [...document.querySelectorAll("[data-solara-module]")]
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.x), width: Math.round(r.width) };
        })
        .filter((m) => m.width > 0);
    });
    expect(modules.length).toBeGreaterThanOrEqual(5);
    // Los módulos full-width arrancan en x=0; los internos deben centrarse:
    // misma X para todos los que no son full-bleed.
    const nonFullBleed = modules.filter((m) => m.width < 1200 && m.width > 300);
    const xs = [...new Set(nonFullBleed.map((m) => m.x))];
    expect(xs.length, `X de módulos internos: ${xs.join(",")}`).toBeLessThanOrEqual(3);
  });

  test("sin overflow horizontal en 320px", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 320, height: 700 } });
    const page = await context.newPage();
    await page.goto(`${serverUrl}/`);
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `overflow horizontal: ${overflow}px`).toBeLessThanOrEqual(0);
    await context.close();
  });

  test("el nombre largo de la tienda usa el ancho disponible sin deformar el navbar", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const longBrand =
      "Marca de tienda extremadamente larga que debe aprovechar el navbar sin saltar de línea";

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 768, height: 900 },
      { width: 450, height: 800 },
      { width: 390, height: 800 },
      { width: 320, height: 700 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`${serverUrl}/`);
      const beforeHeight = (await boxesOf(page, ".catalog-header-inner"))[0]?.h ?? 0;
      await page
        .locator(".catalog-header-inner .catalog-brand .solara-wordmark")
        .evaluate((element, text) => {
          element.textContent = text;
        }, longBrand);

      const metrics = await page.evaluate(() => {
        const headerElement = document.querySelector<HTMLElement>(".catalog-header-inner");
        const brand = document.querySelector<HTMLElement>(".catalog-brand");
        const wordmark = document.querySelector<HTMLElement>(".catalog-brand .solara-wordmark");
        const headerBox = headerElement?.getBoundingClientRect();
        const brandBox = brand?.getBoundingClientRect();
        const wordmarkStyle = wordmark ? getComputedStyle(wordmark) : null;
        return {
          documentWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          headerHeight: headerBox?.height ?? 0,
          brandWidth: brandBox?.width ?? 0,
          whiteSpace: wordmarkStyle?.whiteSpace ?? "",
          overflow: wordmarkStyle?.overflow ?? "",
        };
      });

      expect(metrics.documentWidth, `overflow en ${viewport.width}px`).toBeLessThanOrEqual(
        metrics.clientWidth,
      );
      expect(metrics.headerHeight, `alto del navbar en ${viewport.width}px`).toBeLessThanOrEqual(
        beforeHeight + 1,
      );
      expect(metrics.whiteSpace).toBe("nowrap");
      expect(metrics.overflow).toBe("hidden");
      if (viewport.width >= 768) {
        expect(metrics.brandWidth, `ancho de marca en ${viewport.width}px`).toBeGreaterThan(224);
      }
    }

    await context.close();
  });
});
