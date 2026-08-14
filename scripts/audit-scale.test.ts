import { expect, test } from "vitest";
import { generatePerformanceFixture } from "../packages/core/src/index";
import { auditProject } from "../packages/exporter/src/index";

test("O4: el audit del catálogo grande no paga O(n^2) y no genera falsos mismatch", () => {
  const project = generatePerformanceFixture(2_000);
  const started = performance.now();
  const issues = auditProject(project);
  const elapsedMs = performance.now() - started;
  expect(issues.some((issue) => issue.code === "merchant.snapshot-mismatch")).toBe(false);
  expect(elapsedMs).toBeLessThan(500);
});
