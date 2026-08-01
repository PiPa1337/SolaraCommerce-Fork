import { CheckCircle, Info, MagnifyingGlass, WarningCircle, XCircle } from "@phosphor-icons/react";
import { auditReport } from "@solara/exporter";
import type { StoreProjectV1 } from "@solara/project-schema";
import { useMemo } from "react";
import { Field, SectionHeader } from "../components/Ui";

interface AuditIssue {
  id: string;
  severity: "error" | "warning" | "info";
  title: string;
  message: string;
  area?: string;
  fixTarget?: string;
}

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

export function Seo({
  project,
  onChange,
}: {
  project: StoreProjectV1;
  onChange(project: StoreProjectV1): void;
}) {
  const report = useMemo(() => auditReport(project), [project]);
  const issues = useMemo(() => normalizeIssues(report.issues), [report]);
  const commit = (seo: StoreProjectV1["seo"]) =>
    onChange({ ...project, seo, updatedAt: new Date().toISOString() });
  const errors = report.criticalCount;
  const warnings = report.warningCount;

  return (
    <section className="workspace-section">
      <SectionHeader
        title="SEO y Google"
        description="La auditoría compara el proyecto con el HTML, los datos estructurados y el feed."
      />
      <div className="seo-grid">
        <fieldset>
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

        <fieldset>
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

        <div className="audit-panel">
          <header>
            <div>
              <h3>Auditoría</h3>
              <p>
                {errors} errores críticos, {warnings} advertencias.
              </p>
              {report.merchantMode === "experimental-whatsapp" ? (
                <p className="audit-note">
                  Merchant en modo experimental: el checkout final por WhatsApp puede no cumplir los
                  requisitos de Google.
                </p>
              ) : null}
            </div>
            {errors === 0 ? (
              <span className="audit-ready">
                <CheckCircle aria-hidden size={18} weight="fill" /> Lista para revisar
              </span>
            ) : null}
          </header>
          {issues.length === 0 ? (
            <div className="audit-empty">
              <CheckCircle aria-hidden size={26} />
              <p>No se detectaron problemas con el proyecto actual.</p>
            </div>
          ) : (
            <div className="audit-list">
              {issues.map((issue) => {
                const Icon =
                  issue.severity === "error"
                    ? XCircle
                    : issue.severity === "warning"
                      ? WarningCircle
                      : Info;
                return (
                  <article className={`audit-item audit-item--${issue.severity}`} key={issue.id}>
                    <Icon
                      aria-hidden
                      size={19}
                      weight={issue.severity === "info" ? "regular" : "fill"}
                    />
                    <div>
                      <strong>{issue.title}</strong>
                      {issue.message ? <p>{issue.message}</p> : null}
                      {issue.area || issue.fixTarget ? (
                        <small>
                          {issue.area ? `Área: ${issue.area}` : ""}
                          {issue.area && issue.fixTarget ? " · " : ""}
                          {issue.fixTarget ? `Resolver en: ${issue.fixTarget}` : ""}
                        </small>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
