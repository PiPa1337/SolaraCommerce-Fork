import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { referenceStore } from "@solara/project-schema/fixture";

const projects = {
  reference: referenceStore,
  catalogModern: catalogModernStore,
} as const;

function productRoute(project: (typeof projects)[keyof typeof projects]): string {
  const exported = exportProject(project, { mode: "production" });
  const product = [...exported.files.keys()].find((path) =>
    /^productos\/[^/]+\/index\.html$/.test(path),
  );
  return product ? `/${product.slice(0, -"index.html".length)}` : "/productos/";
}

test("P5-2: LCP con navegador frio, 3 corridas, mediana (reference y catalogModern)", async ({
  browser,
}) => {
  let exported = exportProject(referenceStore, { mode: "production" });
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
    for (const [fixtureName, project] of Object.entries(projects)) {
      exported = exportProject(project, { mode: "production" });
      const routes = ["/", productRoute(project)];
      for (const route of routes) {
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
          await page.goto(`${serverUrl}${route}`, { waitUntil: "load" });
          await page.waitForTimeout(500);
          const lcp = await page.evaluate(() => window.__solaraLcp);
          samples.push(lcp);
          await page.close();
          await context.close();
        }
        const sorted = [...samples].sort((a, b) => a - b);
        const median = sorted[1] ?? 0;
        console.log(`[${fixtureName}] ${route}: LCP mediana=${median} ms (${samples.join(",")})`);
      }
    }
  } finally {
    await new Promise((resolveClose) => server.close(() => resolveClose()));
  }
});
