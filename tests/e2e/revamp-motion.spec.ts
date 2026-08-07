import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { createModuleSection, getModuleDefinition } from "@solara/modules";
import {
  type StoreProjectV2,
  StoreProjectV2Schema,
  type StoreSection,
} from "@solara/project-schema";
import { buildCatalogModernProject } from "@solara/project-schema/catalog-modern-template";

test.setTimeout(process.env.CI ? 60_000 : 30_000);

const REVAMP_FAQ_SECTION_ID = "revamp-section-faq";
const REVAMP_STATS_SECTION_ID = "revamp-section-stats";

const revampFadeUpMotion = {
  preset: "fade-up",
  intensity: 4,
  direction: "up",
  distance: 16,
  duration: 0.45,
  delay: 0,
  stagger: 0,
  easing: "cubic-bezier(.16,1,.3,1)",
  entryPoint: 0.2,
  once: true,
} satisfies StoreSection["motion"];

function buildRevampStore(): StoreProjectV2 {
  const project = buildCatalogModernProject({
    seed: "revamp",
    id: "store-modo-sur-revamp",
    name: "Predeterminado Revamp",
    slug: "predeterminado-revamp",
  });
  const faqDefinition = getModuleDefinition("catalog-faq");
  const statsDefinition = getModuleDefinition("catalog-stats");
  if (!faqDefinition || !statsDefinition) {
    throw new Error(
      "Los módulos catalog-faq y catalog-stats deben estar registrados (dependencia de Task 2A).",
    );
  }
  const faq = createModuleSection({
    id: REVAMP_FAQ_SECTION_ID,
    slot: faqDefinition.manifest.slots[0] ?? "content",
    moduleId: "catalog-faq",
  });
  const stats = createModuleSection({
    id: REVAMP_STATS_SECTION_ID,
    slot: statsDefinition.manifest.slots[0] ?? "content",
    moduleId: "catalog-stats",
  });
  const footerIndex = project.sections.findIndex(
    (section) => section.moduleId === "catalog-footer",
  );
  const beforeFooter = footerIndex === -1 ? project.sections.length : footerIndex;
  const sections = [
    ...project.sections.slice(0, beforeFooter),
    { ...stats, motion: revampFadeUpMotion },
    { ...faq, motion: revampFadeUpMotion },
    ...project.sections.slice(beforeFooter),
  ];
  return StoreProjectV2Schema.parse({ ...project, sections });
}

const fixtureFiles = new Map<string, Uint8Array>([
  [
    "fixtures/modo-sur-hero.png",
    readFileSync(resolve("apps/studio/public/fixtures/modo-sur-hero.png")),
  ],
  [
    "fixtures/modo-sur-remera.png",
    readFileSync(resolve("apps/studio/public/fixtures/modo-sur-remera.png")),
  ],
  [
    "fixtures/modo-sur-jean.png",
    readFileSync(resolve("apps/studio/public/fixtures/modo-sur-jean.png")),
  ],
  [
    "fixtures/modo-sur-camisa.png",
    readFileSync(resolve("apps/studio/public/fixtures/modo-sur-camisa.png")),
  ],
]);

let server: Server;
let storefrontUrl: string;

