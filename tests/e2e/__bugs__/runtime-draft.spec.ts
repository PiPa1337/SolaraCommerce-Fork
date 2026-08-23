import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

test("draft: runtime marcado como debuggeable", () => {
  const result = exportProject(catalogModernV2Store, { mode: "draft" });
  const js = String(result.files.get("assets/storefront.js"));
  // El modo draft agrega una marca visible para identificar el bundle
  // debuggeable; el source map real queda pendiente (ver TECHNICAL_DEBT).
  expect(js).toContain("// DEBUG: modo draft");
});

test("production: runtime inline serializado sin sourcemap", () => {
  const result = exportProject(catalogModernV2Store, { mode: "production" });
  const js = String(result.files.get("assets/storefront.js"));
  expect(js).not.toContain("sourceMappingURL");
  expect(result.files.get("assets/storefront.js.map")).toBeUndefined();
});
