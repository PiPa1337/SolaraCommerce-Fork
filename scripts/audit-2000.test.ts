import { test } from "vitest";
import { generatePerformanceFixture } from "../packages/core/src/index";
import { exportProject } from "../packages/exporter/src/index";

test("audit 2000 desglose", () => {
  const project = generatePerformanceFixture(2000);
  project.commerceTemplates.designFamily = "catalog-modern-v2";
  const result = exportProject(project, { mode: "production" });
  const files = [...result.files.entries()].map(
    ([p, v]) =>
      [
        p,
        typeof v === "string" ? Buffer.byteLength(v, "utf8") : (v as Uint8Array).byteLength,
      ] as const,
  );
  let total = 0;
  for (const [, b] of files) total += b;
  console.log("total", total);
  const byCat: Record<string, { count: number; bytes: number; files: [string, number][] }> = {};
  function cat(p: string) {
    if (p.startsWith("productos/")) return "productos";
    if (p === "index.html") return "index";
    if (p === "search-index.json") return "search";
    if (p.includes("sitemap")) return "sitemap";
    if (p === "google-merchant.xml") return "merchant";
    if (p.startsWith("categorias/")) return "categorias";
    if (p.startsWith("assets/")) return "assets";
    if (p.endsWith(".html")) return "otros html";
    return "otros";
  }
  for (const [p, b] of files) {
    const c = cat(p);
    if (!byCat[c]) byCat[c] = { count: 0, bytes: 0, files: [] };
    byCat[c].count++;
    byCat[c].bytes += b;
    byCat[c].files.push([p, b]);
  }
  for (const [c, info] of Object.entries(byCat).sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(
      c,
      info.count,
      info.bytes,
      ((info.bytes / total) * 100).toFixed(1) + "%",
      "avg",
      Math.round(info.bytes / info.count),
    );
    const top = info.files.sort((a, b) => b[1] - a[1]).slice(0, 2);
    for (const [p, b] of top) console.log("  top", p, b);
  }
  console.log("productos avg", Math.round(byCat["productos"].bytes / byCat["productos"].count));
});
