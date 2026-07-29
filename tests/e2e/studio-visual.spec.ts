import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { expect, test } from "@playwright/test";

const studioRoot = resolve("apps/studio/dist");
let server: Server;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const requested = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const normalized = normalize(requested).replace(/^([/\\])+/, "");
    let file = resolve(join(studioRoot, normalized));

    if (!file.startsWith(studioRoot)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) {
      response.writeHead(404).end("Not found");
      return;
    }

    const contentTypes: Record<string, string> = {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
    };
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes[extname(file)] ?? "application/octet-stream",
    });
    response.end(readFileSync(file));
  });

  await new Promise<void>((resolve) => server.listen(4173, "127.0.0.1", resolve));
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("Studio mantiene jerarquía y no desborda en desktop ni móvil", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.goto("http://127.0.0.1:4173");
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  await page.getByRole("button", { name: /Casa Luma/ }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
  await expect(page.locator("iframe")).toBeVisible();
  await expect(
    page.frameLocator("iframe").getByRole("heading", { name: "Una casa con materia y calma." }),
  ).toBeVisible();

  const desktopOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(desktopOverflow).toBe(false);
  await page.screenshot({ path: "test-results/studio-overview-desktop.png", fullPage: true });

  await page.getByRole("button", { name: "Constructor" }).click();
  await expect(page.getByRole("heading", { name: "Constructor" })).toBeVisible();
  for (const selector of [".workspace-section", ".section-header", ".builder-grid"]) {
    const hasInternalOverflow = await page
      .locator(selector)
      .evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(hasInternalOverflow, `${selector} no debe recortar contenido`).toBe(false);
  }
  await page.screenshot({ path: "test-results/studio-builder-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(mobileOverflow).toBe(false);
  await page.screenshot({ path: "test-results/studio-builder-mobile.png", fullPage: true });
  expect(runtimeErrors).toEqual([]);
});