test.beforeAll(async () => {
  const exported = exportProject(buildRevampStore(), { mode: "production" });
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
    server.listen(0, "127.0.0.1", resolveListening);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("No se pudo obtener el puerto del storefront revamp.");
  }
  storefrontUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolveClosing, reject) => {
    server.close((error) => (error ? reject(error) : resolveClosing()));
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

test("la FAQ de la tienda revamp es exclusiva y operable por teclado", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${storefrontUrl}/`);

  const faqSection = page.locator('[data-solara-module="catalog-faq"]');
  await expect(faqSection).toBeVisible();
  const faqRoot = faqSection.locator("[data-faq-root]");
  const items = faqRoot.locator("details.solara-faq-item");
  await expect(items.nth(1)).toBeVisible();
  await expect(items.nth(1).locator("summary")).toHaveText(/.+/);

  const declaredFeatures =
    (await page.locator("html").getAttribute("data-solara-runtime-features")) ?? "";
  expect(
    declaredFeatures.split(","),
    "El sitio debe declarar la capability micro (contrato 1A/2A: lista default) para activar la exclusividad de la FAQ.",
  ).toContain("micro");

  await items.nth(0).locator("summary").click();
  await expect(items.nth(0)).toHaveAttribute("open", "");
  await items.nth(1).locator("summary").click();
  await expect(items.nth(1)).toHaveAttribute("open", "");
  await expect(items.nth(0)).not.toHaveAttribute("open", "");

  await items.nth(0).locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(items.nth(0)).toHaveAttribute("open", "");
  await expect(items.nth(1)).not.toHaveAttribute("open", "");
  await items.nth(1).locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(items.nth(1)).toHaveAttribute("open", "");
  await expect(items.nth(0)).not.toHaveAttribute("open", "");
});

test("los contadores de stats de la tienda revamp muestran los valores finales", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${storefrontUrl}/`);

  const statsSection = page.locator('[data-solara-module="catalog-stats"]');
  await expect(statsSection).toBeVisible();
  const statsRoot = statsSection.locator("[data-stats-root]");
  await statsRoot.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await expect(statsRoot.locator('[data-stat-value="50"]')).toHaveText("50");
  await expect(statsRoot.locator('[data-stat-value="14"]')).toHaveText("14");
  await expect(statsRoot.locator('[data-stat-value="60"]')).toHaveText("60");
  await expect(statsRoot.locator('[data-stat-value="1"]')).toHaveText("1");
  await expect(statsRoot.locator('.catalog-stat[data-stat-target="50"]')).toBeVisible();
  await expect(statsRoot.locator('.catalog-stat[data-stat-target="14"]')).toBeVisible();
  await expect(statsRoot.locator('.catalog-stat[data-stat-target="60"]')).toBeVisible();
  await expect(statsRoot.locator('.catalog-stat[data-stat-target="1"]')).toBeVisible();
});

test("los presets de la tienda revamp respetan prefers-reduced-motion", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${storefrontUrl}/`);
  await expect(page.locator("html")).toHaveAttribute("data-motion-ready", "true");

  const hero = page.locator('[data-motion-root][data-motion-preset="layer-stack"]');
  await expect(hero).toHaveCount(1);
  await expect(hero).toHaveAttribute("data-solara-module", "catalog-hero");
  await expect(hero).toHaveAttribute("data-motion-visible", "true");

  const gridRoot = page.locator('[data-motion-root][data-motion-preset="stagger"]').first();
  await gridRoot.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await expect(gridRoot).toHaveAttribute("data-motion-visible", "true");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${storefrontUrl}/`);
  const heroReduce = page.locator('[data-motion-root][data-motion-preset="layer-stack"]');
  await expect(heroReduce).toHaveCount(1);
  await expect(heroReduce).toHaveAttribute("data-motion-visible", "true");
  const motionRootCount = await page.locator("[data-motion-root]").count();
  const visibleRootCount = await page
    .locator('[data-motion-root][data-motion-visible="true"]')
    .count();
  expect(visibleRootCount).toBe(motionRootCount);
  const zoneStyle = await heroReduce
    .locator("[data-motion-zone]")
    .first()
    .evaluate((element) => ({
      opacity: getComputedStyle(element).opacity,
      animationDuration: getComputedStyle(element).animationDuration,
    }));
  expect(zoneStyle.opacity).toBe("1");
  expect(Number.parseFloat(zoneStyle.animationDuration)).toBeLessThanOrEqual(0.001);
});

test("la home de la tienda revamp renderiza sin JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${storefrontUrl}/`);

    await expect(
      page.getByRole("heading", { level: 1, name: "Vestite con lo que te representa." }),
    ).toBeVisible();
    await expect(page.locator(".catalog-product-grid .catalog-product-card").first()).toBeVisible();
    const faqRoot = page.locator('[data-solara-module="catalog-faq"] [data-faq-root]');
    await expect(faqRoot.locator("details.solara-faq-item").nth(1)).toBeVisible();
    await expect(
      page.locator('[data-solara-module="catalog-stats"] [data-stat-value="50"]'),
    ).toHaveText("50");
    await faqRoot.locator("details.solara-faq-item").nth(0).locator("summary").click();
    await expect(faqRoot.locator("details.solara-faq-item").nth(0)).toHaveAttribute("open", "");
  } finally {
    await context.close();
  }
});

