import { readFileSync, writeFileSync } from "node:fs";

const path = "tests/e2e/editor-persistence.spec.ts";
let content = readFileSync(path, "utf8");
const marker = "Crear tienda desde plantilla";
const idx = content.indexOf(marker);
if (idx === -1) throw new Error("marker not found");
const start = content.indexOf("  await expect(", idx);
const endMarker = "30_000";
const end = content.indexOf(endMarker, start) + endMarker.length + 3;
const replacement =
  '  await expect(page.getByRole("navigation", { name: /Areas de la tienda/ })).toBeVisible({ timeout: 30_000 });\n';
content = content.slice(0, start) + replacement + content.slice(end);
writeFileSync(path, content);
console.log("patched navigation regex");
