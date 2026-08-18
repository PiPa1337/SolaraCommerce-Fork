import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

const exported = exportProject(catalogModernV2Store, { mode: "production" });
let server: Server;
let serverUrl: string;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const path = requested === "" || requested.endsWith("/") ? `${requested}index.html` : requested;
    const content = exported.files.get(path);
    if (content === undefined) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(content);
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  serverUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
});

test("V2 no publica Nosotros y concentra el contenido en Home", async ({ page }) => {
  const response = await page.goto(`${serverUrl}/nosotros/`);
  expect(response?.status()).toBe(404);

  await page.goto(serverUrl);
  await expect(page.locator(".solara-home-contact")).toBeVisible();
  await expect(page.locator('.catalog-desktop-nav a[href="/nosotros/"]')).toHaveCount(0);
  await expect(page.locator('.catalog-desktop-nav a[href="/contacto/"]')).toHaveCount(0);
  await expect(page.locator('.catalog-footer-inner a[href="/nosotros/"]')).toHaveCount(0);
  await expect(page.locator('.catalog-footer-inner a[href="/contacto/"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );
});
