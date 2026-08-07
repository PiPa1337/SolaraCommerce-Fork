/** Panel de exportación que distingue draft/production y muestra bloqueos accionables. */
import {
  DownloadSimple,
  FileArchive,
  ShieldCheck,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import type { OptimizationReport } from "@solara/exporter";
import type { StoreProjectV1 } from "@solara/project-schema";
import { useEffect, useRef, useState } from "react";
import { Button, InlineError, SectionHeader } from "../components/Ui";
import { downloadBlob } from "../lib/projectArchive";
import {
  createProjectArchiveInWorker,
  exportSiteInWorker,
  readProjectArchiveInWorker,
} from "../lib/workers";

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
  const [notice, setNotice] = useState("");
  const [critical, setCritical] = useState(0);
  const [publicAiContext, setPublicAiContext] = useState(true);
  const [optimization, setOptimization] = useState<OptimizationReport | null>(null);

  useEffect(() => {
    let active = true;
    void import("@solara/exporter")
      .then(({ auditReport, buildOptimizationReport }) => {
        if (active) {
          setCritical(auditReport(project).criticalCount);
          setOptimization(
            buildOptimizationReport(project, { mode: "production", publicAiContext }),
          );
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [project, publicAiContext]);

  const exportSite = async (mode: "draft" | "production") => {
    setBusy(mode);
    setError("");
    setNotice("");
    try {
      const result = await exportSiteInWorker(project, mode, {
        publicAiContext,
        optimizationProfile: "safe",
      });
      setOptimization(result.optimization);
      setNotice(
        "Exportación correcta. El sitio público se guarda en proyectos/<tienda>/sitios/ al guardar con el lanzador; podés abrirlo desde el dashboard.",
      );
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
        `${project.slug}.solara.json`,
        "application/vnd.solara.project+json",
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
      {notice ? <output className="export-notice">{notice}</output> : null}
      <label className="export-ai-context">
        <input
          type="checkbox"
          checked={publicAiContext}
          onChange={(event) => setPublicAiContext(event.target.checked)}
        />
        Publicar contexto público para agentes (`llms.txt` y `ai-context.json`)
      </label>
      {optimization ? (
        <output className="optimization-export-summary">
          <strong>Salud de exportación: {optimization.score}/100</strong>
          <span>{optimization.counts.critical} críticos</span>
          <span>{optimization.counts.warnings} advertencias</span>
          <span>{optimization.counts.indexable} rutas indexables</span>
        </output>
      ) : null}
      <div className="export-options">
        <article>
          <FileArchive aria-hidden size={25} />
          <div>
            <h3>Respaldo de proyecto</h3>
            <p>Conserva catálogo, diseño, SEO, configuración y recursos del proyecto.</p>
          </div>
          <div className="export-actions">
            <Button icon={DownloadSimple} onClick={() => void backup()} disabled={Boolean(busy)}>
              Descargar .solara.json
            </Button>
            <input
              ref={importRef}
              className="visually-hidden"
              type="file"
              accept=".json,.solara.json,application/json"
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
