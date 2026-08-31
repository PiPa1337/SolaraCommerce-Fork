import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("autosave no debe schedulear cuando document.hidden true", () => {
  const src = readFileSync("apps/studio/src/lib/autosave.ts", "utf8");
  expect(src).toContain("document.hidden");
});

test("Studio poll debe respetar document.hidden", () => {
  const src = readFileSync("apps/studio/src/features/Studio.tsx", "utf8");
  expect(src).toContain("document.hidden");
});

test("main SW update debe respetar document.hidden", () => {
  const src = readFileSync("apps/studio/src/main.tsx", "utf8");
  expect(src).toContain("document.hidden");
});
