import { referenceStore } from "@solara/project-schema/fixture";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createProjectArchive, readProjectArchive } from "./projectArchive";

describe("archivo de proyecto", () => {
  it("conserva el proyecto en un ciclo de exportación e importación", () => {
    const archive = createProjectArchive(referenceStore);
    expect(readProjectArchive(archive)).toEqual(referenceStore);
  });

  it("rechaza archivos que no tienen el formato Solara", () => {
    expect(() => readProjectArchive(new Uint8Array([1, 2, 3]))).toThrow(/corrupto|ZIP/);
  });

  it("explica manifest y proyecto incompatibles sin perder el respaldo", () => {
    const manifest = zipSync({
      "manifest.json": strToU8(JSON.stringify({ format: "other", version: 4 })),
      "project.json": strToU8("{}"),
    });
    expect(() => readProjectArchive(manifest)).toThrow(/no es compatible/);

    const invalidProject = zipSync({
      "manifest.json": strToU8(JSON.stringify({ format: "solara-project", version: 1 })),
      "project.json": strToU8(JSON.stringify({ ...referenceStore, baseUrl: "invalid" })),
    });
    expect(() => readProjectArchive(invalidProject)).toThrow(/no es compatible/);
  });
});
