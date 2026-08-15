import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

test.setTimeout(process.env.CI ? 60_000 : 30_000);

const project = structuredClone(catalogModernV2Store);
const exported = exportProject(project, { mode: "production" });
const fixtureFiles = new Map<string, Uint8Array>(
  ["hero", "remera", "jean", "camisa"].map((name) => [
    `fixtures/modo-sur-${name}.png`,
    readFileSync(resolve(`apps/studio/public/fixtures/modo-sur-${name}.png`)),
  ]),
);

let server: Server;
let serverUrl: string;

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
    const content = exported.files.get(path) ?? fixtureFiles.get(path);
    if (content === undefined) {
      response.writeHead(404).end("Not found");
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
    response.writeHead(200, { "Content-Type": contentType }).end(content);
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Sin puerto");
  serverUrl = `http://127.0.0.1:${address.port}/`;
});

test.afterAll(async () => {
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
});

test("Nosotros V2 renderiza sus módulos y completa el equipo editorial", async ({ page }) => {
  await page.goto(new URL("/nosotros/", serverUrl).toString());
  const modules = await page
    .locator("[data-solara-module]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-solara-module")),
    );
  expect(modules).toEqual(
    expect.arrayContaining([
      "about-hero",
      "about-history",
      "about-principles",
      "about-editorial-image",
      "about-process",
      "about-manifesto",
      "about-experience",
      "about-stats",
      "about-products-cta",
      "catalog-newsletter-cta",
      "catalog-footer",
    ]),
  );
  expect(await page.locator('[data-solara-module="about-team"]').count()).toBe(1);
  await expect(page.locator(".about-team-member")).toHaveCount(2);
  await expect(page.locator(".about-team-member img")).toHaveCount(2);
  await expect(page.locator(".about-team-member img").first()).toHaveAttribute(
    "src",
    /images\.unsplash\.com/,
  );
  await expect(page.locator(".about-hero h1")).toHaveText("Una selección pensada para moverte.");
  await expect(page.locator(".about-principle-item")).toHaveCount(4);
  await expect(page.locator(".about-process-item")).toHaveCount(4);
  await expect(page.locator(".about-stats-grid article")).toHaveCount(4);
});

test("Nosotros V2 no desborda en mobile y conserva el copy sin JavaScript", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL("/nosotros/", serverUrl).toString());
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator(".about-hero-image")).toBeVisible();
  await expect(page.locator(".about-manifesto blockquote")).toBeVisible();

  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const noJsPage = await context.newPage();
  await noJsPage.goto(new URL("/nosotros/", serverUrl).toString());
  await expect(noJsPage.locator(".about-hero h1")).toHaveText(
    "Una selección pensada para moverte.",
  );
  await expect(noJsPage.getByRole("link", { name: "Explorar productos" })).toHaveAttribute(
    "href",
    "/buscar/",
  );
  await context.close();
});

test("Nosotros V2 respeta reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(new URL("/nosotros/", serverUrl).toString());
  const motionZones = page.locator('[data-solara-module="about-hero"] [data-motion-zone]');
  await expect(motionZones).toHaveCount(2);
  await expect(motionZones.nth(0)).toHaveCSS("animation-name", "none");
  await expect(motionZones.nth(1)).toHaveCSS("animation-name", "none");
  await expect(page.locator(".about-hero h1")).toBeVisible();
});

test("Nosotros V2 conserva foco visible al navegar por teclado", async ({ page }) => {
  await page.goto(new URL("/nosotros/", serverUrl).toString());
  const cta = page.getByRole("link", { name: "Explorar productos" });
  await cta.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(cta).toBeFocused();
  const hasRing = await cta.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
  });
  expect(hasRing).toBe(true);
});

test("Nosotros V2 aplica la grilla editorial y limita los iconos", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(new URL("/nosotros/", serverUrl).toString());
  const heroColumns = await page
    .locator(".about-hero")
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  const iconBox = await page.locator(".solara-about-icon").first().boundingBox();
  expect(heroColumns).toBe(2);
  expect(iconBox?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(32);
  expect(iconBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(32);
});

test("Nosotros V2 comparte hero y ritmo de Inicio sin video", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(new URL("/", serverUrl).toString());
  const home = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>(
      '[data-solara-module="catalog-hero"] .catalog-hero-inner',
    );
    const copy = document.querySelector<HTMLElement>(
      '[data-solara-module="catalog-hero"] .catalog-hero-copy',
    );
    const section = document.querySelector<HTMLElement>(".catalog-product-grid-section");
    return {
      columns: hero ? getComputedStyle(hero).gridTemplateColumns : "",
      height: hero ? getComputedStyle(hero).height : "",
      copyPadding: copy ? getComputedStyle(copy).padding : "",
      sectionPadding: section ? getComputedStyle(section).paddingBlock : "",
    };
  });
  await page.goto(new URL("/nosotros/", serverUrl).toString());
  const about = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>(
      '[data-solara-module="about-hero"] .catalog-hero-inner',
    );
    const copy = document.querySelector<HTMLElement>(
      '[data-solara-module="about-hero"] .catalog-hero-copy',
    );
    const section = document.querySelector<HTMLElement>(".about-history");
    return {
      columns: hero ? getComputedStyle(hero).gridTemplateColumns : "",
      height: hero ? getComputedStyle(hero).height : "",
      copyPadding: copy ? getComputedStyle(copy).padding : "",
      sectionPadding: section ? getComputedStyle(section).paddingBlock : "",
      videos: document.querySelectorAll("video").length,
    };
  });
  expect(about.columns).toBe(home.columns);
  expect(about.height).toBe(home.height);
  expect(about.copyPadding).toBe(home.copyPadding);
  expect(about.sectionPadding).toBe(home.sectionPadding);
  expect(about.videos).toBe(0);
});
