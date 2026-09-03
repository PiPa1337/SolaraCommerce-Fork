import type { ImageAsset } from "@solara/project-schema";
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

  it("serializa y relee proyectos que superan el límite de cadena de V8", () => {
    const payload = "A".repeat(1_000_000);
    const source = `data:image/png;base64,${payload}`;
    const template: Omit<ImageAsset, "id" | "hash"> = {
      kind: "image",
      name: "oversize.png",
      alt: "",
      mimeType: "image/png",
      source,
      fallbackSource: source,
      responsiveSources: [
        { width: 480, source },
        { width: 1800, source },
      ],
      width: 1800,
      height: 1200,
    };
    const project = structuredClone(referenceStore);
    // 150 assets con 4 copias embebidas de 1 MiB supera los 536.870.888
    // caracteres con margen: JSON.stringify del documento entero fallaría aquí.
    project.assets = [
      ...project.assets,
      ...Array.from({ length: 150 }, (_, index) => ({
        ...template,
        id: `asset-oversize-${index}`,
        hash: `oversize-${index}`,
      })),
    ];
    const bytes = createProjectArchiveBytes(project);
    expect(bytes.byteLength).toBeGreaterThan(536_870_888);
    const restored = readProjectArchive(bytes);
    expect(restored.id).toBe(project.id);
    expect(restored.assets).toHaveLength(project.assets.length);
  }, 600_000);

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
