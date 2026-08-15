import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

test.setTimeout(process.env.CI ? 60_000 : 30_000);

const project = structuredClone(catalogModernV2Store);
project.whatsapp = { ...project.whatsapp, phone: "5491123456789" };
project.identity = {
  ...project.identity,
  email: "hola@modosur.example",
  phone: "5491123456789",
  address: "Buenos Aires, Argentina",
};
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

test("Contacto V2 renderiza sus módulos y conserva el orden editorial", async ({ page }) => {
  await page.goto(new URL("/contacto/", serverUrl).toString());
  const modules = await page
    .locator("[data-solara-module]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-solara-module")),
    );
  expect(modules).toEqual(
    expect.arrayContaining([
      "contact-hero",
      "contact-form",
      "contact-channels",
      "contact-help-grid",
      "contact-whatsapp-cta",
      "contact-purchase-info",
      "contact-faq",
      "catalog-newsletter-cta",
      "catalog-footer",
    ]),
  );
  expect(await page.locator(".contact-location").count()).toBe(0);
  await expect(page.locator(".contact-hero h1")).toHaveText("Estamos para ayudarte.");
  await expect(page.locator(".contact-help-item")).toHaveCount(4);
  await expect(page.locator(".contact-faq details")).toHaveCount(6);
});

test("Contacto V2 abre WhatsApp con los datos del formulario", async ({ page }) => {
  await page.addInitScript(() => {
    const originalOpen = window.open;
    window.open = (url?: string | URL) => {
      (window as Window & { __contactUrl?: string }).__contactUrl = String(url ?? "");
      return null;
    };
    void originalOpen;
  });
  await page.goto(new URL("/contacto/", serverUrl).toString());
  const form = page.locator("[data-solara-contact-form]");
  await form.locator('input[name="name"]').fill("Ana");
  await form.locator('input[name="email"]').fill("ana@example.com");
  await form.locator('input[name="phone"]').fill("11 5555 1111");
  await form.locator('select[name="reason"]').selectOption({ label: "Consulta de producto" });
  await form.locator('textarea[name="message"]').fill("Quiero consultar un talle");
  await form.locator('button[type="submit"]').click();
  const contactUrl = await page.evaluate(
    () => (window as Window & { __contactUrl?: string }).__contactUrl ?? "",
  );
  expect(contactUrl).toContain("https://wa.me/5491123456789?text=");
  expect(decodeURIComponent(contactUrl)).toContain("Ana");
  expect(decodeURIComponent(contactUrl)).toContain("Quiero consultar un talle");
});

test("Contacto V2 no desborda en mobile y conserva FAQ nativa", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL("/contacto/", serverUrl).toString());
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator(".contact-help-grid")).toBeVisible();
  await expect(page.locator(".contact-faq details")).toHaveCount(6);
  await page.locator(".contact-faq details").first().locator("summary").click();
  await expect(page.locator(".contact-faq details").first()).toHaveAttribute("open", "");
});

test("Contacto V2 comparte hero y ritmo de Inicio sin video", async ({ page }) => {
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
  await page.goto(new URL("/contacto/", serverUrl).toString());
  const contact = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>(
      '[data-solara-module="contact-hero"] .catalog-hero-inner',
    );
    const copy = document.querySelector<HTMLElement>(
      '[data-solara-module="contact-hero"] .catalog-hero-copy',
    );
    const section = document.querySelector<HTMLElement>(".contact-main-grid");
    return {
      columns: hero ? getComputedStyle(hero).gridTemplateColumns : "",
      height: hero ? getComputedStyle(hero).height : "",
      copyPadding: copy ? getComputedStyle(copy).padding : "",
      sectionPadding: section ? getComputedStyle(section).paddingBlock : "",
      videos: document.querySelectorAll("video").length,
    };
  });
  expect(contact.columns).toBe(home.columns);
  expect(contact.height).toBe(home.height);
  expect(contact.copyPadding).toBe(home.copyPadding);
  expect(contact.sectionPadding).toBe(home.sectionPadding);
  expect(contact.videos).toBe(0);
});
