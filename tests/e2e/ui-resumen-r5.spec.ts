/**
 * R5 — Auditoría Resumen (2026-08-10): navegación pública, subenlaces y
 * "Nombre del catálogo".
 *
 * Contrato de 4 capas con foco en UTILIDAD (bin R5 del plan de auditoría):
 *  (4a) diff del sitio exportado ANTES/DESPUÉS (patrón exported-store.spec.ts):
 *       con/sin subenlaces y con/sin label custom del catálogo;
 *  (4b) los subenlaces se despliegan en el header del sitio exportado MODERNO
 *       (catalog-header: mega-menu desktop + categorías móviles) y LEGACY
 *       (editorial-header: solara-nav-dropdown anidado);
 *  (4c) "Nombre del catálogo" (navigation.catalogLabel) cambia el label del
 *       enlace de catálogo integrado en moderno y legacy, y es el eyebrow del
 *       search dialog (fix Ola 3: ya no está hardcodeado "Catálogo");
 *  (4d) el enlace de catálogo integrado navega a /categorias/<slug>/ cuando
 *       hay items, o a /buscar/ como fallback sin items (con búsqueda activa).
 *
 * READ-ONLY de producción: esta spec exporta proyectos derivados de las
 * fixtures; no edita el Studio ni los módulos (fixes = Ola 3).
 */
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { StoreProjectV2Schema } from "@solara/project-schema";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { referenceStore } from "@solara/project-schema/fixture";

test.setTimeout(process.env.CI ? 90_000 : 45_000);

/** Tienda moderna con label custom y subenlaces en el segundo enlace. */
const modernWithSubLinks = StoreProjectV2Schema.parse({
  ...structuredClone(catalogModernStore),
  navigation: {
    ...structuredClone(catalogModernStore.navigation),
    catalogLabel: "Explorar",
    items: [
      { id: "nav-one", label: "Una categoría", href: "/categorias/remeras/" },
      {
        id: "nav-two",
        label: "Otra categoría",
        href: "/categorias/pantalones/",
        children: [{ id: "nav-child", label: "Subcategoría", href: "/categorias/jeans/" }],
      },
    ],
  },
});

/** Tienda moderna sin items de navegación (fallback del enlace de catálogo). */
const modernWithoutItems = StoreProjectV2Schema.parse({
  ...structuredClone(catalogModernStore),
  navigation: {
    ...structuredClone(catalogModernStore.navigation),
    items: [],
  },
});

/** Tienda legacy con label custom (subenlaces ya presentes en la fixture). */
const legacyWithSubLinks = StoreProjectV2Schema.parse({
  ...structuredClone(referenceStore),
  navigation: {
    ...structuredClone(referenceStore.navigation),
    catalogLabel: "Ver colecciones",
  },
});

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

function startExportServer(project: typeof catalogModernStore): Promise<{
  server: Server;
  url: string;
  files: Map<string, Uint8Array>;
}> {
  const exported = exportProject(project, { mode: "production" });
  return new Promise((resolveListening, rejectListening) => {
    const server = createServer((request, response) => {
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

    server.once("error", rejectListening);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        rejectListening(new Error("El servidor de pruebas no tiene una dirección TCP."));
        return;
      }
      resolveListening({ server, url: `http://127.0.0.1:${address.port}`, files: exported.files });
    });
  });
}

let modernServer: Server;
let modernUrl: string;
let emptyServer: Server;
let emptyUrl: string;
let legacyServer: Server;
let legacyUrl: string;

test.beforeAll(async () => {
  const modern = await startExportServer(modernWithSubLinks);
  modernServer = modern.server;
  modernUrl = modern.url;
  const empty = await startExportServer(modernWithoutItems);
  emptyServer = empty.server;
  emptyUrl = empty.url;
  const legacy = await startExportServer(legacyWithSubLinks);
  legacyServer = legacy.server;
  legacyUrl = legacy.url;
});

test.afterAll(async () => {
  for (const server of [modernServer, emptyServer, legacyServer]) {
    if (server) {
      await new Promise<void>((resolveClosing, rejectClosing) => {
        server.close((error) => (error ? rejectClosing(error) : resolveClosing()));
      });
    }
  }
});

function storeUrl(base: string, path: string): string {
  return new URL(path, base).toString();
}

