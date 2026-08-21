/**
 * Caza de bugs: fallos del entorno. El sitio debe seguir usable cuando el
 * storage esta bloqueado, el catalogo corrupto o las imagenes caen.
 */
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

const exported = exportProject(catalogModernV2Store, { mode: "production" });
let server: Server;
let serverUrl = "";

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    // Simular catalog-index.json corrupto/ausente
    if (requested === "catalog-index.json") {
      response.writeHead(500).end("{corrupto");
      return;
    }
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
    const ext = path.split(".").pop();
    response.writeHead(200, {
      "Content-Type":
        ext === "css"
          ? "text/css"
          : ext === "js"
            ? "text/javascript"
            : ext === "webp"
              ? "image/webp"
              : ext === "png"
                ? "image/png"
                : "text/html; charset=utf-8",
    });
    response.end(file);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("sin puerto");
  serverUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  server.close();
});

test("localStorage bloqueado: el sitio sigue navegable", async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("bloqueado");
      },
    });
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto(`${serverUrl}/`);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 10000 });
  await page.goto(new URL("/productos/remera-esencial-de-algodon/", serverUrl).toString());
  await expect(page.locator("[data-product], [data-solara-module*=product]").first()).toBeVisible({
    timeout: 10000,
  });
  expect(
    errors.filter((e) => !e.includes("storage")),
    `errores JS: ${errors.join(" | ")}`,
  ).toHaveLength(0);
  await context.close();
});

test("catalog-index.json corrupto: carrito y checkout siguen renderizando", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto(`${serverUrl}/carrito/`);
  await expect(page.locator(".solara-cart-page-grid")).toBeVisible({ timeout: 10000 });
  await page.goto(`${serverUrl}/carrito/`);
  await expect(page.locator(".solara-cart-page-grid")).toBeVisible({ timeout: 10000 });
  expect(errors, `errores no manejados: ${errors.join(" | ")}`).toHaveLength(0);
});

test("imagenes rotas: layout sin overflow y alt presente", async ({ page }) => {
  await page.route("**/*.webp", (route) => route.abort());
  await page.goto(`${serverUrl}/`);
  await page.waitForTimeout(800);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `overflow con imagenes rotas: ${overflow}px`).toBeLessThanOrEqual(2);
  const missingAlt = await page.evaluate(
    () =>
      [...document.querySelectorAll("img")].filter((img) => img.getAttribute("alt") === null)
        .length,
  );
  expect(missingAlt, `${missingAlt} imgs sin atributo alt`).toBe(0);
});
