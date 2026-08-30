import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

const withoutLocation = exportProject(catalogModernV2Store, { mode: "production" });
const withLocationProject = structuredClone(catalogModernV2Store);
const pageLocation = withLocationProject.pages
  .find((page) => page.kind === "contact")
  ?.sections.find((section) => section.moduleId === "contact-location");
if (!pageLocation) throw new Error("Fixture sin sección de ubicación de contacto");
// Snapshot QA aislado: no modifica el fixture persistido y usa un id propio.
const contactLocation = {
  ...pageLocation,
  id: "qa-contact-location" as typeof pageLocation.id,
  enabled: true,
  settings: {
    ...pageLocation.settings,
    enabled: true,
    address: "Av. de prueba 123",
  },
};
withLocationProject.sections.push(contactLocation);
const withLocation = exportProject(withLocationProject, { mode: "production" });

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
    const selected = url.searchParams.get("location") === "active" ? withLocation : withoutLocation;
    const content = selected.files.get(path) ?? withoutLocation.files.get(path);
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
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    response.end(content);
  });
  await new Promise<void>((resolveListening) => {
    server.listen(0, "127.0.0.1", resolveListening);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Servidor sin puerto TCP.");
  serverUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolveClosing, reject) => {
    server.close((error) => (error ? reject(error) : resolveClosing()));
  });
});

test("los accesos de dirección y horarios nunca apuntan a un fragmento muerto", async ({
  page,
}) => {
  for (const fixture of [
    { query: "", target: "#contact-form", location: false },
    { query: "?location=active", target: "#contact-location", location: true },
  ]) {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`${serverUrl}/${fixture.query}`, { waitUntil: "load" });
      const channels = page.locator('[data-solara-module="contact-channels"]');
      await expect(channels.locator(`a[href="${fixture.target}"]`)).toHaveCount(2);
      await expect(channels.locator('a[href="#contact-location"]')).toHaveCount(
        fixture.location ? 2 : 0,
      );
      await expect(page.locator(fixture.target)).toHaveCount(1);
    }
  }
});
