import {
  Archive,
  ArrowCounterClockwise,
  ArrowUpRight,
  Calculator,
  CloudArrowDown,
  Copy,
  DownloadSimple,
  FolderOpen,
  Globe,
  Package,
  X,
} from "@phosphor-icons/react";
import { isBaseTemplate } from "@solara/project-schema/project-policy";
import { type RefObject, useEffect, useId, useState } from "react";
import { Button, IconButton } from "../../components/Ui";
import {
  calculateMonthlyCost,
  calculateMonthlyCostForCount,
  DEFAULT_PRICING,
  formatMonthlyCost,
  getMonthlyCostBreakdown,
  getProjectMetrics,
  loadPricingConfig,
  loadStoreDiscount,
  type PricingConfig,
  savePricingConfig,
  saveStoreDiscount,
  storeFaviconSrc,
  storeMark,
} from "../../lib/dashboardModel";
import { formatDate } from "../../lib/format";
import type { StoredProject } from "../../lib/repository";

export function statusLabel(status: StoredProject["status"]): string {
  return status === "archived" ? "Archivada" : "Activa";
}

export function formatCompactDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  const parts = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value.replaceAll(".", "") ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return [day, month, year].filter(Boolean).join(" ");
}

export interface ProjectCardProps {
  project: StoredProject | undefined;
  detailRef: RefObject<HTMLElement | null>;
  backupId: string | undefined;
  archivingId?: string | undefined;
  siteOpeningId: string | undefined;
  folderOpeningId: string | undefined;
  downloadingId: string | undefined;
  actionNotice: string | undefined;
  onClose(): void;
  onOpen(id: string): void;
  onOpenSite?: ((id: string) => Promise<void>) | undefined;
  onOpenFolder?: ((id: string) => Promise<void>) | undefined;
  onBackup(id: string): Promise<void>;
  onDownloadBackup?: ((id: string) => Promise<void>) | undefined;
  onDuplicate(id: string): Promise<void>;
  onArchive(id: string, archived: boolean): Promise<void>;
}

