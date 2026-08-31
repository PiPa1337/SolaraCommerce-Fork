import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("manualChunks debe aislar fixtures/styles/font/runtime del entry", () => {
  const cfg = readFileSync("apps/studio/vite.config.ts", "utf8");
  expect(cfg).toContain("fixture-data");
  expect(cfg).toContain("modules-styles");
  expect(cfg).toContain("exporter-fonts");
});
