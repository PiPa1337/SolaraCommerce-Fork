/** Valida archive/export fuera de React y conserva paridad con el exporter. */
import type { AuditIssue, OptimizationReport } from "@solara/exporter";
import type { StoreProjectV1 } from "@solara/project-schema";

type ExporterModule = typeof import("@solara/exporter");
type ProjectArchiveModule = typeof import("../lib/projectArchive");

let exporterModulePromise: Promise<ExporterModule> | undefined;
let projectArchiveModulePromise: Promise<ProjectArchiveModule> | undefined;

function loadExporter(): Promise<ExporterModule> {
  exporterModulePromise ??= import("@solara/exporter");
  return exporterModulePromise;
}

function loadProjectArchive(): Promise<ProjectArchiveModule> {
  projectArchiveModulePromise ??= import("../lib/projectArchive");
  return projectArchiveModulePromise;
}

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
      type: "preview";
      project?: StoreProjectV1;
      revision: number;
      route: string;
      options?: {
        assetTransport?: "inline" | "parent";
        editor?: { enabled: true; sectionId: string };
      };
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

let previewProject: StoreProjectV1 | undefined;
let previewRevision: number | undefined;
let previewAssetSources: Record<string, string> = {};

self.onmessage = async (event: MessageEvent<ExportRequest>) => {
  try {
    const request = event.data;
    if (request.type === "site") {
      const { auditReport, exportProject } = await loadExporter();
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
      const { auditReport, buildOptimizationReport } = await loadExporter();
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

    if (request.type === "preview") {
      const exporter = await loadExporter();
      const shouldSendAssetSources = request.project !== undefined;
      if (request.project && request.revision !== previewRevision) {
        previewProject = request.project;
        previewRevision = request.revision;
        previewAssetSources = Object.fromEntries(
          exporter.getPreviewAssetSources(request.project).entries(),
        );
      }
      if (!previewProject || request.revision !== previewRevision) {
        throw new Error("El worker de preview no tiene el snapshot de la revisión solicitada.");
      }
      const rendered = exporter.renderPreviewHtml(previewProject, "draft", request.route, {
        ...(request.options?.assetTransport
          ? { assetTransport: request.options.assetTransport }
          : {}),
        ...(request.options?.editor ? { editor: request.options.editor } : {}),
      });
      const html = typeof rendered === "string" ? rendered : rendered.html;
      const canvasManifest =
        typeof rendered === "string" ? { entries: [], coverage: [] } : rendered.canvasManifest;
      self.postMessage({
        id: request.id,
        ok: true,
        result: {
          html,
          canvasManifest,
          ...(shouldSendAssetSources ? { assetSources: previewAssetSources } : {}),
        },
      });
      return;
    }

    if (request.type === "project-write") {
      const { createProjectArchive } = await loadProjectArchive();
      self.postMessage({ id: request.id, ok: true, result: createProjectArchive(request.project) });
      return;
    }

    const { readProjectArchive } = await loadProjectArchive();
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