export function ProjectCard({
  project,
  detailRef,
  backupId,
  archivingId,
  siteOpeningId,
  folderOpeningId,
  downloadingId,
  actionNotice,
  onClose,
  onOpen,
  onOpenSite,
  onOpenFolder,
  onBackup,
  onDownloadBackup,
  onDuplicate,
  onArchive,
}: ProjectCardProps) {
  const protectedTemplate = project ? isBaseTemplate(project.project) : false;
  const faviconSrc = project ? storeFaviconSrc(project.project) : undefined;
  const projectId = project?.id;
  // Mensualidad y métricas siempre actualizadas con config global + descuento
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(() => loadPricingConfig());
  const [storeDiscount, setStoreDiscount] = useState<number>(() =>
    projectId ? loadStoreDiscount(projectId) : 0,
  );

  useEffect(() => {
    if (projectId) setStoreDiscount(loadStoreDiscount(projectId));
    else setStoreDiscount(0);
  }, [projectId]);

  const activeProducts = project ? getProjectMetrics(project.project).activeProducts : 0;
  const monthlyCost = project
    ? calculateMonthlyCost(project.project, project.id, pricingConfig)
    : 0;
  const baseMonthlyCost = project ? calculateMonthlyCostForCount(activeProducts, pricingConfig) : 0;
  const breakdown = project ? getMonthlyCostBreakdown(activeProducts, pricingConfig) : [];

  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const calculatorTitleId = useId();

  const handlePricingChange = (patch: Partial<PricingConfig>) => {
    const next = { ...pricingConfig, ...patch };
    next.base = Math.max(0, Math.round(next.base));
    next.tier1Price = Math.max(0, Math.round(next.tier1Price));
    next.tier2Price = Math.max(0, Math.round(next.tier2Price));
    next.tier3Price = Math.max(0, Math.round(next.tier3Price));
    // incluido fijo en 20
    next.included = 20;
    setPricingConfig(next);
    savePricingConfig(next);
  };

  const handleDiscountChange = (value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    setStoreDiscount(clamped);
    if (project) saveStoreDiscount(project.id, clamped);
  };

  const openCalculator = () => setCalculatorOpen(true);
  const closeCalculator = () => setCalculatorOpen(false);

  return (
    <section
      ref={detailRef}
      className={`dashboard-store-detail${project ? " is-open" : ""}`}
      aria-label={project ? `Tienda seleccionada: ${project.name}` : "Tienda seleccionada"}
      tabIndex={project ? 0 : -1}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          if (calculatorOpen) closeCalculator();
          else onClose();
        }
      }}
    >
      {project ? (
        <>
          <div className="dashboard-store-detail__identity">
            <span className="dashboard-store-detail__mark" aria-hidden>
              {faviconSrc ? (
                <img
                  src={faviconSrc}
                  alt=""
                  width={46}
                  height={46}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                storeMark(project.name)
              )}
            </span>
            <div className="dashboard-store-detail__title">
              <h3>{project.name}</h3>
              <div className="dashboard-store-detail__statuses">
                <span className={`dashboard-store-card__status is-${project.status}`}>
                  <span aria-hidden />
                  {statusLabel(project.status)}
                </span>
                {protectedTemplate ? (
                  <span className="dashboard-store-card__status is-protected">Solo lectura</span>
                ) : null}
              </div>
            </div>
            <IconButton
              icon={X}
              label="Cerrar detalle"
              onClick={onClose}
              className="dashboard-store-detail__close"
            />
          </div>
          <dl className="dashboard-store-detail__facts">
            <div>
              <dt>ID</dt>
              <dd>{project.id}</dd>
            </div>
            <div>
              <dt>Actualizada</dt>
              <dd title={formatDate(project.updatedAt)}>{formatCompactDate(project.updatedAt)}</dd>
            </div>
            <div>
              <dt>Productos</dt>
              <dd>{getProjectMetrics(project.project).activeProducts}</dd>
            </div>
            <div>
              <dt>Categorías</dt>
              <dd>{getProjectMetrics(project.project).categories}</dd>
            </div>
            <div>
              <dt>Colecciones</dt>
              <dd>{getProjectMetrics(project.project).collections}</dd>
            </div>
            <div>
              <dt>Recursos</dt>
              <dd>{getProjectMetrics(project.project).assets}</dd>
            </div>
            {project.diskVersion !== undefined ? (
              <div>
                <dt>Versión en disco</dt>
                <dd>v{project.diskVersion}</dd>
              </div>
            ) : null}
            {project.diskSiteStatus ? (
              <div>
                <dt>Sitio público</dt>
                <dd>
                  {project.diskSiteStatus === "synced" ? "Actualizado" : "Anterior conservado"}
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="dashboard-store-detail__actions">
            <Button variant="primary" icon={ArrowUpRight} onClick={() => onOpen(project.id)}>
              Abrir tienda
            </Button>
            {onOpenSite ? (
              <Button
                variant="secondary"
                icon={Globe}
                loading={siteOpeningId === project.id}
                onClick={() => void onOpenSite(project.id)}
              >
                {siteOpeningId === project.id ? "Abriendo sitio" : "Abrir sitio público"}
              </Button>
            ) : null}
            {onOpenFolder ? (
              <Button
                variant="secondary"
                icon={FolderOpen}
                loading={folderOpeningId === project.id}
                onClick={() => void onOpenFolder(project.id)}
              >
                {folderOpeningId === project.id ? "Abriendo carpeta" : "Abrir carpeta"}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              icon={CloudArrowDown}
              loading={backupId === project.id}
              onClick={() => void onBackup(project.id)}
            >
              {backupId === project.id ? "Preparando respaldo" : "Respaldo ahora"}
            </Button>
            {onDownloadBackup ? (
              <Button
                variant="secondary"
                icon={DownloadSimple}
                loading={downloadingId === project.id}
                onClick={() => void onDownloadBackup(project.id)}
              >
                {downloadingId === project.id ? "Descargando respaldo" : "Descargar respaldo"}
              </Button>
            ) : null}
            <Button variant="secondary" icon={Copy} onClick={() => void onDuplicate(project.id)}>
              Duplicar
            </Button>
            <Button
              className="dashboard-store-detail__calculator"
              variant="secondary"
              icon={Calculator}
              onClick={openCalculator}
            >
              Calculadora
            </Button>
            <Button
              className="dashboard-store-detail__danger"
              variant={project.status === "archived" ? "secondary" : "danger"}
              icon={project.status === "archived" ? ArrowCounterClockwise : Archive}
              loading={archivingId === project.id}
              disabled={protectedTemplate}
              onClick={() => void onArchive(project.id, project.status !== "archived")}
            >
              {protectedTemplate
                ? "Plantilla protegida"
                : project.status === "archived"
                  ? "Restaurar"
                  : "Archivar"}
            </Button>
          </div>
          {calculatorOpen && (
            <div
              className="dashboard-calculator-dialog is-open"
              role="dialog"
              aria-modal="true"
              aria-labelledby={calculatorTitleId}
            >
              <form
                className="dashboard-calculator-dialog__content dashboard-calculator-dialog__content--compact"
                onSubmit={(e) => e.preventDefault()}
              >
                <header className="dashboard-calculator-dialog__header">
                  <div className="dashboard-calculator-dialog__title">
                    <h2 id={calculatorTitleId}>
                      Precio de tu <span>tienda online</span>
                    </h2>
                    <div className="dashboard-calculator-dialog__subtitle">
                      <span />
                      <p>Fórmula mensual</p>
                      <span />
                    </div>
                  </div>
                  <IconButton icon={X} label="Cerrar calculadora" onClick={closeCalculator} />
                </header>

                {/* Configuración global — misma tarifa para todas las tiendas */}
                <section className="dashboard-calculator-dialog__section">
                  <h4 className="dashboard-calculator-dialog__section-title">Tarifa global</h4>
                  <div
                    className="dashboard-calculator-dialog__grid dashboard-calculator-dialog__grid--2"
                    style={{ gridTemplateColumns: "1fr auto" }}
                  >
                    <label className="dashboard-calculator-dialog__field">
                      <span>Base / mes</span>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={pricingConfig.base}
                        onChange={(e) => handlePricingChange({ base: Number(e.target.value) })}
                      />
                    </label>
                    <div
                      className="dashboard-calculator-dialog__field"
                      style={{ justifyContent: "center", textAlign: "center" }}
                    >
                      <span style={{ opacity: 0.7 }}>Incluye</span>
                      <strong style={{ fontSize: "13px", color: "var(--cosmic-ink)" }}>
                        hasta 20 productos
                      </strong>
                    </div>
                  </div>
                  <div className="dashboard-calculator-dialog__grid dashboard-calculator-dialog__grid--3">
                    <label className="dashboard-calculator-dialog__field">
                      <span>21–100 c/u</span>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={pricingConfig.tier1Price}
                        onChange={(e) =>
                          handlePricingChange({ tier1Price: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className="dashboard-calculator-dialog__field">
                      <span>101–200 c/u</span>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={pricingConfig.tier2Price}
                        onChange={(e) =>
                          handlePricingChange({ tier2Price: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className="dashboard-calculator-dialog__field">
                      <span>201+ c/u</span>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={pricingConfig.tier3Price}
                        onChange={(e) =>
                          handlePricingChange({ tier3Price: Number(e.target.value) })
                        }
                      />
                    </label>
                  </div>
                  <div className="dashboard-calculator-dialog__hint">
                    Cambios se aplican a todas las tiendas. Base{" "}
                    {formatMonthlyCost(pricingConfig.base)} + tramos.
                  </div>
                </section>

                {/* Descuento específico para la tienda seleccionada */}
                <section className="dashboard-calculator-dialog__section dashboard-calculator-dialog__section--accent">
                  <h4 className="dashboard-calculator-dialog__section-title">
                    Precio especial — {project.name}
                  </h4>
                  <label className="dashboard-calculator-dialog__field dashboard-calculator-dialog__field--inline">
                    <span>Descuento %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={storeDiscount}
                      onChange={(e) => handleDiscountChange(Number(e.target.value))}
                      placeholder="0"
                    />
                    <small>0–100% (vacío = 0)</small>
                  </label>
                </section>

                {/* Cálculo desglosado para la tienda seleccionada — sin scroll */}
                <section className="dashboard-calculator-dialog__current dashboard-calculator-dialog__current--compact">
                  <div className="dashboard-calculator-dialog__current-header">
                    <span>
                      {activeProducts} productos
                      {storeDiscount > 0 ? ` · -${storeDiscount}%` : ""}
                    </span>
                    <strong>{formatMonthlyCost(monthlyCost)}/mes</strong>
                  </div>
                  <div className="dashboard-calculator-dialog__breakdown-compact">
                    <div className="dashboard-calculator-dialog__breakdown-row">
                      <span>Base ({pricingConfig.included} incl.)</span>
                      <strong>{formatMonthlyCost(pricingConfig.base)}</strong>
                    </div>
                    {breakdown.map((item) => (
                      <div key={item.label} className="dashboard-calculator-dialog__breakdown-row">
                        <span>{item.label}</span>
                        <span>
                          {item.products} × {formatMonthlyCost(item.price)} ={" "}
                          {formatMonthlyCost(item.subtotal)}
                        </span>
                      </div>
                    ))}
                    {storeDiscount > 0 && (
                      <div className="dashboard-calculator-dialog__breakdown-row is-discount">
                        <span>Descuento {storeDiscount}%</span>
                        <span>-{formatMonthlyCost(baseMonthlyCost - monthlyCost)}</span>
                      </div>
                    )}
                    <div className="dashboard-calculator-dialog__breakdown-row is-total">
                      <span>Total</span>
                      <strong>{formatMonthlyCost(monthlyCost)}</strong>
                    </div>
                  </div>
                  {breakdown.length === 0 && storeDiscount === 0 && (
                    <p className="dashboard-calculator-dialog__current-note">
                      Dentro del plan base.
                    </p>
                  )}
                </section>

                <div className="dashboard-calculator-dialog__actions">
                  <Button
                    variant="quiet"
                    type="button"
                    onClick={() => handlePricingChange(DEFAULT_PRICING)}
                  >
                    Restablecer tarifa
                  </Button>
                  <Button variant="primary" type="button" onClick={closeCalculator}>
                    Cerrar
                  </Button>
                </div>
              </form>
            </div>
          )}
          {actionNotice ? (
            <output
              className="dashboard-store-detail__notice"
              aria-live="polite"
              data-testid="ui-detail-notice"
            >
              {actionNotice}
            </output>
          ) : null}
        </>
      ) : (
        <div className="dashboard-store-detail__empty">
          <Package aria-hidden size={26} />
          <strong>Seleccioná una tienda</strong>
          <p>Elegí un proyecto para ver sus datos y acciones.</p>
        </div>
      )}
    </section>
  );
}
