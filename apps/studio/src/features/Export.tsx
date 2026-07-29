import {
  DownloadSimple,
  FileArchive,
  ShieldCheck,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import { auditProject } from "@solara/exporter";
import type { StoreProjectV1 } from "@solara/project-schema";
import { useMemo, useRef, useState } from "react";
import { Button, InlineError, SectionHeader } from "../components/Ui";
import { downloadBlob } from "../lib/projectArchive";
import {
  createProjectArchiveInWorker,
  exportSiteInWorker,
  readProjectArchiveInWorker,
} from "../lib/workers";

function criticalCount(result: unknown): number {
  const issues = Array.isArray(result)
    ? result
    : typeof result === "object" && result !== null && "issues" in result
      ? (result as { issues: unknown }).issues
      : [];
  if (!Array.isArray(issues)) return 0;
  return issues.filter((issue) => {
    if (typeof issue !== "object" || issue === null) return false;
    const severity = (issue as Record<string, unknown>).severity;
    return severity === "error" || severity === "critical";
  }).length;
}

export function ExportPanel({
  project,
  onImport,
}: {
  project: StoreProjectV1;
  onImport(project: StoreProjectV1): Promise<void>;
}) {
  const importRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"draft" | "production" | "project" | "import" | "">("");
  const [error, setError] = useState("");
  const critical = useMemo(() => criticalCount(auditProject(project)), [project]);

  const exportSite = async (mode: "draft" | "production") => {
    setBusy(mode);
    setError("");
    try {
      const result = await exportSiteInWorker(project, mode);
      downloadBlob(result.zip, `${project.slug}-${mode}.zip`, "application/zip");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo exportar la tienda.");
    } finally {
      setBusy("");
    }
  };

  const backup = async () => {
    setBusy("project");
    setError("");
    try {
      downloadBlob(
        await createProjectArchiveInWorker(project),
        `${project.slug}.solara.zip`,
        "application/vnd.solara.project+zip",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear el respaldo.");
    } finally {
      setBusy("");
    }
  };

  const importArchive = async (file: File) => {
    setBusy("import");
    setError("");
    try {
      await onImport(await readProjectArchiveInWorker(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo importar el proyecto.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="workspace-section">
      <SectionHeader
        title="Exportar"
        description="El respaldo editable y el sitio público son archivos distintos."
      />
      {error ? <InlineError>{error}</InlineError> : null}
      <div className="export-options">
        <article>
          <FileArchive aria-hidden size={25} />
          <div>
            <h3>Respaldo de proyecto</h3>
            <p>Conserva catálogo, diseño, SEO, configuración y recursos del proyecto.</p>
          </div>
          <div className="export-actions">
            <Button icon={DownloadSimple} onClick={() => void backup()} disabled={Boolean(busy)}>
              Descargar .solara.zip
            </Button>
            <input
              ref={importRef}
              className="visually-hidden"
              type="file"
              accept=".zip,.solara.zip,application/zip"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importArchive(file);
                event.target.value = "";
              }}
            />
            <Button
              icon={UploadSimple}
              onClick={() => importRef.current?.click()}
              disabled={Boolean(busy)}
            >
              Importar respaldo
            </Button>
          </div>
        </article>

        <article>
          <WarningCircle aria-hidden size={25} />
          <div>
            <h3>Sitio borrador</h3>
            <p>Incluye noindex y excluye el feed de Merchant para revisión privada.</p>
          </div>
          <Button onClick={() => void exportSite("draft")} disabled={Boolean(busy)}>
            {busy === "draft" ? "Generando" : "Exportar borrador"}
          </Button>
        </article>

        <article>
          <ShieldCheck aria-hidden size={25} />
          <div>
            <h3>Sitio de producción</h3>
            <p>
              Genera HTML estático, sitemap, datos estructurados y feed desde el mismo proyecto.
            </p>
            {critical > 0 ? (
              <span className="export-warning">{critical} errores críticos deben resolverse.</span>
            ) : null}
          </div>
          <Button
            variant="primary"
            onClick={() => void exportSite("production")}
            disabled={Boolean(busy) || critical > 0}
          >
            {busy === "production" ? "Generando" : "Exportar producción"}
          </Button>
        </article>
      </div>
    </section>
  );
}
