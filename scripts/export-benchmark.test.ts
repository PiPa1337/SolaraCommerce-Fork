import { expect, test } from "vitest";
import { generatePerformanceFixture } from "../packages/core/src/performance";
import { exportProject } from "../packages/exporter/src/index";

test("exporta catalog-modern-v2 con 2.000 productos dentro del presupuesto", () => {
  const project = generatePerformanceFixture(2_000);
  project.commerceTemplates.designFamily = "catalog-modern-v2";
  const requestedValidationMode = process.env.SOLARA_VALIDATION_MODE?.trim().toLowerCase();
  const validationMode =
    process.env.CI === "true"
      ? "strict"
      : requestedValidationMode === "strict" || requestedValidationMode === "advisory"
        ? requestedValidationMode
        : "advisory";
  const isAdvisory = validationMode === "advisory";
  const benchmarkBudgetMs = Number(process.env.SOLARA_EXPORT_BENCHMARK_BUDGET_MS ?? 30_000);
  const benchmarkFilesBudgetBytes = Number(
    process.env.SOLARA_EXPORT_BENCHMARK_FILES_BUDGET_BYTES ?? 48 * 1024 * 1024,
  );
  const startedAt = performance.now();
  const result = exportProject(project, { mode: "production" });
  const elapsedMs = performance.now() - startedAt;

  const activeProducts = project.products.filter((product) => product.status === "active").length;
  const productPages = [...result.files.keys()].filter(
    (path) => path.startsWith("productos/") && path.endsWith("/index.html"),
  ).length;
  const searchIndex = JSON.parse(String(result.files.get("search-index.json"))) as unknown[];
  const home = String(result.files.get("index.html"));

  expect(productPages).toBe(activeProducts);
  expect(searchIndex).toHaveLength(activeProducts);
  expect(home).toContain('data-design-family="catalog-modern-v2"');
  expect(result.files.has("google-merchant.xml")).toBe(true);
  if (elapsedMs >= benchmarkBudgetMs && isAdvisory) {
    console.warn(
      `[benchmark] Presupuesto de tiempo superado en modo advisory: ${Math.round(elapsedMs)} ms frente a ${benchmarkBudgetMs} ms (+${Math.round(elapsedMs - benchmarkBudgetMs)} ms).`,
    );
  } else {
    expect(elapsedMs).toBeLessThan(benchmarkBudgetMs);
  }

  const filesBytes = [...result.files.values()].reduce(
    (total, value) =>
      total + (typeof value === "string" ? Buffer.byteLength(value, "utf8") : value.byteLength),
    0,
  );
  if (filesBytes >= benchmarkFilesBudgetBytes && isAdvisory) {
    console.warn(
      `[benchmark] Presupuesto de bytes superado en modo advisory: ${filesBytes} B frente a ${benchmarkFilesBudgetBytes} B (+${filesBytes - benchmarkFilesBudgetBytes} B).`,
    );
  } else {
    expect(filesBytes).toBeLessThan(benchmarkFilesBudgetBytes);
  }
  console.log({
    products: project.products.length,
    activeProductPages: productPages,
    files: result.files.size,
    filesBytes,
    elapsedMs: Math.round(elapsedMs),
  });
});
