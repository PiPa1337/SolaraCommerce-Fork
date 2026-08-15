import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { referenceStore } from "@solara/project-schema/fixture";

const exported = exportProject(referenceStore, { mode: "production" });

test("P8-7: agregar al carrito y navegar sin errores de consola", async ({ browser }) => {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const path =
      requested === ""
        ? "index.html"
        : requested.endsWith("/")
          ? `${requested}index.html`
          : requested;
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
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  const serverUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() === 404) errors.push(`404: ${response.url()}`);
    });
    await page.route(/\/fixtures\/[a-z0-9-]+\.png$/, (route) => {
      const pathMatch = /\/fixtures\/([a-z0-9-]+\.png)$/.exec(
        new URL(route.request().url()).pathname,
      );
      const name = pathMatch?.[1];
      try {
        const content = name
          ? readFileSync(resolve("apps/studio/public/fixtures", name))
          : undefined;
        if (content) {
          route.fulfill({ status: 200, contentType: "image/png", body: content });
        } else {
          route.abort();
        }
      } catch {
        route.abort();
      }
    });
    await page.goto(`${serverUrl}/productos/manta-bruma/`, { waitUntil: "networkidle" });
    await page.locator("[data-add-to-cart]").first().click();
    await page.goto(`${serverUrl}/carrito/`, { waitUntil: "networkidle" });
    const cartText = await page.locator("[data-cart-lines]").first().innerText();
    expect(cartText).toContain("Manta Bruma");
    await page.goto(`${serverUrl}/compra/`, { waitUntil: "networkidle" });
    await page.close();
    await context.close();
    console.log("P8-7 errores:", JSON.stringify(errors));
    expect(errors).toEqual([]);
  } finally {
    await new Promise((resolveClose) => server.close(() => resolveClose()));
  }
});
