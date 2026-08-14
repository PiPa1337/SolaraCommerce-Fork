import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { referenceStore } from "@solara/project-schema/fixture";

const exported = exportProject(referenceStore, { mode: "production" });
const fixtureFiles = new Map<string, Uint8Array>(
  ["casa-luma-hero.png", "manta-bruma.png", "jarra-delta.png"].map((name) => [
    `fixtures/${name}`,
    readFileSync(resolve("apps/studio/public/fixtures", name)),
  ]),
);

test("P4-4: el foco del teclado es visible en las rutas clave", async ({ browser }) => {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const path =
      requested === "" ? "index.html" : requested.endsWith("/") ? `${requested}index.html` : requested;
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
            : extension === "png"
              ? "image/png"
              : "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType }).end(content);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  const serverUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route(/\/fixtures\/[a-z0-9-]+\.png$/, (route) => {
      const pathMatch = /\/fixtures\/([a-z0-9-]+\.png)$/.exec(
        new URL(route.request().url()).pathname,
      );
      const name = pathMatch?.[1];
      try {
        const content = name ? readFileSync(resolve("apps/studio/public/fixtures", name)) : undefined;
        if (content) {
          route.fulfill({ status: 200, contentType: "image/png", body: content });
        } else {
          route.abort();
        }
      } catch {
        route.abort();
      }
    });
    const invisibleFocus: string[] = [];
    for (const route of ["/", "/productos/manta-bruma/"]) {
      await page.goto(`${serverUrl}${route}`, { waitUntil: "load" });
      for (let tab = 0; tab < 6; tab += 1) {
        await page.keyboard.press("Tab");
        const focus = await page.evaluate(() => {
          const active = document.activeElement;
          if (!active || active === document.body) return null;
          const style = getComputedStyle(active);
          const outlineWidth = parseFloat(style.outlineWidth);
          const outlineStyle = style.outlineStyle;
          const boxShadow = style.boxShadow;
          const visible =
            (outlineWidth > 0 && outlineStyle !== "none") ||
            (boxShadow !== "none" && boxShadow !== "undefined" && boxShadow.length > 4);
          return { tag: active.tagName, outline: `${outlineStyle} ${outlineWidth}px`, visible };
        });
        if (focus && !focus.visible) {
          invisibleFocus.push(`${route} tab=${tab + 1} ${focus.tag} outline=${focus.outline}`);
        }
      }
    }
    await page.close();
    await context.close();
    console.log("P4-4 foco invisible:", JSON.stringify(invisibleFocus));
    expect(invisibleFocus).toEqual([]);
  } finally {
    await new Promise((resolveClose) => server.close(() => resolveClose()));
  }
});
