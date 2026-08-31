import { execSync } from "node:child_process";
import { expect, test } from "vitest";

test("check:budgets debe pasar tras optimización apertura", () => {
  expect(() => execSync("node scripts/check-budgets.mjs", { stdio: "pipe" })).not.toThrow();
});
