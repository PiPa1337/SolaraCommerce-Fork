import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  auditReport,
  buildOptimizationReport,
  exportProject,
  renderPreviewHtml,
} from "../packages/exporter/src/index";
import { referenceStore } from "../packages/project-schema/src/fixture";

const reportDirectory = "test-results/export-doctor";

function byteLength(value: string | Uint8Array | undefined): number {
  if (value === undefined) return 0;
  return typeof value === "string" ? Buffer.byteLength(value, "utf8") : value.byteLength;
}

function canonicalPathForFile(path: string): string | null {
  if (!path.endsWith(".html")) return null;
  if (path === "index.html") return "/";
  if (path === "404.html") return "/404";
  if (!path.endsWith("/index.html")) return null;
  return `/${path.slice(0, -"index.html".length)}`;
}

function normalizeBodyForParity(html: string): string | null {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  if (!body) return null;
  return body[1]
    .replace(/data:[^"')\s]+/g, "#DATA")
    .replace(/\/assets\/[^"')\s]+/g, "/assets/#")
    .replace(/\/fixtures\/[^"')\s]+/g, "/fixtures/#")
    .replace(/data-solara-preview-(?:src|srcset|poster)="[^"]*"/g, "")
    .replace(/<script type="application\/json" id="solara-preview-assets">[\s\S]*?<\/script>/g, "")
    .replace(/<script[^>]*>[\s\S]*?solara-preview[\s\S]*?<\/script>/g, "")
    .replace(/src="#DATA"/g, 'src="#ASSET"')
    .replace(/src="\/assets\/#"/g, 'src="#ASSET"')
    .replace(/href="#DATA"/g, 'href="#ASSET"')
    .replace(/href="\/assets\/#"/g, 'href="#ASSET"')
    .replace(/\s+/g, " ")
    .trim();
}

function moduleTreeOf(html: string): string[] {
  return [...html.matchAll(/data-solara-module="([^"]+)"/g)].map((match) => match[1]);
}

function measurePhases() {
  const parseOptimizeStarted = performance.now();
  const optimization = buildOptimizationReport(referenceStore, {
    mode: "production",
    publicAiContext: true,
  });
  const parseOptimizeMs = performance.now() - parseOptimizeStarted;

  const auditStarted = performance.now();
  const auditReportResult = auditReport(referenceStore);
  const auditMs = performance.now() - auditStarted;
  const audit = auditReportResult.issues;

  const exportStarted = performance.now();
  const result = exportProject(referenceStore, { mode: "production", publicAiContext: true });
  const exportMs = performance.now() - exportStarted;

  const filesBytes = [...result.files.values()].reduce(
    (total, value) => total + byteLength(value),
    0,
  );
  const sizes = Object.fromEntries(
    [...result.files.entries()]
      .filter(([path]) => /\.(html|css|js|json|xml|txt)$/.test(path))
      .map(([path, value]) => [path, byteLength(value)]),
  );

  const auditBySeverity = audit.reduce<Record<string, { code: string; path?: string }[]>>(
    (acc, issue) => {
      const group = acc[issue.severity] ?? [];
      group.push({ code: issue.code, ...(issue.path ? { path: issue.path } : {}) });
      acc[issue.severity] = group;
      return acc;
    },
    {},
  );

  const routes: Record<string, { parity: string; bodyEqual: boolean | null }> = {};
  let previewRenderable = 0;
  let previewMatched = 0;
  for (const [filePath, content] of result.files) {
    const canonical = canonicalPathForFile(filePath);
    if (!canonical) continue;
    const exportedHtml = String(content);
    const previewHtml = renderPreviewHtml(referenceStore, "production", canonical, {
      assetTransport: "inline",
    });
    const exportedBody = normalizeBodyForParity(exportedHtml);
    const previewBody = normalizeBodyForParity(previewHtml);
    const notRenderable = previewHtml.includes("no se encontró") || !previewBody;
    const moduleParity =
      JSON.stringify(moduleTreeOf(exportedHtml)) === JSON.stringify(moduleTreeOf(previewHtml));
    if (notRenderable) {
      routes[filePath] = { parity: "not-renderable", bodyEqual: null };
      continue;
    }
    previewRenderable += 1;
    const bodyEqual = exportedBody === previewBody;
    if (moduleParity && bodyEqual) previewMatched += 1;
    routes[filePath] = { parity: moduleParity && bodyEqual ? "match" : "mismatch", bodyEqual };
  }

  return {
    fixture: "referenceStore",
    mode: "production",
    exportMs: Math.round(exportMs),
    phasesMs: {
      parseOptimize: Math.round(parseOptimizeMs),
      audit: Math.round(auditMs),
      buildFilesRender: Math.round(exportMs - parseOptimizeMs - auditMs),
    },
    files: result.files.size,
    filesBytes,
    sizes,
    auditBySeverity,
    optimizationScore: optimization.score,
    routes: Object.keys(routes).length,
    previewRenderable,
    previewMatched,
    parityByRoute: routes,
  };
}

test("export doctor: diagnostica el export del sitio de referencia", () => {
  mkdirSync(reportDirectory, { recursive: true });
  const report = { generatedAt: "fixed-by-test-output", ...measurePhases() };
  writeFileSync(`${reportDirectory}/doctor.json`, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  expect(report.files).toBeGreaterThan(0);
  expect(report.auditBySeverity.critical ?? []).toHaveLength(0);
  expect(report.previewRenderable).toBeGreaterThan(0);
});
