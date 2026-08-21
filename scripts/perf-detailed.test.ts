import { performance } from "node:perf_hooks";
import { describe, it } from "vitest";
import { generatePerformanceFixture } from "../packages/core/src/index";
import { exportProject } from "../packages/exporter/src/index";
import { StoreProjectV1Schema } from "../packages/project-schema/src/index";

function measure(label: string, fn: () => any) {
  const s = performance.now();
  const r = fn();
  const e = performance.now();
  console.log(`${label}: ${(e - s).toFixed(2)}ms`);
  return r;
}
describe("perf detailed", () => {
  it("detailed 2000", () => {
    const n = 2000;
    const proj = generatePerformanceFixture(n);
    (proj as any).commerceTemplates.designFamily = "catalog-modern-v2";
    const parsed = StoreProjectV1Schema.parse(proj);
    measure(`parse ${n}`, () => StoreProjectV1Schema.parse(proj));
    const exp = measure(`export ${n}`, () => exportProject(parsed, { mode: "production" }));
    console.log(`files ${exp.files.size}`);
  }, 60000);
});
