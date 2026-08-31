import { performance } from "node:perf_hooks";
import { describe, it } from "vitest";
import { createHistory, executeCommand } from "../packages/core/src/index";
import { generatePerformanceFixture } from "../packages/core/src/performance";
import { exportProject, renderPreviewHtml } from "../packages/exporter/src/index";
import { StoreProjectV1Schema } from "../packages/project-schema/src/index";

async function measure(label: string, fn: () => any) {
  const startMem = process.memoryUsage().heapUsed;
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  const endMem = process.memoryUsage().heapUsed;
  const elapsed = end - start;
  const memDelta = (endMem - startMem) / 1024 / 1024;
  console.log(`${label}: ${elapsed.toFixed(2)}ms, mem Δ ${memDelta.toFixed(2)}MB`);
  return { elapsed, result };
}

describe("perf benchmark", () => {
  for (const n of [50, 500, 2000, 5000, 10000]) {
    it(`escenario ${n} productos`, async () => {
      console.log(`\n=== Escenario ${n} productos ===`);
      const proj = generatePerformanceFixture(n);
      (proj as any).commerceTemplates.designFamily = "catalog-modern-v2";
      const parsed = StoreProjectV1Schema.parse(proj);
      await measure(`StoreProjectV1Schema.parse ${n}`, () => StoreProjectV1Schema.parse(proj));
      await measure(`reduceProject addTags ${n}`, () => {
        const history = createHistory(parsed);
        const cmd: any = {
          type: "products.addTags",
          productIds: [parsed.products[0].id],
          tags: ["perf"],
          at: new Date().toISOString(),
        };
        return executeCommand(history, cmd);
      });
      const expResult = await measure(`exportProject ${n}`, () =>
        exportProject(parsed, { mode: "production" }),
      );
      await measure(`renderPreviewHtml ${n}`, () => renderPreviewHtml(parsed, "draft", "/"));
      const exp: any = expResult.result;
      const html = String(exp.files.get("index.html"));
      const css = String(exp.files.get("assets/storefront.css"));
      const js = String(exp.files.get("assets/storefront.js"));
      console.log(
        `HTML ${n}: ${(Buffer.byteLength(html) / 1024).toFixed(1)}KB, CSS ${(Buffer.byteLength(css) / 1024).toFixed(1)}KB, JS ${(Buffer.byteLength(js) / 1024).toFixed(1)}KB, files ${exp.files.size}`,
      );
      console.log(`Mem peak ${n}: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
      // also measure search-index
      await measure(`search-index ${n}`, () => exp.files.get("search-index.json"));
    }, 120000);
  }
});