test("subenlaces en el header moderno exportado: mega-menu desktop, móvil y runtime (capa 4)", async ({
  page,
  browser,
}) => {
  await page.goto(storeUrl(modernUrl, "/"));

  const header = page.locator('[data-solara-module="catalog-header"]');
  const trigger = header.locator("details.catalog-nav-menu > summary.catalog-nav-trigger");

  // 4c: "Nombre del catálogo" es el label del enlace de catálogo integrado.
  await expect(trigger).toContainText("Explorar");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  // 4b: los subenlaces viven en el mega-menu desktop (SSR, dentro del details).
  const megaMenu = header.locator("#catalog-category-menu");
  const groupWithChildren = megaMenu.locator("li.catalog-mega-group--has-children");
  await expect(groupWithChildren).toContainText("Otra categoría");
  const childLinks = groupWithChildren.locator(".catalog-mega-group__children a");
  await expect(childLinks).toHaveCount(1);
  await expect(childLinks.first()).toHaveText("Subcategoría");
  await expect(childLinks.first()).toHaveAttribute("href", "/categorias/jeans/");

  // 4b + runtime: abrir el dropdown con el summary y verificar el aria-expanded.
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(groupWithChildren.locator(".catalog-mega-group__children a")).toBeVisible();

  // Runtime: Escape cierra el dropdown y devuelve el foco al summary.
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  // 4b: móvil — el menú móvil repite el label y los subenlaces anidados.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.locator("[data-catalog-menu-open]").click();
  const mobileMenu = page.locator("#catalog-mobile-menu");
  await expect(mobileMenu).toBeVisible();
  const mobileCategories = mobileMenu.locator("details.catalog-mobile-categories");
  await expect(mobileCategories.locator(":scope > summary")).toContainText("Explorar");
  const mobileCategory = mobileMenu.locator("details.catalog-mobile-category", {
    hasText: "Otra categoría",
  });
  await expect(mobileCategory).toHaveCount(1);
  await expect(mobileCategory.locator(":scope > summary")).toContainText("Otra categoría");

  // Abrir el panel de categorías y luego la categoría anidada con subenlaces.
  await mobileCategories.locator(":scope > summary").click();
  await expect(mobileCategories.locator(":scope > summary")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(mobileCategories.locator(".catalog-mobile-categories__panel")).toBeVisible();
  await mobileCategory.locator(":scope > summary").click();
  await expect(mobileCategory.locator(":scope > summary")).toHaveAttribute("aria-expanded", "true");
  await expect(mobileCategory.locator(".catalog-mobile-category__children a")).toHaveCount(2);
  await expect(
    mobileCategory.locator('.catalog-mobile-category__children a[href="/categorias/jeans/"]'),
  ).toHaveText("Subcategoría");

  // 4a: diff ANTES/DESPUÉS — el HTML exportado cambia con el label y los hijos.
  const withChildren = String(
    exportProject(modernWithSubLinks, { mode: "production" }).files.get("index.html"),
  );
  const defaultLabel = String(
    exportProject(catalogModernStore, { mode: "production" }).files.get("index.html"),
  );
  const withoutChildren = String(
    exportProject(
      StoreProjectV2Schema.parse({
        ...structuredClone(modernWithSubLinks),
        navigation: {
          ...structuredClone(modernWithSubLinks.navigation),
          items: [
            { id: "nav-one", label: "Una categoría", href: "/categorias/remeras/" },
            { id: "nav-two", label: "Otra categoría", href: "/categorias/pantalones/" },
          ],
        },
      }),
      { mode: "production" },
    ).files.get("index.html"),
  );
  expect(withChildren).toContain('>Explorar<span class="catalog-nav-chevron"');
  expect(defaultLabel).toContain('>Categorías<span class="catalog-nav-chevron"');
  expect(withChildren).not.toBe(defaultLabel);
  expect(withChildren).toContain("catalog-mega-group__children");
  expect(withoutChildren).not.toContain("catalog-mega-group__children");
  expect(withoutChildren).not.toContain('class="catalog-mobile-category"');
  expect(withChildren).not.toBe(withoutChildren);

  // 4b: sin JavaScript los subenlaces siguen en el DOM (details nativo, SSR).
  const noJsContext = await browser.newContext({ javaScriptEnabled: false });
  const noJsPage = await noJsContext.newPage();
  await noJsPage.goto(storeUrl(modernUrl, "/"));
  await expect(
    noJsPage.locator('.catalog-mega-group__children a[href="/categorias/jeans/"]'),
  ).toHaveCount(1);
  await noJsContext.close();
});

test("subenlaces y nombre del catálogo en el header legacy exportado (capa 4)", async ({
  page,
  browser,
}) => {
  await page.goto(storeUrl(legacyUrl, "/"));

  const header = page.locator('[data-solara-module="editorial-header"]');
  const dropdown = header.locator("details.solara-nav-dropdown").first();

  // 4c: el label custom llega al summary del dropdown de catálogo.
  await expect(dropdown.locator(":scope > summary")).toContainText("Ver colecciones");

  // 4b: los subenlaces se despliegan como <ul> anidado dentro del item.
  await dropdown.locator(":scope > summary").click();
  await expect
    .poll(() => dropdown.evaluate((details) => (details as HTMLDetailsElement).open))
    .toBe(true);
  const nestedList = dropdown.locator("li:has(a[href='/categorias/mesa/']) > ul");
  await expect(nestedList.locator('a[href="/categorias/textiles/"]')).toHaveText("Textiles");
  await expect(nestedList.locator('a[href="/categorias/mesa/"]')).toHaveText("Mesa");

  // El menú móvil legacy duplica el dropdown (navegación móvil por SSR).
  await expect(header.locator("details.solara-mobile-nav details.solara-nav-dropdown")).toHaveCount(
    1,
  );

  // 4a: diff ANTES/DESPUÉS — label custom vs default y sin hijos vs con hijos.
  const withChildren = String(
    exportProject(legacyWithSubLinks, { mode: "production" }).files.get("index.html"),
  );
  const defaultLabel = String(
    exportProject(referenceStore, { mode: "production" }).files.get("index.html"),
  );
  const withoutChildren = String(
    exportProject(
      StoreProjectV2Schema.parse({
        ...structuredClone(legacyWithSubLinks),
        navigation: {
          ...structuredClone(legacyWithSubLinks.navigation),
          items: [
            {
              id: "nav-casa",
              label: "Casa",
              href: "/categorias/mesa/",
              children: [],
            },
          ],
        },
      }),
      { mode: "production" },
    ).files.get("index.html"),
  );
  expect(withChildren).toContain("<summary>Ver colecciones</summary>");
  expect(defaultLabel).toContain("<summary>Colecciones</summary>");
  expect(withChildren).not.toBe(defaultLabel);
  expect(withChildren).toContain('href="/categorias/textiles/">Textiles</a>');
  expect(withoutChildren).not.toContain('href="/categorias/textiles/">Textiles</a>');
  expect(withChildren).not.toBe(withoutChildren);

  // 4b: sin JavaScript los subenlaces legacy siguen en el DOM.
  const noJsContext = await browser.newContext({ javaScriptEnabled: false });
  const noJsPage = await noJsContext.newPage();
  await noJsPage.goto(storeUrl(legacyUrl, "/"));
  await expect(
    noJsPage.locator('.solara-desktop-nav .solara-nav-dropdown a[href="/categorias/textiles/"]'),
  ).toHaveCount(1);
  await noJsContext.close();
});

test("el enlace de catálogo integrado navega a /categorias/ o /buscar/ y no toca el search dialog (capa 4)", async ({
  page,
}) => {
  // Con items de navegación: el trigger abre el mega-menu con rutas /categorias/.
  await page.goto(storeUrl(modernUrl, "/"));
  const header = page.locator('[data-solara-module="catalog-header"]');
  await header.locator("details.catalog-nav-menu > summary").click();
  await header.locator('.catalog-mega-group__link[href="/categorias/remeras/"]').click();
  await expect(page).toHaveURL(/\/categorias\/remeras\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Remeras" })).toBeVisible();

  // 4c: el search dialog usa catalogLabel como eyebrow (fix Ola 3).
  await page.goto(storeUrl(modernUrl, "/"));
  await expect(page.locator("#catalog-search-dialog .catalog-eyebrow")).toHaveText("Explorar");
  await expect(page.locator("#catalog-search-dialog")).not.toContainText("Catálogo");

  // Sin items + búsqueda activa: el enlace integrado cae a /buscar/ con el label.
  await page.goto(storeUrl(emptyUrl, "/"));
  const emptyLink = page.locator("a.catalog-nav-empty");
  await expect(emptyLink).toHaveAttribute("href", "/buscar/");
  await expect(emptyLink).toHaveText("Categorías");
  await expect(
    page.locator('#catalog-mobile-menu a.catalog-mobile-nav-link[href="/buscar/"]'),
  ).toHaveText("Categorías");
  await emptyLink.click();
  await expect(page).toHaveURL(/\/buscar\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Buscar productos" })).toBeVisible();
});
