import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { referenceStore } from "@solara/project-schema/fixture";

const exported = exportProject(referenceStore, { mode: "production" });
const fixtureFiles = new Map<string, Uint8Array>(
  ["casa-luma-hero.png", "manta-bruma.png", "jarra-delta.png"].map((name) => [
    `fixtures/${name}`,
    readFileSync(resolve("apps/studio/public/fixtures", name)),
  ]),
);

test("P5-2: LCP con navegador frio, 3 corridas, mediana", async ({ browser }) => {
  const server = createServer((request, response) => {
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
            : extension === "png"
              ? "image/png"
              : "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType }).end(content);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  const serverUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  try {
    for (const route of ["/", "/productos/manta-bruma/"]) {
      const samples: number[] = [];
      for (let run = 0; run < 3; run += 1) {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.addInitScript(() => {
          window.__solaraLcp = -1;
          const observer = new PerformanceObserver((list) => {
            const latest = list.getEntries().at(-1);
            if (latest) window.__solaraLcp = Math.round(latest.startTime);
          });
          observer.observe({ type: "largest-contentful-paint", buffered: true });
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
        await page.goto(`${serverUrl}${route}`, { waitUntil: "load" });
        await page.waitForTimeout(500);
        const lcp = await page.evaluate(() => window.__solaraLcp);
        samples.push(lcp);
        await page.close();
        await context.close();
      }
      const sorted = [...samples].sort((a, b) => a - b);
      const median = sorted[1] ?? 0;
      console.log(`${route}: LCP muestras=${samples.join(",")} mediana=${median} ms`);
    }
  } finally {
    await new Promise((resolveClose) => server.close(() => resolveClose()));
  }
});
