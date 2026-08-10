/** Checklist de preparación que guía una tienda limpia sin alterar el constructor avanzado. */
import {
  ArrowRight,
  CheckCircle,
  ClipboardText,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import type { StoreProjectV1 } from "@solara/project-schema";
import {
  type ContentRequirement,
  type ContentStatus,
  evaluateCatalogModernReadiness,
} from "@solara/project-schema/catalog-modern-guidance";
import {
  applyCatalogModernUpgrade,
  planCatalogModernUpgrade,
} from "@solara/project-schema/catalog-modern-upgrade";
import { useId } from "react";
import { Button, SectionHeader } from "../components/Ui";

type GuidedDestination = "overview" | "catalog" | "assets" | "builder" | "seo" | "export";

interface GuidedOverviewProps {
  project: StoreProjectV1;
  onNavigate(destination: GuidedDestination): void;
  onApplyUpgrade(project: StoreProjectV1): void;
}

const scopeLabels: Record<ContentRequirement["scope"], string> = {
  identity: "Marca",
  home: "Inicio",
  about: "Nosotros",
  contact: "Contacto",
  navigation: "Navegación",
  category: "Categorías",
  product: "Productos",
  seo: "SEO",
  asset: "Imágenes",
  policy: "Políticas",
};

function destinationFor(scope: ContentRequirement["scope"]): GuidedDestination {
  if (scope === "product" || scope === "category") return "catalog";
  if (scope === "asset") return "assets";
  if (scope === "seo") return "seo";
  if (scope === "identity" || scope === "navigation" || scope === "about" || scope === "contact") {
    return "overview";
  }
  return "builder";
}

function statusLabel(status: ContentRequirement["status"]): string {
  if (status === "placeholder") return "Reemplazar texto de plantilla";
  if (status === "missing") return "Falta completar";
  if (status === "invalid") return "Revisar formato";
  return "Listo";
}

/** Icono por estado del requisito: ok (check), error (invalid) o pendiente. */
function RequirementStatusIcon({ status }: { status: ContentStatus }) {
  if (status === "ready") return <CheckCircle size={18} />;
  if (status === "invalid") return <XCircle size={18} />;
  return <WarningCircle size={18} />;
}

export function GuidedOverview({ project, onNavigate, onApplyUpgrade }: GuidedOverviewProps) {
  const titleId = useId();
  const checklistId = useId();
  const readiness = evaluateCatalogModernReadiness(project);
  const pending = readiness.requirements.filter((requirement) => requirement.status !== "ready");
  const ready = readiness.requirements.filter((requirement) => requirement.status === "ready");
  const visiblePending = pending.slice(0, 12);
  const productCount = project.products.filter((product) => product.status === "active").length;
  const imageCount = project.assets.length;
  const upgrade = planCatalogModernUpgrade(project);
  const nextPending = pending[0];

  return (
    <section className="guided-overview workspace-section" aria-labelledby={titleId}>
      <SectionHeader
        title="Preparar tienda"
        description="Catalog Modern ya está armado. Completá tu contenido, cargá el catálogo y revisá la publicación."
        actions={
          <Button variant="quiet" icon={ArrowRight} onClick={() => onNavigate("builder")}>
            Modo avanzado
          </Button>
        }
      />

      <output className="guided-progress" aria-live="polite">
        <div className="guided-progress__icon" aria-hidden>
          {readiness.criticalPending === 0 ? (
            <CheckCircle size={26} />
          ) : (
            <ClipboardText size={26} />
          )}
        </div>
        <div className="guided-progress__copy">
          <strong id={titleId}>
            {readiness.ready} de {readiness.requirements.length} requisitos listos
          </strong>
          <span>
            {readiness.criticalPending > 0
              ? `${readiness.criticalPending} pendientes bloquean producción.`
              : "La tienda puede pasar a revisión de publicación."}
          </span>
          {nextPending ? (
            <Button
              variant="primary"
              size="sm"
              icon={ArrowRight}
              data-testid="ui-guided-next"
              onClick={() => onNavigate(destinationFor(nextPending.scope))}
            >
              Siguiente: {nextPending.label}
            </Button>
          ) : null}
        </div>
        <div
          className="guided-progress__meter"
          role="progressbar"
          aria-label="Progreso de preparación"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={readiness.percent}
          data-testid="ui-guided-progress"
        >
          <span style={{ width: `${readiness.percent}%` }} />
        </div>
      </output>

      <div className="guided-stats">
        <div>
          <strong>{productCount}</strong>
          <span>productos activos</span>
        </div>
        <div>
          <strong>{project.categories.length}</strong>
          <span>categorías</span>
        </div>
        <div>
          <strong>{imageCount}</strong>
          <span>recursos cargados</span>
        </div>
      </div>

      {upgrade.safeChanges.length > 0 || upgrade.conflicts.length > 0 ? (
        <section className="template-update" aria-labelledby={`${titleId}-update`}>
          <div>
            <span className="guided-kicker">Actualización disponible</span>
            <h3 id={`${titleId}-update`}>Catalog Modern {upgrade.toVersion}</h3>
            <p>
              Revisá los cambios de la plantilla. Tus textos, productos e imágenes se conservan.
            </p>
          </div>
          {upgrade.safeChanges.length > 0 ? (
            <ul>
              {upgrade.safeChanges.map((change) => (
                <li key={change.id}>{change.label}</li>
              ))}
            </ul>
          ) : null}
          {upgrade.conflicts.length > 0 ? (
            <p className="template-update__conflict">
              {upgrade.conflicts.length} decisión(es) requieren revisión manual y se conservarán.
            </p>
          ) : null}
          <Button
            variant="primary"
            onClick={() =>
              onApplyUpgrade(
                applyCatalogModernUpgrade(
                  project,
                  upgrade.safeChanges.map((change) => change.id),
                ),
              )
            }
          >
            Respaldar y adoptar cambios
          </Button>
        </section>
      ) : null}

      {visiblePending.length > 0 ? (
        <section className="guided-checklist" aria-labelledby={checklistId}>
          <div className="guided-checklist__header">
            <div>
              <span className="guided-kicker">Siguiente paso</span>
              <h3 id={checklistId}>Completá lo que falta</h3>
            </div>
            {pending.length > visiblePending.length ? (
              <span className="guided-checklist__more">
                +{pending.length - visiblePending.length} más
              </span>
            ) : null}
          </div>
          <ul>
            {visiblePending.map((requirement) => (
              <li
                key={requirement.id}
                data-testid="ui-guided-requirement"
                data-requirement-id={requirement.id}
                data-requirement-status={requirement.status}
              >
                <span
                  className="guided-checklist__status"
                  data-status={requirement.status}
                  aria-hidden
                >
                  <RequirementStatusIcon status={requirement.status} />
                </span>
                <span className="guided-checklist__text">
                  <strong title={requirement.label}>{requirement.label}</strong>
                  <small>
                    {scopeLabels[requirement.scope]} · {statusLabel(requirement.status)}
                  </small>
                </span>
                <Button
                  variant="quiet"
                  icon={ArrowRight}
                  aria-label={`Editar ${requirement.label}`}
                  onClick={() => onNavigate(destinationFor(requirement.scope))}
                >
                  Editar
                </Button>
              </li>
            ))}
          </ul>
          {ready.length > 0 ? (
            <details className="guided-checklist__done" data-testid="ui-guided-done">
              <summary>Requisitos listos ({ready.length})</summary>
              <ul>
                {ready.map((requirement) => (
                  <li
                    key={requirement.id}
                    data-testid="ui-guided-requirement"
                    data-requirement-id={requirement.id}
                    data-requirement-status="ready"
                  >
                    <span className="guided-checklist__status" data-status="ready" aria-hidden>
                      <RequirementStatusIcon status="ready" />
                    </span>
                    <span className="guided-checklist__text">
                      <strong title={requirement.label}>{requirement.label}</strong>
                      <small>{scopeLabels[requirement.scope]}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : (
        <div className="guided-ready" data-testid="ui-guided-ready">
          <CheckCircle aria-hidden size={24} />
          <div>
            <strong>La base está lista para revisar</strong>
            <p>Podés abrir el preview o pasar a la exportación de producción.</p>
          </div>
          <Button variant="primary" onClick={() => onNavigate("export")}>
            Revisar publicación
          </Button>
        </div>
      )}

      <div className="guided-actions">
        <button type="button" onClick={() => onNavigate("overview")}>
          <strong>Marca y textos</strong>
          <span>Identidad, contacto, páginas y navegación</span>
          <ArrowRight aria-hidden size={18} />
        </button>
        <button type="button" onClick={() => onNavigate("catalog")}>
          <strong>Cargar catálogo</strong>
          <span>Importá una carpeta con CSV e imágenes o agregá productos manualmente</span>
          <ArrowRight aria-hidden size={18} />
        </button>
        <button type="button" onClick={() => onNavigate("assets")}>
          <strong>Organizar imágenes</strong>
          <span>Asigná logo, hero, categorías y productos</span>
          <ArrowRight aria-hidden size={18} />
        </button>
      </div>
    </section>
  );
}
