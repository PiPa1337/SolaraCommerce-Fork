import type { StoreProjectV1 } from "@solara/project-schema";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { catalogScaleStore } from "@solara/project-schema/scale-fixture";
import { describe, expect, it } from "vitest";
import { exportProject } from "./index";

function filesToSortedArray(
  files: ReadonlyMap<string, string | Uint8Array>,
): Array<[string, string]> {
  return [...files.entries()]
    .map(
      ([path, content]) =>
        [path, typeof content === "string" ? content : Buffer.from(content).toString("base64")] as [
          string,
          string,
        ],
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
function assertDeterministic(project: StoreProjectV1, mode: "draft" | "production" = "production") {
  const a = exportProject(project, { mode });
  const b = exportProject(project, { mode });
  const c = exportProject(JSON.parse(JSON.stringify(project)), { mode });
  const fa = filesToSortedArray(a.files);
  const fb = filesToSortedArray(b.files);
  const fc = filesToSortedArray(c.files);
  expect(fa).toEqual(fb);
  expect(fb).toEqual(fc);
  expect(JSON.stringify(fa)).toEqual(JSON.stringify(fb));
}
describe("determinismo de exportProject", () => {
  it("produce bytes idénticos para catalogModernStore (production)", () => {
    assertDeterministic(catalogModernStore, "production");
  });
  it("produce bytes idénticos para catalogModernStore (draft)", () => {
    assertDeterministic(catalogModernStore, "draft");
  });
  it("produce bytes idénticos para catalogScaleStore (production)", () => {
    assertDeterministic(catalogScaleStore, "production");
  });
  it("produce bytes idénticos tras exportaciones independientes", () => {
    assertDeterministic(catalogModernStore, "production");
    assertDeterministic(catalogScaleStore, "production");
  });
  it("mantiene determinismo con brandName con espacios y Unicode", () => {
    const p = JSON.parse(JSON.stringify(catalogModernStore)) as StoreProjectV1;
    p.identity.brandName = "Tëst   Ünicode  —  Espacios";
    p.identity.description = "Descripción con emojis 🚀 y acentos áéíóú";
    assertDeterministic(p, "production");
  });
  it("usa el año de project.updatedAt para el footer, no Date.now", () => {
    const p1 = JSON.parse(JSON.stringify(catalogModernStore)) as StoreProjectV1;
    const p2 = JSON.parse(JSON.stringify(catalogModernStore)) as StoreProjectV1;
    p1.createdAt = "2023-01-15T12:00:00.000Z";
    p1.updatedAt = "2023-01-15T12:00:00.000Z";
    p2.createdAt = "2025-06-20T12:00:00.000Z";
    p2.updatedAt = "2025-06-20T12:00:00.000Z";
    const a = exportProject(p1, { mode: "production" });
    const b = exportProject(p2, { mode: "production" });
    const htmlA = [...a.files.entries()].find(([k]) => k === "index.html")?.[1] as string;
    const htmlB = [...b.files.entries()].find(([k]) => k === "index.html")?.[1] as string;
    expect(htmlA).toContain("© 2023");
    expect(htmlB).toContain("© 2025");
    expect(htmlA).not.toContain("© 2025");
    const c = exportProject(p1, { mode: "production" });
    const htmlC = [...c.files.entries()].find(([k]) => k === "index.html")?.[1] as string;
    expect(htmlA).toEqual(htmlC);
  });
  it("no depende de locale del sistema para hashes", async () => {
    const p = JSON.parse(JSON.stringify(catalogModernStore)) as StoreProjectV1;
    const a = exportProject(p, { mode: "production" });
    const b = exportProject(p, { mode: "production" });
    const sA = a.files.get("search-index.json") as string;
    const sB = b.files.get("search-index.json") as string;
    expect(sA).toEqual(sB);
  });
  it("ordena opciones de búsqueda determinísticamente", () => {
    const p = JSON.parse(JSON.stringify(catalogModernStore)) as StoreProjectV1;
    if (p.products[0]?.variants[0]) {
      const v = p.products[0].variants[0] as any;
      v.optionValues = { Talle: "M", Color: "Rojo" };
    }
    if (p.products[1]?.variants[0]) {
      const v = p.products[1].variants[0] as any;
      v.optionValues = { Color: "Azul", Talle: "L" };
    }
    const a = exportProject(p, { mode: "production" });
    const b = exportProject(JSON.parse(JSON.stringify(p)), { mode: "production" });
    expect(a.files.get("search-index.json")).toEqual(b.files.get("search-index.json"));
    const idx = JSON.parse(a.files.get("search-index.json") as string) as any[];
    for (const entry of idx) {
      const sorted = [...entry.options].sort();
      expect(entry.options).toEqual(sorted);
    }
  });
  it("exports concurrentes son determinísticos", async () => {
    const clones = Array.from(
      { length: 8 },
      () => JSON.parse(JSON.stringify(catalogModernStore)) as StoreProjectV1,
    );
    const results = await Promise.all(
      clones.map((p) => Promise.resolve(exportProject(p, { mode: "production" }))),
    );
    const first = filesToSortedArray(results[0].files);
    for (let i = 1; i < results.length; i++) {
      expect(filesToSortedArray(results[i].files)).toEqual(first);
    }
  });
  it("writes deterministically to paths with spaces y Unicode (Windows)", async () => {
    const { mkdtemp, rm, mkdir, writeFile, readFile, readdir } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const baseA = await mkdtemp(join(tmpdir(), "solara-determinismo-"));
    const baseB = await mkdtemp(join(tmpdir(), "solara determinismo con espacios y Unicode 🚀-"));
    try {
      const project = catalogModernStore;
      const expA = exportProject(project, { mode: "production" });
      const expB = exportProject(JSON.parse(JSON.stringify(project)), { mode: "production" });
      async function writeAll(base: string, files: ReadonlyMap<string, string | Uint8Array>) {
        for (const [rel, content] of [...files.entries()].sort(([a], [b]) =>
          a < b ? -1 : a > b ? 1 : 0,
        )) {
          const parts = rel.split("/");
          const dir = join(base, ...parts.slice(0, -1));
          await mkdir(dir, { recursive: true });
          const full = join(base, rel);
          if (typeof content === "string") await writeFile(full, content, "utf8");
          else await writeFile(full, content);
        }
      }
      await writeAll(baseA, expA.files);
      await writeAll(baseB, expB.files);
      async function collect(base: string): Promise<Array<[string, string]>> {
        const out: Array<[string, string]> = [];
        async function walk(dir: string, prefix: string) {
          const entries = await readdir(dir, { withFileTypes: true });
          const sorted = entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
          for (const e of sorted) {
            const full = join(dir, e.name);
            const rel = prefix ? `${prefix}/${e.name}` : e.name;
            if (e.isDirectory()) await walk(full, rel);
            else {
              const buf = await readFile(full);
              let txt: string;
              try {
                txt = buf.toString("utf8");
              } catch {
                txt = buf.toString("base64");
              }
              out.push([rel, txt]);
            }
          }
        }
        await walk(base, "");
        return out.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      }
      const listA = await collect(baseA);
      const listB = await collect(baseB);
      expect(listA.map(([k]) => k)).toEqual(listB.map(([k]) => k));
      for (let i = 0; i < listA.length; i++) {
        expect(listA[i][1]).toEqual(listB[i][1]);
      }
    } finally {
      await rm(baseA, { recursive: true, force: true }).catch(() => {});
      await rm(baseB, { recursive: true, force: true }).catch(() => {});
    }
  });
});
