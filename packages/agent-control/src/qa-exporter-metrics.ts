/**
 * Metricas post-export para QA perpetuo: tamano, auditoria, lighthouse-lite.
 */
import { exportProject, runLighthouseLite } from "@solara/exporter";
import type { StoreProjectV1 } from "@solara/project-schema";

export interface ExportMetrics {
  storeId: string;
  mode: string;
  htmlFiles: number;
  totalBytes: number;
  jsBytes: number;
  cssBytes: number;
  criticalAuditIssues: number;
  warningAuditIssues: number;
  lighthouseScore: number;
  lighthouseChecks: Array<{ name: string; passed: boolean; detail: string }>;
}

export function measureExport(
  project: StoreProjectV1,
  mode: "draft" | "production" = "draft",
): ExportMetrics {
  const result = exportProject(project, { mode });
  let totalBytes = 0;
  let jsBytes = 0;
  let cssBytes = 0;
  let htmlFiles = 0;
  let homeHtml = "";

  for (const [path, content] of result.files) {
    const bytes = typeof content === "string" ? Buffer.byteLength(content) : content.byteLength;
    totalBytes += bytes;
    if (path.endsWith(".html")) {
      htmlFiles++;
    }
    if (path.endsWith(".js")) {
      jsBytes += bytes;
    }
    if (path.endsWith(".css")) {
      cssBytes += bytes;
    }
    if (path === "index.html") {
      homeHtml = String(content);
    }
  }

  const criticalAuditIssues = result.audit.filter((i) => i.severity === "critical").length;
  const warningAuditIssues = result.audit.filter((i) => i.severity === "warning").length;
  const lh = runLighthouseLite(homeHtml || "<html></html>");

  return {
    storeId: project.id,
    mode,
    htmlFiles,
    totalBytes,
    jsBytes,
    cssBytes,
    criticalAuditIssues,
    warningAuditIssues,
    lighthouseScore: lh.score,
    lighthouseChecks: lh.checks,
  };
}
