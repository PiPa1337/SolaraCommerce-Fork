/** Panel de exportación que distingue draft/production y muestra bloqueos accionables. */
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  Circle,
  DownloadSimple,
  FileArchive,
  ShieldCheck,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import type { OptimizationReport } from "@solara/exporter";
import type { StoreProjectV1 } from "@solara/project-schema";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button, InlineError, SectionHeader } from "../components/Ui";
import {
  clearExportHistory,
  type ExportHistoryEntry,
  readExportHistory,
  recordExport,
} from "../lib/exportHistory";
import { formatDate } from "../lib/format";
import { downloadBlob } from "../lib/projectArchive";
import {
  auditProjectInWorker,
  createProjectArchiveInWorker,
  exportSiteInWorker,
  readProjectArchiveInWorker,
} from "../lib/workers";

const EXPORT_STAGES = [
  { id: "validate", label: "Validando proyecto" },
  { id: "render", label: "Renderizando páginas" },
  { id: "package", label: "Empaquetando archivos" },
] as const;

function ExportStages({ done }: { done: ReadonlySet<string> }) {
  return (
    <section
      className="guided-checklist"
      data-testid="ui-export-stages"
      aria-label="Etapas de exportación"
    >
      <div className="guided-checklist__header">
        <div>
          <span className="guided-kicker">Exportación</span>
          <h3>Etapas de generación</h3>
        </div>
        {done.size < EXPORT_STAGES.length ? (
          <span className="guided-checklist__more">
            El worker informa cada etapa a medida que la completa.
          </span>
        ) : null}
      </div>
      <ul>
        {EXPORT_STAGES.map((stage) => {
          const stageDone = done.has(stage.id);
          return (
            <li
              key={stage.id}
              data-testid="ui-export-stage"
              data-stage={stage.id}
              data-done={stageDone}
            >
              <span
                className="guided-checklist__status"
                style={stageDone ? { color: "var(--accent)" } : undefined}
                aria-hidden
              >
                {stageDone ? (
                  <CheckCircle size={18} weight="fill" />
                ) : (
                  <span className="spinner" aria-hidden />
                )}
              </span>
              <span className="guided-checklist__text">
                <strong>{stage.label}</strong>
                <small>{stageDone ? "Completado" : "En curso…"}</small>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ExportPanel({
  project,
  onImport,
  onOpenSite,
}: {
  project: StoreProjectV1;
  onImport(project: StoreProjectV1): Promise<void>;
  onOpenSite?(id: string): Promise<void>;
}) {
  const importRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"draft" | "production" | "project" | "import" | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [critical, setCritical] = useState(0);
  const [auditReady, setAuditReady] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [auditAttempt, setAuditAttempt] = useState(0);
  const [publicAiContext, setPublicAiContext] = useState(true);
  const [optimization, setOptimization] = useState<OptimizationReport | null>(null);
  const [exportDone, setExportDone] = useState(false);
  const [doneStages, setDoneStages] = useState<ReadonlySet<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<"production" | "import" | "">("");
  const [pendingImport, setPendingImport] = useState<File | null>(null);
  const [history, setHistory] = useState<ExportHistoryEntry[]>(() =>
    readExportHistory(project.slug),
  );
  const [postDone, setPostDone] = useState<Set<string>>(new Set());

  /* biome-ignore lint/correctness/useExhaustiveDependencies: auditAttempt es la clave de reintento de la auditoría tras un fallo. */
  useEffect(() => {
    let active = true;
    setAuditReady(false);
    setAuditError("");
    void auditProjectInWorker(project, publicAiContext)
      .then(({ criticalCount, optimization }) => {
        if (active) {
          setCritical(criticalCount);
          setOptimization(optimization);
          setAuditReady(true);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          const detail = reason instanceof Error ? reason.message : "";
          setAuditError(
            detail
              ? `No se pudo cargar la auditoría: ${detail}`
              : "No se pudo cargar la auditoría.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [project, publicAiContext, auditAttempt]);

  const recordHistory = (entry: Omit<ExportHistoryEntry, "at">) => {
    setHistory(recordExport(project.slug, entry.mode, entry));
  };

  const clearHistory = () => {
    setHistory([]);
    clearExportHistory(project.slug);
  };

  const exportSite = async (mode: "draft" | "production") => {
    setBusy(mode);
    setError("");
    setNotice("");
    setExportDone(false);
    setDoneStages(new Set());
    try {
      const result = await exportSiteInWorker(
        project,
        mode,
        {
          publicAiContext,
          optimizationProfile: "safe",
        },
        (stage) => {
          setDoneStages((current) => {
            if (current.has(stage)) return current;
            const next = new Set(current);
            next.add(stage);
            return next;
          });
        },
      );
      setOptimization(result.optimization);
      recordHistory({
        mode,
        score: result.optimization.score,
        critical: result.optimization.counts.critical,
      });
      setExportDone(true);
      setDoneStages(new Set(EXPORT_STAGES.map((stage) => stage.id)));
      setPostDone(new Set());
      setNotice(
        onOpenSite
          ? "Exportación correcta. El sitio público se guarda en proyectos/<tienda>/sitios/ al guardar con el lanzador; podés abrirlo desde el dashboard."
          : "Exportación correcta. En modo navegador el sitio generado no se conserva en disco; usá el lanzador de SolaraCommerce para guardarlo y abrirlo.",
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

  const togglePostItem = (id: string) => {
    setPostDone((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const navigateToSeo = () => {
    document.getElementById("studio-tab-seo")?.click();
  };

  const postItems = [
    {
      id: "site",
      title: "Abrir el sitio",
      detail: "Con el lanzador, el sitio queda en proyectos/<tienda>/sitios/ listo para publicar.",
      action: onOpenSite ? (
        <Button
          variant="quiet"
          size="sm"
          icon={ArrowUpRight}
          data-testid="ui-export-open-site"
          onClick={() => void onOpenSite(project.id)}
        >
          Abrir sitio
        </Button>
      ) : null,
    },
    {
      id: "seo",
      title: "Revisar SEO",
      detail: "Verificá el checklist de publicación y la vista del crawler antes de producir.",
      action: (
        <Button
          variant="quiet"
          size="sm"
          icon={ArrowRight}
          data-testid="ui-export-check-seo"
          onClick={navigateToSeo}
        >
          Ir a SEO
        </Button>
      ),
    },
    {
      id: "production",
      title: "Exportar producción",
      detail: "Cuando no queden errores críticos, generá el sitio final desde la opción de arriba.",
      action: null,
    },
  ];

  return (
    <section className="workspace-section">
      <SectionHeader
        title="Exportar"
        description="El respaldo editable y el sitio público son archivos distintos."
      />
      {error ? <InlineError>{error}</InlineError> : null}
      {busy ? (
        <output className="export-progress" aria-live="polite" data-testid="ui-export-progress">
          {busy === "draft"
            ? "Generando sitio borrador…"
            : busy === "production"
              ? "Generando sitio de producción…"
              : busy === "project"
                ? "Creando respaldo del proyecto…"
                : "Importando respaldo…"}
        </output>
      ) : null}
      {notice ? (
        <output className="export-notice" data-testid="ui-export-result">
          {notice}
        </output>
      ) : null}
      {auditError ? (
        <div
          data-testid="ui-audit-error"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "8px",
            margin: "0 0 12px",
          }}
        >
          <InlineError>{auditError}</InlineError>
          <Button
            variant="quiet"
            size="sm"
            data-testid="ui-audit-retry"
            onClick={() => setAuditAttempt((attempt) => attempt + 1)}
          >
            Reintentar auditoría
          </Button>
        </div>
      ) : null}
      {busy === "draft" || busy === "production" ? (
        <ExportStages done={doneStages} />
      ) : exportDone ? (
        <ExportStages done={doneStages} />
      ) : null}
      {exportDone ? (
        <section
          className="guided-checklist"
          data-testid="ui-export-checklist"
          aria-label="Después de exportar"
        >
          <div className="guided-checklist__header">
            <div>
              <span className="guided-kicker">Siguiente</span>
              <h3>Revisar la exportación</h3>
            </div>
            <span className="guided-checklist__more">Pasos opcionales</span>
          </div>
          <ul>
            {postItems.map((item) => {
              const done = postDone.has(item.id);
              return (
                <li
                  key={item.id}
                  data-testid="ui-export-check-item"
                  data-check-id={item.id}
                  data-done={done}
                >
                  <span
                    className="guided-checklist__status"
                    style={done ? { color: "var(--accent)" } : undefined}
                    aria-hidden
                  >
                    {done ? <CheckCircle size={18} weight="fill" /> : <Circle size={18} />}
                  </span>
                  <span className="guided-checklist__text">
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                  {item.action ?? (
                    <Button
                      variant="quiet"
                      size="sm"
                      icon={done ? CheckCircle : Circle}
                      aria-pressed={done}
                      data-testid="ui-export-check-toggle"
                      onClick={() => togglePostItem(item.id)}
                    >
                      {done ? "Listo" : "Marcar"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
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
          <span>{critical} críticos</span>
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
                if (file) {
                  setPendingImport(file);
                  setConfirmAction("import");
                }
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
          <Button
            data-testid="ui-export-draft"
            onClick={() => void exportSite("draft")}
            disabled={Boolean(busy)}
          >
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
            data-testid="ui-export-production"
            onClick={() => setConfirmAction("production")}
            disabled={Boolean(busy) || !auditReady || critical > 0}
          >
            {busy === "production" ? "Generando" : "Exportar producción"}
          </Button>
        </article>
      </div>

      {history.length > 0 ? (
        <div className="audit-panel" data-testid="ui-export-history">
          <header>
            <div>
              <h3>Historial de exportaciones</h3>
              <p>Intentos exitosos registrados en este navegador.</p>
            </div>
            <Button
              variant="quiet"
              size="sm"
              data-testid="ui-export-history-clear"
              onClick={clearHistory}
            >
              Borrar historial
            </Button>
          </header>
          <div className="audit-list">
            {history.map((entry, index) => (
              <article
                className="audit-item"
                data-testid="ui-export-history-item"
                data-mode={entry.mode}
                key={`${entry.at}-${index}`}
              >
                <CheckCircle aria-hidden size={18} />
                <div>
                  <strong>
                    {entry.mode === "production" ? "Producción" : "Borrador"} ·{" "}
                    {formatDate(entry.at)}
                  </strong>
                  <p>
                    Salud {entry.score}/100 · {entry.critical} críticos
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {confirmAction === "production" ? (
        <ConfirmDialog
          title="Exportar sitio de producción"
          confirmLabel="Exportar producción"
          body={
            <p>
              Se generará el HTML final con sitemap, datos estructurados y feed de Merchant. Revisá
              el preview y el checklist SEO antes de continuar.
            </p>
          }
          onConfirm={() => {
            setConfirmAction("");
            void exportSite("production");
          }}
          onCancel={() => setConfirmAction("")}
        />
      ) : null}
      {confirmAction === "import" ? (
        <ConfirmDialog
          title="Importar respaldo"
          danger
          confirmLabel="Importar y reemplazar"
          body={
            <p>
              El respaldo reemplazará el proyecto actual y los cambios sin guardar se perderán.
              ¿Continuar?
            </p>
          }
          onConfirm={() => {
            const file = pendingImport;
            setConfirmAction("");
            setPendingImport(null);
            if (file) void importArchive(file);
          }}
          onCancel={() => {
            setConfirmAction("");
            setPendingImport(null);
          }}
        />
      ) : null}
    </section>
  );
}
