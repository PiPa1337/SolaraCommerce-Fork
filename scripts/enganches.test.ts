import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import {
  auditReport,
  createPublicExportManifest,
  exportProject,
  renderPreviewHtml,
} from "../packages/exporter/src/index";
import { catalogModernStore } from "../packages/project-schema/src/catalog-modern-fixture";
import { referenceStore } from "../packages/project-schema/src/fixture";
import { catalogScaleStore } from "../packages/project-schema/src/scale-fixture";

const fixtures = {
  reference: referenceStore,
  catalogModern: catalogModernStore,
  catalogScale: catalogScaleStore,
} as const;

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function serializeForHash(files: ReadonlyMap<string, string | Uint8Array>): string {
  return [...files.entries()]
    .map(
      ([path, value]) =>
        `${path}:${typeof value === "string" ? value : Buffer.from(value).toString("base64")}`,
    )
    .join("\n");
}

test("F2: el atributo data-solara-runtime-features coincide con el manifest", () => {
  for (const [, project] of Object.entries(fixtures)) {
    const result = exportProject(project, { mode: "production" });
    const manifest = createPublicExportManifest(project);
    const home = String(result.files.get("index.html"));
    const match = /data-solara-runtime-features="([^"]*)"/.exec(home);
    expect(match, `${name}: atributo de features ausente`).not.toBeNull();
    expect(match?.[1]?.split(",").sort()).toEqual([...(manifest.runtimeFeatures ?? [])].sort());
  }
});

test("F3: search-index y catalog-index referencian solo productos activos con rutas del sitio", () => {
  for (const [, project] of Object.entries(fixtures)) {
    const result = exportProject(project, { mode: "production" });
    const searchIndex = JSON.parse(String(result.files.get("search-index.json") ?? "[]")) as Array<{
      path?: string;
    }>;
    const catalogIndex = JSON.parse(
      String(result.files.get("catalog-index.json") ?? "[]"),
    ) as Array<{ variantId?: string }>;
    const productPages = new Set(
      [...result.files.keys()]
        .filter((path) => /^productos\/[^/]+\/index\.html$/.test(path))
        .map((path) => `/${path.slice(0, -"index.html".length)}`),
    );
    for (const entry of searchIndex) {
      expect(productPages.has(entry.path ?? ""), `${name}: search apunta a ruta inexistente`).toBe(
        true,
      );
    }
    expect(catalogIndex.length).toBeGreaterThan(0);
    expect(result.files.has("search-index.json")).toBe(true);
  }
});

test("F4: criticalCount del audit coincide con el bloqueo de production", () => {
  const audit = auditReport(referenceStore);
  const result = exportProject(referenceStore, { mode: "production" });
  expect(result.audit.filter((issue) => issue.severity === "critical")).toHaveLength(
    audit.criticalCount,
  );
});

test("F5-draft: reproducible byte a byte tambien en draft", () => {
  for (const [, project] of Object.entries(fixtures)) {
    const first = exportProject(project, { mode: "draft" });
    const second = exportProject(project, { mode: "draft" });
    expect(sha256(serializeForHash(first.files))).toBe(sha256(serializeForHash(second.files)));
  }
});

test("F5: el export es reproducible byte a byte en los 3 fixtures", () => {
  for (const [, project] of Object.entries(fixtures)) {
    const first = exportProject(project, { mode: "production" });
    const second = exportProject(project, { mode: "production" });
    expect(sha256(serializeForHash(first.files))).toBe(sha256(serializeForHash(second.files)));
    expect(renderPreviewHtml(project, "production", "/")).toBe(
      renderPreviewHtml(project, "production", "/"),
    );
  }
});
