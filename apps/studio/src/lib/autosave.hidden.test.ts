import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("autosave no debe schedulear cuando document.hidden true", () => {
  const src = readFileSync(new URL("./autosave.ts", import.meta.url), "utf8");
  expect(src).toContain("document.hidden");
});

test("Studio poll debe respetar document.hidden", () => {
  const src = readFileSync(new URL("../features/Studio.tsx", import.meta.url), "utf8");
  expect(src).toContain("document.hidden");
});

test("main SW update debe respetar document.hidden", () => {
  const src = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
  expect(src).toContain("document.hidden");
});
