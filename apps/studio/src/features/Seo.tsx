/** Auditoría previa a exportación para metadata, JSON-LD, sitemap, Merchant y contexto IA. */
import {
  ArrowClockwise,
  ArrowRight,
  CheckCircle,
  Circle,
  DownloadSimple,
  Info,
  MagnifyingGlass,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import type { AuditReport, OptimizationReport } from "@solara/exporter";
import type { StoreProjectV1 } from "@solara/project-schema";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../components/primitives";
import { Button, Field, SectionHeader } from "../components/Ui";
import { loadExporter } from "../lib/loadExporter";
import { downloadBlob } from "../lib/projectArchive";

interface AuditIssue {
  id: string;
  severity: "error" | "warning" | "info";
  title: string;
  message: string;
  area?: string;
  fixTarget?: string;
}

type SeoNavigationTarget = "overview" | "catalog" | "assets" | "seo" | "export";

function normalizeIssues(value: unknown): AuditIssue[] {
  const candidate = Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null && "issues" in value
      ? (value as { issues: unknown }).issues
      : [];
  if (!Array.isArray(candidate)) return [];
  return candidate.map((item, index) => {
    const record =
      typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
    const rawSeverity = record.severity ?? record.level ?? record.type;
    const severity =
      rawSeverity === "error" || rawSeverity === "critical"
        ? "error"
        : rawSeverity === "warning" || rawSeverity === "warn"
          ? "warning"
          : "info";
    return {
      id: String(record.id ?? record.code ?? index),
      severity,
      title: String(record.title ?? record.label ?? "Revisión SEO"),
      message: String(record.message ?? record.description ?? record.detail ?? ""),
      ...(typeof record.area === "string" ? { area: record.area } : {}),
      ...(typeof record.fixTarget === "string" ? { fixTarget: record.fixTarget } : {}),
    };
  });
}

/**
 * Destinos de corrección: valor de fixTarget → id de pestaña del Studio. El
 * destino `seo` no navega: el checklist vive en la pestaña SEO y los hallazgos
 * que se resuelven ahí se marcan como revisados en lugar de ofrecer «Ir a SEO».
 */
const FIX_TABS: Record<string, SeoNavigationTarget> = {
  summary: "overview",
  catalog: "catalog",
  assets: "assets",
  seo: "seo",
  export: "export",
};

const FIX_LABELS: Record<string, string> = {
  summary: "Resumen",
  catalog: "Catálogo",
  assets: "Recursos",
  seo: "SEO",
  export: "Exportar",
};

const AREA_LABELS: Record<string, string> = {
  technical: "Técnico",
  content: "Contenido",
  "structured-data": "Datos estructurados",
  merchant: "Merchant",
  performance: "Rendimiento",
  ai: "Contexto IA",
  general: "General",
};

/**
 * Resuelve el título y la descripción que el exporter renderiza en la ruta de
 * Home: la página editable manda, luego el seo global y por último la identidad.
 */
export function homepageSeoPreview(project: StoreProjectV1): {
  title: string;
  description: string;
} {
  const home = project.pages.find((page) => page.kind === "home");
  return {
    title: home?.seoTitle ?? (project.seo.title || project.identity.brandName),
    description: home?.seoDescription ?? (project.seo.description || project.identity.description),
  };
}

/** Navega a la pestaña que corrige el hallazgo usando los ids estables del shell. */
function navigateToFix(
  target: string,
  onNavigate: (destination: SeoNavigationTarget) => void,
): void {
  const tabId = FIX_TABS[target];
  if (!tabId) return;
  onNavigate(tabId);
  requestAnimationFrame(() => {
    document.getElementById(`studio-tab-${tabId}`)?.focus();
  });
}

export function Seo({
  project,
  onChange,
  onNavigate,
}: {
  project: StoreProjectV1;
  onChange(project: StoreProjectV1): void;
  onNavigate(destination: SeoNavigationTarget): void;
}) {
  const [report, setReport] = useState<AuditReport>({
    issues: [],
    criticalCount: 0,
    warningCount: 0,
    merchantMode: "experimental-whatsapp",
  });
  const [optimization, setOptimization] = useState<OptimizationReport | null>(null);
  const [checkedIssues, setCheckedIssues] = useState<Set<string>>(new Set());
  const [auditStatus, setAuditStatus] = useState<"loading" | "ready" | "error">("loading");
  const [auditError, setAuditError] = useState("");
  const [auditAttempt, setAuditAttempt] = useState(0);
  const runAudit = useCallback(
    async (isActive: () => boolean = () => true, retryAttempt = 0) => {
      setAuditStatus("loading");
      setAuditError("");
      setOptimization(null);
      try {
        const { auditReport, buildOptimizationReport } = await loadExporter(retryAttempt);
        if (!isActive()) return;
        setReport(auditReport(project));
        setOptimization(buildOptimizationReport(project, { mode: "draft", publicAiContext: true }));
        setAuditStatus("ready");
      } catch {
        if (!isActive()) return;
        setAuditStatus("error");
        setAuditError(
          "No se pudo completar la auditoría. Reintentá para volver a analizar la tienda.",
        );
      }
    },
    [project],
  );
  useEffect(() => {
    let active = true;
    void runAudit(() => active, auditAttempt);
    return () => {
      active = false;
    };
  }, [runAudit, auditAttempt]);
  const issues = normalizeIssues(report.issues);
  const groupedIssues = useMemo(() => {
    const groups = new Map<string, AuditIssue[]>();
    for (const issue of issues) {
      const area = issue.area && AREA_LABELS[issue.area] ? issue.area : "general";
      const bucket = groups.get(area) ?? [];
      bucket.push(issue);
      groups.set(area, bucket);
    }
    const priority = ["technical", "content", "structured-data", "merchant", "performance", "ai"];
    return [...groups.entries()].sort(
      ([left], [right]) =>
        (priority.indexOf(left) === -1 ? priority.length : priority.indexOf(left)) -
        (priority.indexOf(right) === -1 ? priority.length : priority.indexOf(right)),
    );
  }, [issues]);
  const checkedCount = issues.filter((issue) => checkedIssues.has(issue.id)).length;
  const commit = (seo: StoreProjectV1["seo"]) =>
    onChange({ ...project, seo, updatedAt: new Date().toISOString() });
  const errors = auditStatus === "ready" ? report.criticalCount : 0;
  const warnings = auditStatus === "ready" ? report.warningCount : 0;
  const socialAsset =
    project.assets.find((asset) => asset.id === project.seo.socialImageId) ?? project.assets[0];
  const homepage = `${project.baseUrl.replace(/\/+$/, "")}/`;
  const previewSeo = homepageSeoPreview(project);
  const routeLimit = 24;

  const toggleIssue = (id: string) => {
    setCheckedIssues((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const iconFor = (issue: AuditIssue) =>
    issue.severity === "error" ? XCircle : issue.severity === "warning" ? WarningCircle : Info;
  const issueContext = (issue: AuditIssue) =>
    issue.message ? `${issue.title}: ${issue.message}` : `${issue.title} (${issue.id})`;

  return (
    <section className="workspace-section">
      <SectionHeader
        title="SEO y Google"
        description="La auditoría compara el proyecto con el HTML, los datos estructurados y el feed."
        actions={
          <div className="seo-header-status" data-testid="ui-seo-audit-state" aria-live="polite">
            {auditStatus === "loading" ? (
              <Badge tone="neutral">Analizando SEO</Badge>
            ) : auditStatus === "error" ? (
              <Badge tone="danger">Auditoría pendiente</Badge>
            ) : (
              <>
                {optimization ? (
                  <output
                    className="seo-header-score"
                    aria-label={`Score SEO: ${optimization.score}/100`}
                  >
                    <Badge tone={errors > 0 ? "danger" : "success"}>
                      Score SEO: {optimization.score}/100
                    </Badge>
                  </output>
                ) : null}
                {errors > 0 ? (
                  <Badge tone="danger">{errors} críticos</Badge>
                ) : (
                  <Badge tone="success">Auditoría lista</Badge>
                )}
              </>
            )}
          </div>
        }
      />
      <div className="seo-grid">
        <fieldset className="seo-fieldset seo-fieldset--appearance">
          <legend>
            <MagnifyingGlass aria-hidden size={19} /> Apariencia
          </legend>
          <Field label="Título SEO" hint={`${project.seo.title.length}/70 caracteres`}>
            <input
              maxLength={70}
              value={project.seo.title}
              onChange={(event) => commit({ ...project.seo, title: event.target.value })}
            />
          </Field>
          <Field label="Descripción SEO" hint={`${project.seo.description.length}/180 caracteres`}>
            <textarea
              rows={4}
              maxLength={180}
              value={project.seo.description}
              onChange={(event) => commit({ ...project.seo, description: event.target.value })}
            />
          </Field>
          <Field label="Verificación de Search Console">
            <input
              value={project.seo.searchConsoleVerification}
              onChange={(event) =>
                commit({ ...project.seo, searchConsoleVerification: event.target.value })
              }
            />
          </Field>
          <Field label="Verificación de Merchant Center">
            <input
              value={project.seo.merchantVerification}
              onChange={(event) =>
                commit({ ...project.seo, merchantVerification: event.target.value })
              }
            />
          </Field>
        </fieldset>

        <fieldset className="seo-fieldset seo-fieldset--social">
          <legend>Imagen social</legend>
          <Field
            label="Recurso para compartir"
            hint="Se usa para Open Graph y compartir la tienda."
          >
            <select
              value={project.seo.socialImageId ?? ""}
              onChange={(event) =>
                commit({
                  ...project.seo,
                  socialImageId: event.target.value
                    ? (event.target.value as StoreProjectV1["assets"][number]["id"])
                    : undefined,
                })
              }
            >
              <option value="">Usar la primera imagen disponible</option>
              {project.assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </Field>
        </fieldset>

        <div className="audit-panel" data-testid="ui-seo-audit-panel">
          <header>
            <div>
              <h3>Auditoría</h3>
              <p>
                {auditStatus === "loading"
                  ? "Analizando metadata, rutas y datos estructurados…"
                  : auditStatus === "error"
                    ? auditError
                    : `${errors} errores críticos, ${warnings} advertencias.`}
              </p>
              {auditStatus === "ready" && report.merchantMode === "experimental-whatsapp" ? (
                <p className="audit-note">
                  Merchant en modo experimental: el checkout final por WhatsApp puede no cumplir los
                  requisitos de Google.
                </p>
              ) : null}
            </div>
            {auditStatus === "ready" && errors === 0 ? (
              <span className="audit-ready">
                <CheckCircle aria-hidden size={18} weight="fill" /> Lista para revisar
              </span>
            ) : null}
          </header>
          {auditStatus === "loading" ? (
            <output
              className="audit-state audit-state--loading"
              data-testid="ui-seo-audit-loading"
              aria-live="polite"
            >
              <span className="spinner" aria-hidden />
              <p>Ejecutando la auditoría local…</p>
            </output>
          ) : auditStatus === "error" ? (
            <div
              className="audit-state audit-state--error"
              data-testid="ui-seo-audit-error"
              role="alert"
            >
              <WarningCircle aria-hidden size={22} />
              <p>{auditError}</p>
              <Button
                variant="quiet"
                size="sm"
                icon={ArrowClockwise}
                onClick={() => setAuditAttempt((attempt) => attempt + 1)}
              >
                Reintentar
              </Button>
            </div>
          ) : issues.length === 0 ? (
            <div className="audit-empty">
              <CheckCircle aria-hidden size={26} />
              <p>No se detectaron problemas con el proyecto actual.</p>
            </div>
          ) : (
            <div className="audit-list">
              {issues.map((issue) => {
                const Icon = iconFor(issue);
                return (
                  <article className={`audit-item audit-item--${issue.severity}`} key={issue.id}>
                    <Icon
                      aria-hidden
                      size={19}
                      weight={issue.severity === "info" ? "regular" : "fill"}
                    />
                    <div>
                      <strong title={issue.title}>{issue.title}</strong>
                      {issue.message ? <p>{issue.message}</p> : null}
                      {issue.area || issue.fixTarget ? (
                        <small>
                          {issue.area ? `Área: ${issue.area}` : ""}
                          {issue.area && issue.fixTarget ? " · " : ""}
                          {issue.fixTarget ? `Resolver en: ${issue.fixTarget}` : ""}
                        </small>
                      ) : null}
                    </div>
                    {issue.fixTarget && issue.fixTarget !== "seo" ? (
                      <Button
                        variant="quiet"
                        size="sm"
                        icon={ArrowRight}
                        aria-label={`Ir a ${FIX_LABELS[issue.fixTarget] ?? "corregir"} para resolver: ${issueContext(issue)}`}
                        data-testid="ui-seo-audit-fix"
                        onClick={() => navigateToFix(issue.fixTarget ?? "", onNavigate)}
                      >
                        Ir a {FIX_LABELS[issue.fixTarget] ?? "corregir"}
                      </Button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="seo-previews">
          <article className="asset-item" data-testid="ui-seo-preview-google">
            <div>
              <span
                style={{
                  color: "var(--muted)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Google
              </span>
              <a
                href={homepage}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "var(--accent)",
                  fontSize: 15,
                  fontWeight: 650,
                  lineHeight: 1.3,
                  overflowWrap: "anywhere",
                  textDecoration: "none",
                }}
              >
                {previewSeo.title}
              </a>
              <span style={{ overflowWrap: "anywhere" }}>{homepage}</span>
              <p
                style={{
                  color: "var(--ink)",
                  fontSize: 11.5,
                  lineHeight: 1.45,
                  margin: 0,
                  overflowWrap: "anywhere",
                }}
              >
                {previewSeo.description || "Sin descripción: completá la descripción SEO."}
              </p>
            </div>
          </article>

          <article className="asset-item" data-testid="ui-seo-preview-og">
            {socialAsset ? (
              <img src={socialAsset.source} alt="" />
            ) : (
              <div
                style={{
                  display: "grid",
                  height: 150,
                  placeItems: "center",
                  background: "var(--surface-strong)",
                  color: "var(--muted)",
                  fontSize: 11,
                }}
              >
                Sin imagen social
              </div>
            )}
            <div>
              <span
                style={{
                  color: "var(--muted)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Open Graph
              </span>
              <strong
                style={{
                  display: "block",
                  fontSize: 13,
                  lineHeight: 1.35,
                  overflowWrap: "anywhere",
                }}
              >
                {previewSeo.title}
              </strong>
              <span style={{ overflowWrap: "anywhere" }}>{homepage}</span>
            </div>
          </article>

          <article className="asset-item" data-testid="ui-seo-preview-whatsapp">
            <div>
              <span
                style={{
                  color: "var(--muted)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                WhatsApp
              </span>
              <strong
                style={{
                  display: "block",
                  fontSize: 13,
                  lineHeight: 1.35,
                  overflowWrap: "anywhere",
                }}
              >
                {project.identity.brandName}
              </strong>
              <p
                style={{
                  color: "var(--ink)",
                  fontSize: 11.5,
                  lineHeight: 1.45,
                  margin: 0,
                  overflowWrap: "anywhere",
                }}
              >
                {previewSeo.title} — {previewSeo.description || "Sin descripción"}
              </p>
              <span style={{ overflowWrap: "anywhere" }}>{homepage}</span>
            </div>
          </article>
        </div>

        <section className="guided-checklist" data-testid="ui-seo-checklist">
          <div className="guided-checklist__header">
            <div>
              <span className="guided-kicker">Revisión manual</span>
              <h3>Checklist de publicación</h3>
            </div>
            <span className="guided-checklist__more" data-testid="ui-seo-check-count">
              {checkedCount}/{issues.length} revisados
            </span>
          </div>
          {issues.length === 0 ? (
            <p className="guided-checklist__more" style={{ padding: "0 20px 18px" }}>
              Sin pendientes por revisar: la auditoría no detectó problemas.
            </p>
          ) : (
            <ul>
              {groupedIssues.map(([area, areaIssues]) => (
                <li key={area} data-testid="ui-seo-check-group" data-area={area}>
                  <span
                    className="guided-checklist__status"
                    style={{ color: "var(--muted)" }}
                    aria-hidden
                  />
                  <span className="guided-checklist__text">
                    <strong
                      style={{
                        color: "var(--muted)",
                        fontSize: 11,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        whiteSpace: "normal",
                      }}
                    >
                      {AREA_LABELS[area] ?? area}
                    </strong>
                    <small>
                      {areaIssues.length} {areaIssues.length === 1 ? "hallazgo" : "hallazgos"}
                    </small>
                  </span>
                </li>
              ))}
              {issues.map((issue) => {
                const done = checkedIssues.has(issue.id);
                const Icon = iconFor(issue);
                return (
                  <li
                    key={issue.id}
                    data-testid="ui-seo-check-item"
                    data-issue-id={issue.id}
                    data-done={done}
                  >
                    <span
                      className="guided-checklist__status"
                      data-status={
                        done ? undefined : issue.severity === "error" ? "invalid" : undefined
                      }
                      style={done ? { color: "var(--accent)" } : undefined}
                      aria-hidden
                    >
                      {done ? <CheckCircle size={18} weight="fill" /> : <Icon size={19} />}
                    </span>
                    <span className="guided-checklist__text">
                      <strong title={issue.title}>{issue.title}</strong>
                      <small>{issue.message}</small>
                    </span>
                    {issue.fixTarget && issue.fixTarget !== "seo" ? (
                      <Button
                        variant="quiet"
                        size="sm"
                        icon={ArrowRight}
                        aria-label={`Ir a ${FIX_LABELS[issue.fixTarget] ?? "corregir"} para resolver: ${issueContext(issue)}`}
                        data-testid="ui-seo-check-fix"
                        onClick={() => navigateToFix(issue.fixTarget ?? "", onNavigate)}
                      >
                        Ir a {FIX_LABELS[issue.fixTarget] ?? "corregir"}
                      </Button>
                    ) : (
                      <Button
                        variant="quiet"
                        size="sm"
                        icon={done ? CheckCircle : Circle}
                        aria-label={
                          done
                            ? `Marcar como pendiente: ${issueContext(issue)}`
                            : `Marcar como revisado: ${issueContext(issue)}`
                        }
                        aria-pressed={done}
                        data-testid="ui-seo-check-toggle"
                        onClick={() => toggleIssue(issue.id)}
                      >
                        {done ? "Revisado" : "Marcar revisado"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {optimization ? (
          <div
            className="optimization-panel optimization-panel--crawler"
            data-testid="ui-seo-crawler"
          >
            <header>
              <div>
                <h3>Cómo nos ve un crawler</h3>
                <p>Rutas detectadas por la optimización; el borrador agrega noindex/nofollow.</p>
              </div>
              <span className="guided-checklist__more">
                {optimization.counts.indexable} indexables ·{" "}
                {optimization.routes.length - optimization.counts.indexable} noindex
                {optimization.routes.length > routeLimit
                  ? ` · ${optimization.routes.length} rutas en total`
                  : ""}
              </span>
            </header>
            <div className="audit-list">
              {optimization.routes.slice(0, routeLimit).map((route) => (
                <article
                  className="audit-item"
                  data-testid="ui-seo-route"
                  data-indexable={route.indexable}
                  key={route.path}
                >
                  <MagnifyingGlass aria-hidden size={18} />
                  <div>
                    <strong>{route.path}</strong>
                    <p>
                      {route.title || "Sin título"}
                      <span style={{ marginLeft: 8 }}>
                        <Badge tone={route.indexable ? "success" : "neutral"}>
                          {route.indexable ? "indexable" : "noindex"}
                        </Badge>
                      </span>
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {optimization ? (
          <div className="optimization-panel optimization-panel--score">
            <header>
              <div>
                <h3>Optimización automática</h3>
                <p>Snapshot {optimization.snapshotHash}. Las correcciones no inventan contenido.</p>
              </div>
              <div className="optimization-actions">
                <strong
                  className={
                    optimization.counts.critical === 0
                      ? "optimization-score optimization-score--ready"
                      : "optimization-score"
                  }
                >
                  {optimization.score}/100
                </strong>
                <Button
                  icon={DownloadSimple}
                  onClick={() =>
                    downloadBlob(
                      `${JSON.stringify(optimization, null, 2)}\n`,
                      `${project.slug}-optimization.json`,
                      "application/json",
                    )
                  }
                >
                  Descargar informe
                </Button>
              </div>
            </header>
            <section className="optimization-metrics" aria-label="Resumen de optimización">
              <span>
                <strong>{optimization.counts.indexable}</strong> rutas indexables
              </span>
              <span>
                <strong>
                  {Math.round(optimization.aiReadiness.factualProductCoverage * 100)}%
                </strong>{" "}
                productos con contexto
              </span>
              <span>
                <strong>{optimization.performance.largeImages}</strong> imágenes grandes
              </span>
              <span>
                <strong>{optimization.aiReadiness.publicContextAvailable ? "Sí" : "No"}</strong>{" "}
                contexto IA público
              </span>
            </section>
          </div>
        ) : null}
      </div>
    </section>
  );
}
