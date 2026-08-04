import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { expect, test } from "vitest";
import { exportProject } from "../packages/exporter/src/index";
import { catalogModernStore } from "../packages/project-schema/src/catalog-modern-fixture";
import { referenceStore } from "../packages/project-schema/src/fixture";
import { catalogScaleStore } from "../packages/project-schema/src/scale-fixture";

const reportDirectory = "test-results/optimization-baseline";

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function byteLength(value: string | Uint8Array | undefined): number {
  if (value === undefined) return 0;
  return typeof value === "string" ? Buffer.byteLength(value, "utf8") : value.byteLength;
}

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function measure(project: typeof referenceStore) {
  const startedAt = performance.now();
  const result = exportProject(project, { mode: "production", publicAiContext: true });
  const elapsedMs = performance.now() - startedAt;
  const html = [...result.files.entries()]
    .filter(([path]) => path.endsWith(".html"))
    .map(([, value]) => String(value))
    .join("\n");
  const css = String(result.files.get("assets/storefront.css") ?? "");
  const javascript = String(result.files.get("assets/storefront.js") ?? "");
  const context = JSON.parse(String(result.files.get("ai-context.json") ?? "{}")) as {
    products?: unknown[];
  };
  return {
    files: result.files.size,
    zipBytes: result.zip.byteLength,
    zipSha256: sha256(result.zip),
    exportMs: Math.round(elapsedMs),
    htmlBytes: Buffer.byteLength(html, "utf8"),
    htmlGzipBytes: gzipSync(html).byteLength,
    cssBytes: Buffer.byteLength(css, "utf8"),
    cssGzipBytes: gzipSync(css).byteLength,
    javascriptBytes: Buffer.byteLength(javascript, "utf8"),
    javascriptGzipBytes: gzipSync(javascript).byteLength,
    htmlNodes: countMatches(html, /<\/?[a-z][^>]*>/gi),
    eagerImages: countMatches(html, /loading="eager"/g),
    lazyImages: countMatches(html, /loading="lazy"/g),
    requests: result.files.size,
    indexableUrls: countMatches(String(result.files.get("sitemap.xml") ?? ""), /<loc>/g),
    merchantOffers: countMatches(String(result.files.get("google-merchant.xml") ?? ""), /<item>/g),
    aiProducts: Array.isArray(context.products) ? context.products.length : 0,
    publicFiles: [...result.files.keys()].sort(),
    sizes: Object.fromEntries(
      [...result.files.entries()]
        .filter(([path]) => /\.(html|css|js|json|xml|txt)$/.test(path))
        .map(([path, value]) => [path, byteLength(value)]),
    ),
  };
}

test("genera un baseline reproducible del storefront público", () => {
  mkdirSync(reportDirectory, { recursive: true });
  const report = {
    generatedAt: "fixed-by-test-output",
    fixtures: {
      reference: measure(referenceStore),
      catalogModern: measure(catalogModernStore),
      catalogScale: measure(catalogScaleStore),
    },
  };
  writeFileSync(`${reportDirectory}/baseline.json`, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  expect(report.fixtures.catalogModern.aiProducts).toBe(50);
  expect(report.fixtures.catalogScale.aiProducts).toBe(50);
  expect(report.fixtures.catalogScale.merchantOffers).toBeGreaterThan(50);
  expect(report.fixtures.catalogScale.indexableUrls).toBeGreaterThan(60);
  expect(report.fixtures.catalogModern.javascriptGzipBytes).toBeLessThanOrEqual(35 * 1024);
  expect(report.fixtures.catalogModern.publicFiles).not.toContain("assets/storefront.css.map");
});
