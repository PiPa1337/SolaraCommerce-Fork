import { referenceStore } from "@solara/project-schema/fixture";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createProjectArchive,
  createProjectArchiveBytes,
  readProjectArchive,
} from "./projectArchive";

describe("archivo de proyecto .solara.json", () => {
  it("hace round-trip del proyecto sin compresión", () => {
    const archive = createProjectArchive(referenceStore);
    expect(archive.startsWith("{")).toBe(true);
    expect(readProjectArchive(archive)).toEqual(referenceStore);
  });

  it("la versión en bytes es idéntica a la de string y hace round-trip", () => {
    vi.setSystemTime(new Date("2026-09-02T12:00:00.000Z"));
    try {
      const bytes = createProjectArchiveBytes(referenceStore);
      const text = createProjectArchive(referenceStore);
      expect(new TextDecoder().decode(bytes)).toBe(text);
      expect(readProjectArchive(bytes)).toEqual(referenceStore);
    } finally {
      vi.useRealTimers();
    }
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

  afterEach(() => {
    vi.useRealTimers();
  });
});
