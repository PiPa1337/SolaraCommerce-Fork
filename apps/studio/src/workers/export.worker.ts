/** Valida archive/export fuera de React y conserva paridad con el exporter. */
import type { AuditIssue } from "@solara/exporter";
import {
  auditReport,
  buildOptimizationReport,
  exportProject,
  type OptimizationReport,
} from "@solara/exporter";
import type { StoreProjectV1 } from "@solara/project-schema";
import { createProjectArchive, readProjectArchive } from "../lib/projectArchive";

type ExportRequest =
  | {
      id: string;
      type: "site";
      project: StoreProjectV1;
      mode: "draft" | "production";
      options: { publicAiContext?: boolean; optimizationProfile?: "safe" | "strict" };
    }
  | {
      id: string;
      type: "audit";
      project: StoreProjectV1;
      publicAiContext: boolean;
    }
  | {
      id: string;
      type: "project-write";
      project: StoreProjectV1;
    }
  | {
      id: string;
      type: "project-read";
      buffer: ArrayBuffer;
    };

self.onmessage = (event: MessageEvent<ExportRequest>) => {
  try {
    const request = event.data;
    if (request.type === "site") {
      const project = { ...request.project };
      const options = { mode: request.mode, ...request.options };
      auditReport(project);
      self.postMessage({ id: request.id, kind: "export-stage", stage: "validate" });
      const result = exportProject(project, options);
      self.postMessage({ id: request.id, kind: "export-stage", stage: "render" });
      self.postMessage({ id: request.id, kind: "export-stage", stage: "package" });
      const optimization: OptimizationReport = result.optimization;
      const audit: AuditIssue[] = result.audit;
      self.postMessage({
        id: request.id,
        ok: true,
        result: {
          files: result.files,
          audit,
          optimization,
          criticalCount: audit.filter((issue) => issue.severity === "critical").length,
        },
      });
      return;
    }

    if (request.type === "audit") {
      self.postMessage({
        id: request.id,
        ok: true,
        result: {
          criticalCount: auditReport(request.project).criticalCount,
          optimization: buildOptimizationReport(request.project, {
            mode: "production",
            publicAiContext: request.publicAiContext,
          }),
        },
      });
      return;
    }

    if (request.type === "project-write") {
      self.postMessage({ id: request.id, ok: true, result: createProjectArchive(request.project) });
      return;
    }

    const project = readProjectArchive(new TextDecoder().decode(new Uint8Array(request.buffer)));
    self.postMessage({ id: request.id, ok: true, result: project });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo procesar el respaldo del proyecto.",
    });
  }
};
