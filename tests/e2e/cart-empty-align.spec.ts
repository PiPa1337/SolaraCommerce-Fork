import { createServer } from "node:http";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { referenceStore } from "@solara/project-schema/fixture";

test("V1: el carrito vacío centra el mensaje contra el resumen", async ({ browser }) => {
  const exported = exportProject(referenceStore, { mode: "production" });
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
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  const serverUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${serverUrl}/carrito/`, { waitUntil: "networkidle" });
    const centers = await page.evaluate(() => {
      const center = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return Math.round(box.top + box.height / 2);
      };
      return {
        lines: center("[data-cart-lines]"),
        summary: center(".solara-cart-summary"),
      };
    });
    await page.close();
    if (centers.lines === null || centers.summary === null) {
      throw new Error("No se encontraron las columnas del carrito");
    }
    expect(Math.abs(centers.lines - centers.summary)).toBeLessThanOrEqual(40);
  } finally {
    await new Promise((resolveClose) => server.close(() => resolveClose()));
  }
});
