/** Valida archive/export fuera de React y conserva paridad con el exporter. */
import type { AuditIssue } from "@solara/exporter";
import { exportProject, type OptimizationReport } from "@solara/exporter";
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
      type: "project-write";
      project: StoreProjectV1;
    }
  | {
      id: string;
      type: "project-read";
      buffer: ArrayBuffer;
    };

function transferableBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

self.onmessage = (event: MessageEvent<ExportRequest>) => {
  try {
    const request = event.data;
    if (request.type === "site") {
      const result = exportProject(
        { ...request.project },
        { mode: request.mode, ...request.options },
      );
      const zip = transferableBytes(result.zip);
      const optimization: OptimizationReport = result.optimization;
      const audit: AuditIssue[] = result.audit;
      self.postMessage({ id: request.id, ok: true, result: { zip, audit, optimization } }, [
        zip.buffer,
      ]);
      return;
    }

    if (request.type === "project-write") {
      const archive = transferableBytes(createProjectArchive(request.project));
      self.postMessage({ id: request.id, ok: true, result: archive }, [archive.buffer]);
      return;
    }

    const project = readProjectArchive(new Uint8Array(request.buffer));
    self.postMessage({ id: request.id, ok: true, result: project });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo procesar el archivo ZIP.",
    });
  }
};
