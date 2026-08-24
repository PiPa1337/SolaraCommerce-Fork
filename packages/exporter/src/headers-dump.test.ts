import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { describe, it } from "vitest";
import { exportProject } from "./index";

describe("headers dump", () => {
  it("dumps headers", () => {
    const result = exportProject(catalogModernStore, { mode: "production" });
    console.log(result.files.get("_headers"));
  });
});
