import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import { createProjectArchive, readProjectArchive } from "./projectArchive";

describe("archivo de proyecto .solara.json", () => {
  it("hace round-trip del proyecto sin compresión", () => {
    const archive = createProjectArchive(referenceStore);
    expect(archive.startsWith("{")).toBe(true);
    expect(readProjectArchive(archive)).toEqual(referenceStore);
  });

  it("rechaza JSON corrupto", () => {
    expect(() => readProjectArchive(new Uint8Array([1, 2, 3]))).toThrow(/corrupto|JSON/);
  });

  it("rechaza respaldos de otro formato", () => {
    const manifest = JSON.stringify({
      format: "otro-formato",
      version: 1,
      project: referenceStore,
    });
    expect(() => readProjectArchive(manifest)).toThrow(/no es compatible/);
  });

  it("rechaza proyectos que no cumplen el schema", () => {
    const invalidProject = JSON.stringify({
      format: "solara-project",
      version: 2,
      projectId: "x",
      exportedAt: "2026-08-07T00:00:00.000Z",
      project: { schemaVersion: 2, id: "x" },
    });
    expect(() => readProjectArchive(invalidProject)).toThrow(/no es compatible/);
  });
});
