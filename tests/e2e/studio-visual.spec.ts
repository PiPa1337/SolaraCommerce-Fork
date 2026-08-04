import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { referenceStore } from "@solara/project-schema/fixture";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
] as const;

let studioServer: Server;
let studioUrl: string;
let storefrontServer: Server;
let storefrontUrl: string;

test.beforeAll(async () => {
  const studio = await startStudioServer();
  studioServer = studio.server;
  studioUrl = studio.url;

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
  storefrontServer = createServer((request, response) => {
    const requested = decodeURIComponent(
      new URL(request.url ?? "/", "http://localhost").pathname,
    ).replace(/^\/+/, "");
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
            : extension === "png"
              ? "image/png"
              : "application/octet-stream";
    response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": contentType });
    response.end(content);
  });
  await new Promise<void>((done) => storefrontServer.listen(0, "127.0.0.1", done));
  const address = storefrontServer.address();
  if (!address || typeof address === "string") throw new Error("Puerto de storefront inválido.");
  storefrontUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await stopStudioServer(studioServer);
  await new Promise<void>((done, reject) => {
    storefrontServer.close((error) => (error ? reject(error) : done()));
  });
});

async function expectNoHorizontalOverflow(page: Page, context: string) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        ),
      { message: `${context} no debe desbordar horizontalmente` },
    )
    .toBe(true);
}

async function openProject(page: Page) {
  await page.goto(studioUrl);
  await createCleanStore(page, "Tienda visual");
}

test("dashboard responde en desktop, tablet y móvil", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(studioUrl);
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
    await expectNoHorizontalOverflow(page, `Dashboard ${viewport.name}`);
    if (viewport.name === "desktop") {
      await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
    }
  }
});

test("catálogo y constructor conservan jerarquía responsive", async ({ page }) => {
  await openProject(page);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.getByRole("button", { name: "Catálogo", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Catálogo", exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page, `Catálogo ${viewport.name}`);
    if (viewport.name === "desktop") {
      await page.screenshot({ path: "test-results/catalog.png", fullPage: true });
    }

    await page.getByRole("button", { name: "Constructor", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Constructor" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Inspector de sección" })).toBeVisible();
    await expectNoHorizontalOverflow(page, `Constructor ${viewport.name}`);
    if (viewport.name === "desktop") {
      await page.screenshot({ path: "test-results/constructor.png", fullPage: true });
    }
  }
});

test("preview diferencia escritorio, tablet y móvil", async ({ page }) => {
  await page.setViewportSize(viewports[0]);
  await openProject(page);
  for (const size of [
    { button: "Vista de escritorio", title: "Vista previa desktop" },
    { button: "Vista de tablet", title: "Vista previa tablet" },
    { button: "Vista móvil", title: "Vista previa mobile" },
  ]) {
    await page.getByRole("button", { name: size.button }).click();
    await expect(page.getByRole("button", { name: size.button })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator(`iframe[title="${size.title}"]`)).toBeVisible();
    if (size.title === "Vista previa desktop") {
      expect(
        await page
          .locator(`iframe[title="${size.title}"]`)
          .evaluate((frame) => frame.srcdoc.length),
      ).toBeLessThan(2_000_000);
      expect(
        await page.locator(`iframe[title="${size.title}"]`).evaluate((frame) => frame.srcdoc),
      ).not.toMatch(/\ssrc="\/__solara-preview-assets\//);
      const frame = page.frameLocator(`iframe[title="${size.title}"]`);
      await expect
        .poll(() =>
          frame
            .locator("img")
            .first()
            .evaluate((image) => image.naturalWidth),
        )
        .toBeGreaterThan(0);
      const previewImages = frame.locator("img");
      await expect
        .poll(async () => {
          const states = await Promise.all(
            (await previewImages.all()).map((image) =>
              image.evaluate((element) => ({
                loaded: (element as HTMLImageElement).naturalWidth > 0,
                eager: element.getAttribute("loading") === "eager",
              })),
            ),
          );
          return states.length > 0 && states.every((state) => state.loaded && state.eager);
        })
        .toBe(true);
      expect(
        await frame.locator("html").evaluate((element) => element.outerHTML.length),
      ).toBeLessThan(14_000_000);
    }
  }
});

test("el panel de trabajo se despliega desde la izquierda y deja crecer el preview", async ({
  page,
}) => {
  await page.setViewportSize(viewports[0]);
  await openProject(page);

  const workspace = page.locator(".studio-workspace");
  const editor = page.locator("[data-studio-editor-pane]");
  const preview = page.locator(".preview-pane");
  await expect(editor).toHaveClass(/editor-pane--closed/);
  await expect(page.getByRole("button", { name: "Abrir panel de edición" })).toBeVisible();

  await page.getByRole("button", { name: "Preparar", exact: true }).click();
  await expect(editor).toHaveClass(/editor-pane--open/);
  await expect(page.getByRole("button", { name: "Cerrar panel de edición" })).toBeVisible();

  await page.getByRole("button", { name: "Cerrar panel de edición" }).click();
  await expect(editor).toHaveClass(/editor-pane--closed/);
  await expect(page.getByRole("button", { name: "Abrir panel de edición" })).toBeVisible();

  const workspaceBox = await workspace.boundingBox();
  const previewBox = await preview.boundingBox();
  expect(workspaceBox).not.toBeNull();
  expect(previewBox).not.toBeNull();
  expect(previewBox?.width).toBeCloseTo(workspaceBox?.width ?? 0, -1);

  await page.getByRole("button", { name: "Abrir panel de edición" }).click();
  await expect(editor).toHaveClass(/editor-pane--open/);
  await expect(page.getByRole("button", { name: "Cerrar panel de edición" })).toBeVisible();
});

test("Studio respeta foco, modo oscuro y movimiento reducido", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        matchMedia("(prefers-color-scheme: dark)").matches &&
        matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);

  await page.keyboard.press("Tab");
  const focused = page.locator(":focus-visible");
  await expect(focused).toBeVisible();
  await expect
    .poll(
      () =>
        focused.evaluate((element) => {
          const style = getComputedStyle(element);
          return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
        }),
      { message: "El elemento enfocado debe tener un contorno visible" },
    )
    .toBe(true);
});

test("storefront home y producto responden sin overflow y conservan el carrito", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [viewports[0], viewports[2]]) {
    await page.setViewportSize(viewport);
    await page.goto(storefrontUrl);
    await expect(
      page.getByRole("heading", { level: 1, name: "Una casa con materia y calma." }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, `Storefront home ${viewport.name}`);
    if (viewport.name === "desktop") {
      await page.screenshot({ path: "test-results/home.png", fullPage: true });
    }

    await page.goto(`${storefrontUrl}/productos/manta-bruma/`);
    await expect(page.getByRole("heading", { level: 1, name: "Manta Bruma" })).toBeVisible();
    await expectNoHorizontalOverflow(page, `Storefront producto ${viewport.name}`);
    if (viewport.name === "desktop") {
      await page.screenshot({ path: "test-results/product.png", fullPage: true });
    }
  }

  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.locator("[data-cart-drawer]")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("[data-cart-count]").first()).toHaveText("1");
});
