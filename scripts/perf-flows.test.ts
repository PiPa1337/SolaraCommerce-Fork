import { performance } from "node:perf_hooks";
import { describe, it } from "vitest";
import {
  createProjectArchive,
  readProjectArchive,
} from "../apps/studio/src/lib/projectArchive";
import { generatePerformanceFixture } from "../packages/core/src/performance";
import { auditProject } from "../packages/exporter/src/audit";
import { exportProject, renderPreviewHtml } from "../packages/exporter/src/index";
import { catalogScaleStore } from "../packages/project-schema/src/scale-fixture";
import type { StoreProjectV1 } from "../packages/project-schema/src/index";
import { ensureCatalogModernV2Sections } from "../packages/project-schema/src/catalog-modern-template";
import { optimizeProject } from "../packages/site-optimizer/src/index";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.byteLength; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return Buffer.from(binary, "binary").toString("base64");
}

function serializeSiteFiles(files: ReadonlyMap<string, string | Uint8Array>): string {
  return JSON.stringify(
    [...files.entries()].map(([path, value]) =>
      typeof value === "string"
        ? { path, encoding: "utf8", data: value }
        : { path, encoding: "base64", data: bytesToBase64(value) },
    ),
  );
}

function measure(label: string, fn: () => unknown): unknown {
  const s = performance.now();
  const r = fn();
  const e = performance.now();
  console.log(`    ${label}: ${(e - s).toFixed(0)} ms`);
  return r;
}

async function measureAsync(label: string, fn: () => Promise<unknown>): Promise<unknown> {
  const s = performance.now();
  const r = await fn();
  const e = performance.now();
  console.log(`    ${label}: ${(e - s).toFixed(0)} ms`);
  return r;
}

function fmtBytes(n: number): string {
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function siteBytes(files: Map<string, string | Uint8Array>): number {
  return [...files.values()].reduce(
    (t, v) => t + (typeof v === "string" ? Buffer.byteLength(v, "utf8") : v.byteLength),
    0,
  );
}

async function profile(name: string, project: StoreProjectV1, withPreview = true) {
  console.log(`\n  === ${name} (${project.products.length} productos) ===`);

  const sizes = {
    jsonCompact: JSON.stringify(project).length,
    assets: project.assets.length,
    videos: project.videos.length,
  };
  console.log(
    `    tamaño JSON: ${fmtBytes(sizes.jsonCompact)} | assets: ${sizes.assets} | videos: ${sizes.videos}`,
  );

  // --- FLUJO APERTURA (por tienda) ---
  const archive = measure("apertura: createProjectArchive (Zod + stringify pretty)", () =>
    createProjectArchive(project),
  ) as string;
  console.log(`      -> archivo .solara.json: ${fmtBytes(archive.length)}`);

  const reparsed = measure(
    "apertura: readProjectArchive (JSON.parse + Zod safeParse)",
    () => readProjectArchive(archive),
  ) as StoreProjectV1;

  measure("apertura: ensureCatalogModernV2Sections", () =>
    ensureCatalogModernV2Sections(reparsed),
  );

  measure("apertura: Zod parse extra (saveProject a IndexedDB)", () =>
    readProjectArchive(archive),
  );

  // --- FLUJO GUARDADO ---
  const archive2 = measure("guardar: createProjectArchive (Zod + stringify pretty)", () =>
    createProjectArchive(project),
  ) as string;
  measure("guardar: round-trip verify (encode + JSON.parse + Zod)", () =>
    readProjectArchive(new TextEncoder().encode(archive2)),
  );
  const site = measure("guardar: exportProject production", () =>
    exportProject(project, { mode: "production" }),
  ) as { files: Map<string, string | Uint8Array> };
  console.log(`      -> sitio: ${site.files.size} archivos, ${fmtBytes(siteBytes(site.files))}`);
  measure("guardar: serializeSiteFiles (JSON + base64)", () => serializeSiteFiles(site.files));

  // --- FLUJO EXPORTACIÓN (etapas internas) ---
  measure("exportar: exportProject completo (repite parse+audit+optimize)", () =>
    exportProject(project, { mode: "production" }),
  );

  if (withPreview) {
    measure("preview: renderPreviewHtml 1 ruta (renderiza TODAS las páginas)", () =>
      renderPreviewHtml(project, "draft", "/"),
    );
  }
}

describe("perf flows", () => {
  it(
    "perfila apertura/guardado/exportación por escala",
    async () => {
      console.log("\n========== PERFIL POR FLUJO ==========");

      const scale50 = structuredClone(catalogScaleStore) as unknown as StoreProjectV1;
      await profile("catalogScaleStore", scale50);

      for (const n of [200, 1000, 2000]) {
        const project = generatePerformanceFixture(n);
        (project as unknown as { commerceTemplates: { designFamily: string } })
          .commerceTemplates.designFamily = "catalog-modern-v2";
        await profile(`fixture ${n}`, project, n <= 1000);
      }
    },
    600_000,
  );
});
