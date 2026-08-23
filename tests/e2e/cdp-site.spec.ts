import { createServer } from "node:http";
import { test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { referenceStore } from "@solara/project-schema/fixture";

const exported = exportProject(referenceStore, { mode: "production" });

import { FIXTURE_PRODUCT_FILES } from "./fixture-server";

const fixtureFiles = FIXTURE_PRODUCT_FILES;

test("H1/H2: long tasks, rAF y LCP del sitio exportado", async ({ browser }) => {
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
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  const serverUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
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
    for (const route of ["/", "/productos/manta-bruma/"]) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Performance.enable");
      const before = await cdp.send("Performance.getMetrics");
      await page.goto(`${serverUrl}${route}`, { waitUntil: "load" });
      await page.waitForTimeout(3_000);
      const after = await cdp.send("Performance.getMetrics");
      const delta = (name: string): number => {
        const initial = before.metrics.find((metric) => metric.name === name)?.value ?? 0;
        const final = after.metrics.find((metric) => metric.name === name)?.value ?? 0;
        return final - initial;
      };
      const lcp = await page.evaluate(
        () =>
          new Promise<number>((resolveMeasure) => {
            const observer = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              const latest = entries.at(-1);
              if (latest) resolveMeasure(Math.round(latest.startTime));
            });
            observer.observe({ type: "largest-contentful-paint", buffered: true });
            setTimeout(() => resolveMeasure(-1), 4_000);
          }),
      );
      console.log(
        `${route}: ScriptDuration ${((delta("ScriptDuration") * 1_000) / 3).toFixed(1)} ms/s | ` +
          `TaskDuration ${((delta("TaskDuration") * 1_000) / 3).toFixed(1)} ms/s | LCP ${lcp} ms`,
      );
    }
    await page.close();
    await context.close();
  } finally {
    await new Promise((resolveClose) => server.close(() => resolveClose()));
  }
});