test("la tienda revamp no desborda en la matriz de viewports", async ({ page }) => {
  const viewports = [
    { name: "móvil", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 900 },
    { name: "desktop-medio", width: 1024, height: 900 },
    { name: "desktop", width: 1440, height: 900 },
  ] as const;
  const routes = [
    { name: "home", path: "/" },
    { name: "producto", path: "/productos/remera-esencial-de-algodon/" },
  ] as const;

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of routes) {
      await page.goto(`${storefrontUrl}${route.path}`);
      await expectNoHorizontalOverflow(
        page,
        `Ruta ${route.name} en viewport ${viewport.width}x${viewport.height}`,
      );
    }
  }
});

test("tilt y botones magnéticos responden al puntero fino", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${storefrontUrl}/`);
  await expect(page.locator("html")).toHaveAttribute("data-motion-ready", "true");

  const declaredFeatures =
    (await page.locator("html").getAttribute("data-solara-runtime-features")) ?? "";
  expect(
    declaredFeatures.split(","),
    "El sitio debe declarar la capability micro (contrato 1A/2A: lista default) para activar tilt y efectos magnéticos.",
  ).toContain("micro");

  const magnetic = page.locator(".catalog-primary-action[data-magnetic]");
  await expect(magnetic).toBeVisible();
  const magneticBox = (await magnetic.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  await page.mouse.move(
    magneticBox.x + Math.min(28, magneticBox.width / 3),
    magneticBox.y + Math.min(14, magneticBox.height / 3),
  );
  await page.waitForTimeout(80);
  const magneticVars = await magnetic.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      mx: style.getPropertyValue("--mx"),
      my: style.getPropertyValue("--my"),
    };
  });
  expect(magneticVars.mx).not.toBe("");
  expect(magneticVars.mx).not.toBe("0px");
  expect(magneticVars.my).not.toBe("");
  expect(magneticVars.my).not.toBe("0px");

  const parallaxLayer = page.locator('[data-hero-parallax] [data-parallax-layer="1"]');
  await expect(parallaxLayer).toBeVisible();
  await page.waitForTimeout(160);
  const parallaxStyle = await parallaxLayer.evaluate((element) => {
    const style = getComputedStyle(element);
    const matrix = style.transform.match(/^matrix\((.+)\)$/);
    if (!matrix) return { transform: style.transform, tx: 0, ty: 0 };
    const values = matrix[1].split(", ").map(Number);
    return { transform: style.transform, tx: values[4] ?? 0, ty: values[5] ?? 0 };
  });
  expect(
    Math.abs(parallaxStyle.tx) + Math.abs(parallaxStyle.ty),
    `la capa media del parallax debe traducirse con el puntero (transform: ${parallaxStyle.transform})`,
  ).toBeGreaterThan(0);
  await expect(
    page.locator("[data-hero-parallax] .catalog-hero-media .catalog-hero-image"),
  ).toHaveClass(/solara-clip-reveal/);

  const card = page.locator("[data-product-card]").first();
  await card.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await expect(card).toBeVisible();
  const cardBox = (await card.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  await page.mouse.move(
    cardBox.x + Math.min(48, cardBox.width / 3),
    cardBox.y + Math.min(36, cardBox.height / 3),
  );
  await page.waitForTimeout(120);
  const tiltVars = await card.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      rx: style.getPropertyValue("--rx"),
      ry: style.getPropertyValue("--ry"),
    };
  });
  expect(tiltVars.rx).not.toBe("");
  expect(tiltVars.rx).not.toBe("0deg");
  expect(tiltVars.ry).not.toBe("");
  expect(tiltVars.ry).not.toBe("0deg");
});
