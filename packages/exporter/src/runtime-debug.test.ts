import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { describe, expect, it } from "vitest";
import { exportProject } from "./index";

function runtimeJs(files: ReadonlyMap<string, string | Uint8Array>): string {
  const path = [...files.keys()].find((candidate) =>
    /^assets\/storefront\.[a-f0-9]+\.js$/i.test(candidate),
  );
  if (!path) throw new Error("runtime JS ausente");
  return String(files.get(path));
}

describe("runtime debuggeable", () => {
  it("draft: incluye comentario de debug", () => {
    const result = exportProject(catalogModernV2Store, { mode: "draft" });
    const js = runtimeJs(result.files);
    expect(js).toContain("// DEBUG: modo draft");
  });

  it("production: sin comentario de debug", () => {
    const result = exportProject(catalogModernV2Store, { mode: "production" });
    const js = runtimeJs(result.files);
    expect(js).not.toContain("// DEBUG: modo draft");
  });
});
