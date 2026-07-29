import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import { createProjectArchive, readProjectArchive } from "./projectArchive";

describe("archivo de proyecto", () => {
  it("conserva el proyecto en un ciclo de exportación e importación", () => {
    const archive = createProjectArchive(referenceStore);
    expect(readProjectArchive(archive)).toEqual(referenceStore);
  });

  it("rechaza archivos que no tienen el formato Solara", () => {
    expect(() => readProjectArchive(new Uint8Array([1, 2, 3]))).toThrow();
  });
});
