import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { waitForStorefrontReady } from "./storefront-helpers";

const store = structuredClone(catalogModernStore);
const product = store.products.find((p) => p.status === "active");
if (!product || !store.assets[0]) throw new Error("Fixture incompleto.");
const video = {
  kind: "video",
  id: "video-e2e-001",
  name: "Demo e2e",
  alt: "Demo e2e",
  mimeType: "video/mp4",
  source: "data:video/mp4;base64,AAAA",
  posterAssetId: store.assets[0].id,
  width: 640,
  height: 1138,
  durationSeconds: 8,
  hash: "video-e2e-hash-001",
} as unknown as (typeof store.videos)[number];
store.videos = [video];
product.imageIds = [store.assets[0].id];
product.videoIds = [video.id];

const PRODUCT_PATH = `/productos/${product.slug}/`;
const exported = exportProject(store, { mode: "production" });

let server: Server;
let baseUrl: string;

function startServer(): Promise<string> {
  return new Promise((resolveListening) => {
    server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const path =
        requested === ""
          ? "index.html"
          : requested.endsWith("/")
            ? `${requested}index.html`
            : requested;
      const content = exported.files.get(path);
      if (content === undefined) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
        return;
      }
      const extension = path.split(".").pop();
      const contentType =
        extension === "html"
          ? "text/html; charset=utf-8"
          : extension === "css"
            ? "text/css; charset=utf-8"
            : extension === "js"
              ? "text/javascript; charset=utf-8"
              : "application/octet-stream";
      response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
      response.end(content);
    });
    server.listen(0, "127.0.0.1", () => {
      resolveListening(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    });
  });
}

test.beforeAll(async () => {
  baseUrl = await startServer();
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test("galería mixta con video: thumb activa figura y mobile no recorta", async ({ page }) => {
  await page.goto(`${baseUrl}${PRODUCT_PATH}`);
  await waitForStorefrontReady(page);
  await expect(page.locator('[data-gallery-media-id="video-e2e-001"] video')).toHaveAttribute(
    "preload",
    "none",
  );
  await expect(page.locator('[data-gallery-media-id="video-e2e-001"] video')).toHaveAttribute(
    "controls",
    "",
  );
  await page.locator('[data-gallery-thumb="video-e2e-001"]').click();
  await expect(page.locator('[data-gallery-media-id="video-e2e-001"]')).toHaveAttribute(
    "data-gallery-active",
    "true",
  );
  await expect(page.locator('[data-gallery-thumb="video-e2e-001"]')).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("sin JS el video con poster sigue útil", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${PRODUCT_PATH}`);
  // La figura inactiva queda display:none (igual que las imágenes hoy);
  // lo que debe existir sin JS es el <video controls poster> con su fuente.
  const video = page.locator("[data-product-gallery] video[controls]");
  await expect(video).toBeAttached();
  await expect(video).toHaveAttribute("poster", /.+/);
  await expect(video.locator('source[type="video/mp4"]')).toHaveAttribute("src", /.+/);
  await context.close();
});

test("mobile 390px: stage mínimo cuadrado y retrato visible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${PRODUCT_PATH}`);
  const main = page.locator(".catalog-product-gallery-main").first();
  const box = await main.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(300);
  // Mínimo cuadrado: el alto no puede ser menor que el ancho menos tolerancia.
  expect(box!.height).toBeGreaterThanOrEqual(box!.width - 8);
});
