import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { referenceStore } from "@solara/project-schema/fixture";

const fixtureFiles = new Map<string, Uint8Array>(
  ["casa-luma-hero.png", "manta-bruma.png", "jarra-delta.png"].map((name) => [
    `fixtures/${name}`,
    readFileSync(resolve("apps/studio/public/fixtures", name)),
  ]),
);

test("C4b/c: el sitio con subcarpeta navega con prefijo y sin duplicados", async ({ browser }) => {
  const project = { ...referenceStore, baseUrl: "https://casa-luma.example/tienda/" };
  const exported = exportProject(project as typeof referenceStore, { mode: "production" });
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    // El export genera rutas sin prefijo; el server simula el hosting en subcarpeta.
    const requested = decodeURIComponent(url.pathname)
      .replace(/^\/+/, "")
      .replace(/^tienda\//, "");
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
            : extension === "json"
              ? "application/json; charset=utf-8"
              : extension === "png"
                ? "image/png"
                : "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType }).end(content);
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  const serverUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  try {
    const page = await browser.newPage();
    const failures: string[] = [];
    page.on("requestfailed", (request) =>
      failures.push(
        `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "?"}`,
      ),
    );
    page.on("console", (message) => {
      if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });
    await page.route(/\/fixtures\/[a-z0-9-]+\.png$/, (route) => {
      const pathMatch = /\/fixtures\/([a-z0-9-]+\.png)$/.exec(
        new URL(route.request().url()).pathname,
      );
      const content = pathMatch ? fixtureFiles.get(`fixtures/${pathMatch[1]}`) : undefined;
      if (content) {
        route.fulfill({ status: 200, contentType: "image/png", body: content });
      } else {
        route.abort();
      }
    });
    await page.goto(`${serverUrl}/tienda/`, { waitUntil: "networkidle" });
    await page.goto(`${serverUrl}/tienda/categorias/mesa/`, { waitUntil: "networkidle" });
    await page.locator('a[href="/tienda/productos/jarra-delta/"]').first().click();
    await page.waitForURL("**/tienda/productos/jarra-delta/");
    await page.goto(`${serverUrl}/tienda/carrito/`, { waitUntil: "networkidle" });
    const baseHref = await page.locator("html").getAttribute("data-base-href");
    await page.close();
    expect(baseHref).toBe("/tienda");
    expect(failures).toEqual([]);
  } finally {
    await new Promise((resolveClose) => server.close(() => resolveClose()));
  }
});
