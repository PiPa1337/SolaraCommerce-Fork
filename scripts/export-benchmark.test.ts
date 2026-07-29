import { expect, test } from "vitest";
import { generatePerformanceFixture } from "../packages/core/src/index";
import { exportProject } from "../packages/exporter/src/index";

test("exporta 1.000 productos dentro del presupuesto", () => {
  const project = generatePerformanceFixture(1_000);
  const startedAt = performance.now();
  const result = exportProject(project, { mode: "production" });
  const elapsedMs = performance.now() - startedAt;

  const activeProducts = project.products.filter((product) => product.status === "active").length;
  const productPages = [...result.files.keys()].filter(
    (path) => path.startsWith("productos/") && path.endsWith("/index.html"),
  ).length;

  expect(productPages).toBe(activeProducts);
  expect(result.files.has("google-merchant.xml")).toBe(true);
  expect(elapsedMs).toBeLessThan(30_000);

  console.log({
    products: project.products.length,
    activeProductPages: productPages,
    files: result.files.size,
    zipBytes: result.zip.byteLength,
    elapsedMs: Math.round(elapsedMs),
  });
});
