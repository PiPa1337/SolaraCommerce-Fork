import { createServer } from "node:http";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { referenceStore } from "@solara/project-schema/fixture";

test("V6: el target táctil del carrito mide al menos 44px en mobile", async ({ browser }) => {
  const exported = exportProject(referenceStore, { mode: "production" });
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const path =
      requested === "" ? "index.html" : requested.endsWith("/") ? `${requested}index.html` : requested;
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
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  const serverUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${serverUrl}/`, { waitUntil: "networkidle" });
    const box = await page
      .locator(".solara-cart-trigger, .catalog-cart-link")
      .first()
      .boundingBox();
    await page.close();
    if (!box) throw new Error("No se encontró el trigger del carrito");
    expect(box.height).toBeGreaterThanOrEqual(44);
  } finally {
    await new Promise((resolveClose) => server.close(() => resolveClose()));
  }
});
