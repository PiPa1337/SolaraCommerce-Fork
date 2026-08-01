import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { referenceStore } from "@solara/project-schema/fixture";

const exported = exportProject(referenceStore, { mode: "production" });
const fixtureFiles = new Map<string, Uint8Array>([
  [
    "fixtures/casa-luma-hero.png",
    readFileSync(resolve("apps/studio/public/fixtures/casa-luma-hero.png")),
  ],
  [
    "fixtures/manta-bruma.png",
    readFileSync(resolve("apps/studio/public/fixtures/manta-bruma.png")),
  ],
  [
    "fixtures/jarra-delta.png",
    readFileSync(resolve("apps/studio/public/fixtures/jarra-delta.png")),
  ],
]);
let server: Server;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1:4175");
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const path =
      requested === ""
        ? "index.html"
        : requested.endsWith("/")
          ? `${requested}index.html`
          : requested;
    const content = exported.files.get(path) ?? fixtureFiles.get(path);

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
            : extension === "xml"
              ? "application/xml; charset=utf-8"
              : extension === "png"
                ? "image/png"
                : "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    response.end(content);
  });

  await new Promise<void>((resolveListening) => {
    server.listen(4175, "127.0.0.1", resolveListening);
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolveClosing, reject) => {
    server.close((error) => (error ? reject(error) : resolveClosing()));
  });
});

test("selecciona una variante, agrega al carrito y genera WhatsApp", async ({ page }) => {
  await page.goto("/productos/manta-bruma/");
  await page.getByLabel("Variante", { exact: true }).selectOption("variant-manta-piedra");
  await page.getByLabel("Cantidad").fill("2");
  await page.getByRole("button", { name: "Agregar al carrito" }).click();

  await expect(page.locator("[data-cart-count]").first()).toHaveText("2");
  await expect(page.locator("[data-cart-drawer]")).toHaveAttribute("aria-hidden", "false");
  await page.getByLabel("Nombre").fill("Malena Ortiz");
  await page.getByLabel(/Telefono|Tel/).fill("11 5555 0142");
  await page.getByLabel(/Direccion|Direcci/).fill("Av. Forest 842, CABA");
  await page.getByLabel(/Notas/).fill("Entregar por la tarde");
  await page.getByRole("button", { name: "Continuar por WhatsApp" }).click();

  const link = page.getByRole("link", { name: "Enviar pedido en WhatsApp" });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href).toContain("https://wa.me/5491123456789?text=");
  expect(decodeURIComponent(href ?? "")).toContain("2 x Manta Bruma (Piedra) [ML-BRU-PIE]");
});

test("mantiene producto, precio y descripcion sin JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/productos/manta-bruma/");

  await expect(page.getByRole("heading", { level: 1, name: "Manta Bruma" })).toBeVisible();
  await expect(page.locator("body")).toContainText(/Algod/);
  await expect(page.locator("body")).toContainText("$ 78.500,00");
  await expect(page.locator('a[href*="?variant=variant-manta-piedra"]')).toBeVisible();
  await context.close();
});

test("descubre productos siguiendo enlaces sin JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");

  const productLink = page.locator('a[href="/productos/manta-bruma/"]').first();
  await expect(productLink).toBeVisible();
  await productLink.click();
  await expect(page).toHaveURL(/\/productos\/manta-bruma\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Manta Bruma" })).toBeVisible();
  await context.close();
});

test("expone colecciones, politicas y artefactos SEO sin JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/colecciones/casa-serena/");
  await expect(page.getByRole("heading", { level: 1, name: "Casa serena" })).toBeVisible();
  await page.goto("/envios/");
  await expect(page.locator("main h1")).toContainText(/Env/);

  const sitemap = await page.request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain("/productos/manta-bruma/");
  const feed = await page.request.get("/google-merchant.xml");
  expect(await feed.text()).toContain("variant-manta-musgo");
  await context.close();
});

test("mantiene composicion y ancho estable en desktop y movil", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Una casa con materia y calma." }),
  ).toBeVisible();
  for (const section of await page.locator("[data-motion-root]").all()) {
    await section.scrollIntoViewIfNeeded();
  }
  await page.locator('[data-solara-module="editorial-header"]').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
  await page.screenshot({ path: "test-results/storefront-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
  await page.screenshot({ path: "test-results/storefront-mobile.png", fullPage: true });
});

test("mantiene el contenido visible con movimiento reducido y activa inView", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const hero = page.locator('[data-solara-module="hero-media"]');
  await expect(hero).toHaveAttribute("data-motion-intensity", "0.5");
  await expect(hero).toHaveAttribute("data-motion-entry", "0.25");
  await hero.scrollIntoViewIfNeeded();
  await expect(hero).toHaveAttribute("data-motion-visible", "true");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(hero).toHaveAttribute("data-motion-visible", "true");
  expect(
    await page
      .locator('[data-solara-module="hero-media"] [data-motion-zone]')
      .first()
      .evaluate((element) => {
        return getComputedStyle(element).opacity;
      }),
  ).toBe("1");
});
