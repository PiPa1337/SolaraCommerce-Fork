import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

test("draft: runtime marcado como debuggeable", () => {
  const result = exportProject(catalogModernV2Store, { mode: "draft" });
  const js = String(result.files.get("assets/storefront.js"));
  const map = result.files.get("assets/storefront.js.map");
  // El mapa se emite siempre en draft (placeholder {} si build-runtime.mjs
  // no corrió); con él, DevTools resuelve breakpoints contra el fuente.
  expect(map).toBeDefined();
  expect(js).toContain("// DEBUG: modo draft");
  expect(js).toContain("//# sourceMappingURL=storefront.js.map");
});

test("production: runtime inline serializado sin sourcemap", () => {
  const result = exportProject(catalogModernV2Store, { mode: "production" });
  const js = String(result.files.get("assets/storefront.js"));
  expect(js).not.toContain("sourceMappingURL");
  expect(result.files.get("assets/storefront.js.map")).toBeUndefined();
});
