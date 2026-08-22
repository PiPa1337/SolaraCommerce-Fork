import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { describe, expect, it } from "vitest";
import { exportProject } from "./index";

describe("runtime debuggeable", () => {
  it("draft: incluye comentario de debug", () => {
    const result = exportProject(catalogModernV2Store, { mode: "draft" });
    const js = String(result.files.get("assets/storefront.js"));
    expect(js).toContain("// DEBUG: modo draft");
  });

  it("production: sin comentario de debug", () => {
    const result = exportProject(catalogModernV2Store, { mode: "production" });
    const js = String(result.files.get("assets/storefront.js"));
    expect(js).not.toContain("// DEBUG: modo draft");
  });
});
