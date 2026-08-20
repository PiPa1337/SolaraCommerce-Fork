import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

const project = structuredClone(catalogModernV2Store);
project.whatsapp = { ...project.whatsapp, phone: "5491123456789" };
project.identity = {
  ...project.identity,
  email: "hola@contacto.example",
  phone: "5491123456789",
  address: "Buenos Aires, Argentina",
};
const fixtureBrand = project.identity.brandName;
const exported = exportProject(project, { mode: "production" });
let server: Server;
let serverUrl: string;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const path = requested === "" || requested.endsWith("/") ? `${requested}index.html` : requested;
    const content = exported.files.get(path);
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
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  serverUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
});

test("Contacto V2 vive al final de Home y mantiene el formulario funcional", async ({ page }) => {
  await page.goto(serverUrl);
  const contact = page.locator(".solara-home-contact");
  await expect(contact).toBeVisible();
  await expect(contact.locator('[data-solara-module="contact-form"]')).toContainText("Escribinos");
  await expect(contact.locator('[data-solara-module="contact-channels"]')).toContainText(
    "Nuestros canales",
  );
  const standalone = await page.goto(`${serverUrl}/contacto/`);
  expect(standalone?.status()).toBe(404);
  await page.goto(serverUrl);

  await page.addInitScript(() => {
    window.open = (url?: string | URL) => {
      (window as Window & { __contactUrl?: string }).__contactUrl = String(url ?? "");
      return null;
    };
  });
  await page.reload();
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
  expect(contactUrl).toContain("mailto:hola@contacto.example?subject=");
  expect(decodeURIComponent(contactUrl)).toContain(
    `Hola ${fixtureBrand}, quiero hacer una consulta.`,
  );
  expect(decodeURIComponent(contactUrl)).toContain("Quiero consultar un talle");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );
});
