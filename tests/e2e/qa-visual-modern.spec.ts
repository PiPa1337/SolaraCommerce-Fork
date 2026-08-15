import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";

const exported = exportProject(catalogModernStore, { mode: "production" });
const product = [...exported.files.keys()].find((path) =>
  /^productos\/[^/]+\/index\.html$/.test(path),
);
const category = [...exported.files.keys()].find((path) =>
  /^categorias\/[^/]+\/index\.html$/.test(path),
);

const routes = [
  "/",
  product ? `/${product.slice(0, -"index.html".length)}` : "/",
  category ? `/${category.slice(0, -"index.html".length)}` : "/",
  "/carrito/",
  "/compra/",
];

test("P8-3: capturas del sitio catalogModern para auditoria visual", async ({ browser }) => {
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
    const dir = resolve("test-results/qa-visual-modern");
    mkdirSync(dir, { recursive: true });
    const context = await browser.newContext();
    const page = await context.newPage();
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
    for (const viewport of [
      { name: "desktop", width: 1440, height: 900 },
      { name: "mobile", width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const route of routes) {
        const name = `${route.replace(/[/:]/g, "_").replace(/_+$/, "") || "home"}-${viewport.name}`;
        await page.goto(`${serverUrl}${route}`, { waitUntil: "networkidle" });
        await page.screenshot({ path: resolve(dir, `${name}.png`) });
      }
    }
    await page.close();
    await context.close();
  } finally {
    await new Promise((resolveClose) => server.close(() => resolveClose()));
  }
});
