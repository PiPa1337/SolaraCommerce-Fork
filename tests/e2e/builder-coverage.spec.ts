import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

/**
 * Verificación integral del Constructor → sitio: cada módulo registrado debe
 * renderizar su `data-solara-module` en la página correcta del sitio
 * exportado (home, nosotros, contacto, producto). Si una sección editada en
 * el Constructor no aparece aquí, el constructor "no hace efecto en la web".
 */

const exported = exportProject(catalogModernV2Store, { mode: "production" });

const HOME_MODULES = [
  "catalog-announcement",
  "catalog-header",
  "catalog-hero",
  "catalog-brand-strip",
  "catalog-product-grid",
  "catalog-category-bento",
  "catalog-testimonials",
  "catalog-newsletter-cta",
  "contact-form",
  "contact-channels",
  "catalog-footer",
];

const ABOUT_MODULES = [
  "about-hero",
  "about-history",
  "about-principles",
  "about-editorial-image",
  "about-process",
  "about-manifesto",
  "about-experience",
  "about-team",
  "about-stats",
  "about-products-cta",
];

const CONTACT_MODULES = [
  "contact-hero",
  "contact-form",
  "contact-channels",
  "contact-help-grid",
  "contact-whatsapp-cta",
  "contact-purchase-info",
  "contact-faq",
  "contact-location",
];

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
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(Buffer.from(content));
  });
  await new Promise<void>((resolveListening) => server.listen(0, "127.0.0.1", resolveListening));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto.");
  serverUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
});

async function htmlOf(page: import("@playwright/test").Page, path: string): Promise<string> {
  const response = await page.goto(`${serverUrl}${path}`);
  expect(response?.status()).toBe(200);
  return page.content();
}

test("V2-B1: todas las secciones de Home del Constructor están en el sitio", async ({ page }) => {
  const html = await htmlOf(page, "/");
  const missing = HOME_MODULES.filter((id) => !html.includes(`data-solara-module="${id}"`));
  console.log("V2-B1 home faltantes:", JSON.stringify(missing));
  expect(missing).toEqual([]);
});

test("V2-B2: todas las secciones de Nosotros del Constructor están en /nosotros/", async ({
  page,
}) => {
  const html = await htmlOf(page, "/nosotros/");
  const missing = ABOUT_MODULES.filter((id) => !html.includes(`data-solara-module="${id}"`));
  console.log("V2-B2 nosotros faltantes:", JSON.stringify(missing));
  expect(missing).toEqual([]);
});

test("V2-B3: las secciones activas de Contacto del Constructor están en /contacto/", async ({
  page,
}) => {
  const html = await htmlOf(page, "/contacto/");
  // contact-location es condicional (nace deshabilitado sin datos de
  // ubicación): no se exige en la web hasta habilitarlo (V2-B6).
  const activeModules = CONTACT_MODULES.filter(
    (id) => !["contact-location", "contact-help-grid"].includes(id),
  );
  const missing = activeModules.filter((id) => !html.includes(`data-solara-module="${id}"`));
  console.log("V2-B3 contacto faltantes (activos):", JSON.stringify(missing));
  expect(missing).toEqual([]);
});

test("V2-B4: la página de producto incluye el detalle del Constructor", async ({ page }) => {
  const product = catalogModernV2Store.products.find((item) => item.status === "active");
  expect(product).toBeDefined();
  const html = await htmlOf(page, `/productos/${product?.slug}/`);
  expect(html).toContain('data-solara-module="catalog-product-detail"');
  expect(html).toContain('data-solara-module="catalog-header"');
  expect(html).toContain('data-solara-module="catalog-footer"');
  console.log("V2-B4 producto con detalle, header y footer");
});

test("V2-B5: el texto editado en una sección del Constructor aparece en la web", async ({
  page,
}) => {
  // El hero de Nosotros edita `title`: el sitio exportado debe mostrar el
  // valor de la configuración, no un texto quemado.
  const aboutPage = catalogModernV2Store.pages.find((item) => item.kind === "about");
  const hero = aboutPage?.sections.find((section) => section.moduleId === "about-hero");
  const expected = (hero?.settings as { title?: string }).title;
  expect(expected).toBeTruthy();
  const html = await htmlOf(page, "/nosotros/");
  expect(html).toContain(expected as string);
  console.log("V2-B5 hero de Nosotros en la web:", JSON.stringify(expected));
});

test("V2-B6: activar la ubicación en el Constructor la hace aparecer en la web", async ({
  page,
}) => {
  // contact-location nace deshabilitado (no aparece en la web); al habilitarlo
  // con datos, el sitio exportado debe renderizarlo.
  const contactPage = catalogModernV2Store.pages.find((item) => item.kind === "contact");
  const location = contactPage?.sections.find((section) => section.moduleId === "contact-location");
  const htmlOff = await htmlOf(page, "/contacto/");
  expect(htmlOff).not.toContain('data-solara-module="contact-location"');

  const locationSettings = location?.settings as
    | {
        enabled?: boolean;
        address?: string;
        title?: string;
      }
    | undefined;
  expect(locationSettings).toBeDefined();
  expect(locationSettings?.enabled).toBe(false);

  const enabledStore = structuredClone(catalogModernV2Store);
  const enabledPage = enabledStore.pages.find((item) => item.kind === "contact");
  if (enabledPage && location) {
    enabledPage.sections = enabledPage.sections.map((section) =>
      section.id === location.id
        ? {
            ...section,
            enabled: true,
            settings: {
              ...section.settings,
              enabled: true,
              address: "Av. Siempre Viva 742",
            },
          }
        : section,
    );
  }
  const exportedEnabled = exportProject(enabledStore, { mode: "production" });
  const htmlPath = "contacto/index.html";
  const raw = exportedEnabled.files.get(htmlPath);
  const htmlEnabled =
    typeof raw === "string"
      ? raw
      : new TextDecoder().decode(raw instanceof Uint8Array ? raw : new Uint8Array(raw ?? []));
  expect(htmlEnabled).toContain('data-solara-module="contact-location"');
  expect(htmlEnabled).toContain("Av. Siempre Viva 742");
  console.log("V2-B6 ubicación habilitada aparece en la web");
});

test("V2-B7: editar el hero de Nosotros en el Constructor se refleja en el preview", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://localhost:4173", { waitUntil: "load" });
  await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 30_000 });
  await page.locator('[data-store-card-id="store-modo-sur-demo"]').click();
  await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  await page.waitForTimeout(1500);

  const pageSelect = page.locator(".editor-pane select").nth(0);
  await pageSelect.selectOption({ label: "Nosotros" });
  await page.waitForTimeout(1000);

  await page.getByTestId("ui-preview-route").fill("/nosotros/");
  await page.getByTestId("ui-preview-route").press("Enter");
  await page.waitForTimeout(1200);

  const heroSection = page
    .getByRole("list", { name: "Secciones de la tienda" })
    .getByRole("listitem")
    .filter({ hasText: "Hero de Nosotros" });
  await heroSection.click();
  await page.waitForTimeout(800);

  const titleField = page.locator(".editor-pane input").nth(1);
  const newTitle = "Título verificado desde el Constructor";
  await titleField.fill(newTitle);
  await page.waitForTimeout(900);

  const preview = page.frameLocator('iframe[title^="Vista previa"]');
  await expect
    .poll(async () => (await preview.locator("h1").first().innerText()).trim(), {
      timeout: 15_000,
    })
    .toBe(newTitle);
  console.log("V2-B7 el título del hero de Nosotros editado aparece en el preview");
});
