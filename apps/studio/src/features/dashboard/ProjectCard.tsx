import {
  Archive,
  ArrowCounterClockwise,
  ArrowUpRight,
  CloudArrowDown,
  Copy,
  DownloadSimple,
  FolderOpen,
  Globe,
  Package,
  X,
} from "@phosphor-icons/react";
import { isBaseTemplate } from "@solara/project-schema/project-policy";
import type { RefObject } from "react";
import { Button, IconButton } from "../../components/Ui";
import { getProjectMetrics, storeFaviconSrc, storeMark } from "../../lib/dashboardModel";
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
  return (
    <section
      ref={detailRef}
      className={`dashboard-store-detail${project ? " is-open" : ""}`}
      aria-label={project ? `Tienda seleccionada: ${project.name}` : "Tienda seleccionada"}
      tabIndex={project ? 0 : -1}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      {project ? (
        <>
          <header className="dashboard-store-detail__header">
            <span>{protectedTemplate ? "Plantilla protegida" : "Tienda seleccionada"}</span>
            <IconButton icon={X} label="Cerrar detalle" onClick={onClose} />
          </header>
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
            <div>
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
