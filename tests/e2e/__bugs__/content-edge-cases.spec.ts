/**
 * Caza de bugs: contenido en los límites. Exporta mutaciones extremas del
 * catálogo y valida que el HTML generado sea usable (sin crash, sin DOM roto,
 * sin overflow). Spec manual — no es gate.
 */
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import type { StoreProjectV1 } from "@solara/project-schema";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

const LONG_5000 = "Largo ".repeat(1000);
const RTL = "منتج تجريبي بالعربية";
const HEBREW = "מוצר בדיקה";
const EMOJI = "Producto 🚀🔥💯 émojis ñ á é";

function mutated(
  overrides: Partial<StoreProjectV1> & { productOverrides?: Array<Record<string, unknown>> },
): StoreProjectV1 {
  const clone = JSON.parse(JSON.stringify(catalogModernV2Store)) as StoreProjectV1 & {
    productOverrides?: unknown;
  };
  const { productOverrides, ...rest } = overrides;
  Object.assign(clone, rest);
  if (productOverrides) {
    productOverrides.forEach((ov, i) => {
      if (clone.products[i]) Object.assign(clone.products[i], ov);
    });
  }
  return clone;
}

let server: Server;
let serverUrl = "";

async function serve(project: StoreProjectV1): Promise<void> {
  if (server) server.close();
  const exported = exportProject(project, { mode: "draft" });
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
      response.writeHead(404).end("nf");
      return;
    }
    response.writeHead(200);
    response.end(file);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("sin puerto");
  serverUrl = `http://127.0.0.1:${address.port}`;
}

test.afterAll(async () => {
  server?.close();
});

test.describe("contenido limite", () => {
  test("exporta y renderiza con textos extremos", async ({ page }) => {
    await serve(
      mutated({
        productOverrides: [
          { description: LONG_5000 },
          { title: RTL },
          { title: HEBREW },
          { title: EMOJI },
        ],
      }),
    );
    await page.goto(`${serverUrl}/`);
    const brokenHtml = await page.evaluate(() => document.body.innerText.includes("<h3"));
    expect(brokenHtml, "no debe haber HTML escapado visible").toBe(false);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `overflow ${overflow}px con textos extremos`).toBeLessThanOrEqual(2);
  });

  test("precios extremos se formatean sin romper layout", async ({ page }) => {
    await serve(
      mutated({
        productOverrides: [
          {
            variants: [
              {
                id: "v1",
                title: "U",
                price: 1,
                available: true,
                optionValues: {},
                sku: "A",
                stockStatus: "in_stock",
              },
            ],
          },
          {
            variants: [
              {
                id: "v2",
                title: "U",
                price: 9999999999,
                available: true,
                optionValues: {},
                sku: "B",
                stockStatus: "in_stock",
              },
            ],
          },
        ],
      }),
    );
    await page.goto(`${serverUrl}/`);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test("productos sin imagenes no rompen la grilla", async ({ page }) => {
    await serve(mutated({ productOverrides: [{ imageIds: [] }, { imageIds: [] }] }));
    await page.goto(`${serverUrl}/`);
    const imgs = await page.evaluate(() =>
      [...document.querySelectorAll(".catalog-product-card img")].filter(
        (img) => !img.getAttribute("src"),
      ),
    );
    expect(imgs.length, "cards sin imagen no deben tener <img> vacio").toBe(0);
  });
});
