import type { ImageAsset } from "@solara/project-schema";
import { referenceStore } from "@solara/project-schema/fixture";
import { expect, it } from "vitest";
import { createProjectArchiveBytes, readProjectArchive } from "./projectArchive";

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
