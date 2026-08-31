import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { describe, expect, it } from "vitest";
import { auditProject } from "./audit";
import { exportProject } from "./index";

const VALID_JPEG_DATA_URL = "data:image/jpeg;base64,/9j/2Q==";
const VALID_WEBP_DATA_URL = "data:image/webp;base64,UklGRgAAAABXRUJQ";

function makeResponsiveProject() {
  const project = structuredClone(catalogModernStore);
  return {
    ...project,
    assets: project.assets.map((a) => ({
      ...a,
      responsiveSources: [320, 480, 768].map((width) => ({ width, source: a.source })),
    })),
  };
}

describe("imagenes responsive", () => {
  it("publica sólo la máxima y la intermedia de una receta legacy", () => {
    const firstAsset = catalogModernStore.assets[0];
    if (!firstAsset) throw new Error("Fixture incompleto");
    const project = {
      ...catalogModernStore,
      assets: [
        {
          ...firstAsset,
          source: VALID_WEBP_DATA_URL,
          fallbackSource: VALID_JPEG_DATA_URL,
          width: 1800,
          height: 1200,
          hash: "responsive-contract",
          responsiveSources: [320, 480, 640, 768, 1024, 1280, 1600, 1800].map((width) => ({
            width,
            source: `data:image/webp;base64,${btoa(`RIFF${String(width).padStart(4, "\0")}WEBP`)}`,
          })),
        },
        ...catalogModernStore.assets.slice(1),
      ],
    };
    const result = exportProject(project, { mode: "draft" });
    const html = String(result.files.get("index.html"));
    const assetFiles = [...result.files.keys()].filter((path) =>
      path.includes("responsive-contract"),
    );

    expect(assetFiles).toContain("assets/responsive-contract.webp");
    expect(assetFiles).toContain("assets/responsive-contract-768.webp");
    expect(assetFiles).not.toContain("assets/responsive-contract-320.webp");
    expect(assetFiles).not.toContain("assets/responsive-contract-480.webp");
    expect(assetFiles).not.toContain("assets/responsive-contract-1024.webp");
    expect(assetFiles).not.toContain("assets/responsive-contract-1800.webp");
    expect(html).toContain('media="(max-width: 1023px)"');
  });

  it("emite picture con webp en production", () => {
    const result = exportProject(makeResponsiveProject(), { mode: "production" });
    const html = String(result.files.get("index.html"));
    expect(html).toContain("<picture>");
    expect(html).toContain("webp");
  });

  it("escribe archivos fisicos para variantes responsive", () => {
    const result = exportProject(makeResponsiveProject(), { mode: "production" });
    const assetFiles = [...result.files.keys()].filter((k) => k.startsWith("assets/"));
    expect(assetFiles.length).toBeGreaterThanOrEqual(1);
  });

  it("usa nombres semanticos cuando useSemanticNames esta activo", () => {
    const result = exportProject(makeResponsiveProject(), {
      mode: "production",
      useSemanticNames: true,
    });
    const assetPaths = [...result.files.keys()].filter((k) => k.startsWith("assets/"));
    const hasSemantic = assetPaths.some((k) => /\/[a-z]{4,}-/.test(k));
    expect(hasSemantic).toBe(true);
  });

  it("determinismo con semantic names", () => {
    const project = makeResponsiveProject();
    const a = exportProject(project, { mode: "production", useSemanticNames: true });
    const b = exportProject(project, { mode: "production", useSemanticNames: true });
    const keysA = [...a.files.keys()].sort();
    const keysB = [...b.files.keys()].sort();
    expect(keysA).toEqual(keysB);
  });

  it("auditoria emite image.responsive sin variantes", () => {
    const stripped = {
      ...catalogModernStore,
      assets: catalogModernStore.assets.map((a) => ({ ...a, responsiveSources: undefined })),
    };
    const issues = auditProject(stripped as typeof catalogModernStore);
    const responsive = issues.filter((i) => i.code === "image.responsive");
    expect(responsive.length).toBeGreaterThan(0);
  });
});
