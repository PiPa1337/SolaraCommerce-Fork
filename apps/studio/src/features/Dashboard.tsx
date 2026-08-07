/**
 * Biblioteca de tiendas: consulta la fuente disponible, aplica filtros y
 * expone creación, duplicado, archivo, respaldos y cierre del servidor propio.
 */
import { ArrowUpRight, CheckCircle, Plus, Storefront, X } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button, EmptyState, Field, IconButton, InlineError } from "../components/Ui";
import {
  type DashboardSort,
  type DashboardStatusFilter,
  filterDashboardProjects,
  getDashboardStats,
  getProjectMetrics,
} from "../lib/dashboardModel";
import { formatDate } from "../lib/format";
import type { StoredProject } from "../lib/repository";
import { DashboardToolbar } from "./dashboard/DashboardToolbar";
import { formatCompactDate, ProjectCard, statusLabel } from "./dashboard/ProjectCard";

const CosmicBackground = lazy(() =>
  import("./CosmicBackground").then(({ CosmicBackground: component }) => ({ default: component })),
);

interface DashboardProps {
  projects: StoredProject[];
  onCreate(input: { name: string; brandName: string; email: string; phone: string }): Promise<void>;
  onOpen(id: string): void;
  onDuplicate(id: string): Promise<void>;
  onArchive(id: string, archived: boolean): Promise<void>;
  onBackup(id: string): Promise<void>;
  onDownloadBackup?(id: string): Promise<void>;
  onOpenSite?(id: string): Promise<void>;
  onOpenFolder?(id: string): Promise<void>;
  onSessionManaged?(managed: boolean): void;
}

type DashboardView = "grid" | "list";

export function Dashboard({
  projects,
  onCreate,
  onOpen,
  onDuplicate,
  onArchive,
  onBackup,
  onDownloadBackup,
  onOpenSite,
  onOpenFolder,
  onSessionManaged,
}: DashboardProps) {
  const [statusFilter, setStatusFilter] = useState<DashboardStatusFilter>("active");
  const [sort, setSort] = useState<DashboardSort>("updated");
  const [view, setView] = useState<DashboardView>("grid");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [createError, setCreateError] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [backupId, setBackupId] = useState<string>();
  const [siteOpeningId, setSiteOpeningId] = useState<string>();
  const [shutdownState, setShutdownState] = useState<
    "checking" | "unavailable" | "available" | "closing" | "closed"
  >("checking");
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);
  const [shutdownError, setShutdownError] = useState("");
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const shutdownDialogRef = useRef<HTMLDialogElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const selectedPanelRef = useRef<HTMLElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const cardButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const lastSelectedIdRef = useRef<string | undefined>(undefined);
  const selectionInitializedRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const dashboardTitleId = useId();
  const libraryTitleId = useId();
  const createStoreTitleId = useId();
  const shutdownTitleId = useId();

  const visible = useMemo(
    () => filterDashboardProjects(projects, query, statusFilter, sort),
    [projects, query, sort, statusFilter],
  );
  const stats = useMemo(() => getDashboardStats(projects), [projects]);
  const selected = projects.find((record) => record.id === selectedId);

  useEffect(() => {
    const selectedIsVisible = selectedId
      ? visible.some((record) => record.id === selectedId)
      : false;
    if (selectedIsVisible) return;
    if (selectedId) {
      setSelectedId(visible[0]?.id);
      return;
    }
    if (!selectionInitializedRef.current && visible[0]) {
      selectionInitializedRef.current = true;
      setSelectedId(visible[0].id);
    }
  }, [selectedId, visible]);

  useEffect(() => {
    const dialog = createDialogRef.current;
    if (!dialog) return;
    if (creating && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => nameInputRef.current?.focus());
    }
    if (!creating && dialog.open) dialog.close();
  }, [creating]);

  useEffect(() => {
    const dialog = shutdownDialogRef.current;
    if (!dialog) return;
    if (shutdownDialogOpen && !dialog.open) dialog.showModal();
    if (!shutdownDialogOpen && dialog.open) dialog.close();
  }, [shutdownDialogOpen]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/__solara/session", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return false;
        const body = (await response.json()) as { managed?: boolean };
        return body.managed === true;
      })
      .then((managed) => {
        setShutdownState(managed ? "available" : "unavailable");
        onSessionManaged?.(managed);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setShutdownState("unavailable");
        onSessionManaged?.(false);
      });
    return () => controller.abort();
  }, [onSessionManaged]);

  useEffect(() => {
    const openShutdown = () => setShutdownDialogOpen(true);
    window.addEventListener("solara:open-shutdown", openShutdown);
    return () => window.removeEventListener("solara:open-shutdown", openShutdown);
  }, []);

  useEffect(() => {
    if (selected) {
      lastSelectedIdRef.current = selected.id;
      selectedPanelRef.current?.focus();
      return;
    }
    const lastSelectedId = lastSelectedIdRef.current;
    if (!lastSelectedId) return;
    requestAnimationFrame(() => {
      const card =
        cardButtonRefs.current.get(lastSelectedId) ??
        document.querySelector<HTMLButtonElement>(`[data-store-card-id="${lastSelectedId}"]`);
      card?.focus();
    });
  }, [selected]);

  const openCreate = () => {
    setStep(1);
    setName("");
    setBrandName("");
    setEmail("");
    setPhone("");
    setCreateError("");
    setCreating(true);
  };

  const closeCreate = () => {
    if (creatingProject) return;
    setCreating(false);
    createButtonRef.current?.focus();
  };

  const submit = async () => {
    setCreateError("");
    if (step < 4) {
      if (step === 1 && !name.trim()) {
        setCreateError("Escribí un nombre para continuar.");
        return;
      }
      setStep((current) => (current + 1) as 1 | 2 | 3 | 4);
      return;
    }
    if (!name.trim()) {
      setCreateError("Escribí un nombre para crear la tienda.");
      return;
    }
    setCreatingProject(true);
    try {
      await onCreate({ name, brandName: brandName || name, email, phone });
      setCreating(false);
      setStep(1);
    } catch (reason) {
      setCreateError(reason instanceof Error ? reason.message : "No se pudo crear la tienda.");
    } finally {
      setCreatingProject(false);
    }
  };

  const requestShutdown = async () => {
    setShutdownState("closing");
    setShutdownError("");
    try {
      const response = await fetch("/__solara/shutdown", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("El servidor no aceptó el cierre.");
      setShutdownDialogOpen(false);
      setShutdownState("closed");
    } catch {
      setShutdownState("available");
      setShutdownError("No se pudo detener el servidor local.");
    }
  };

  const createBackup = async (id: string) => {
    setBackupId(id);
    try {
      await onBackup(id);
    } finally {
      setBackupId(undefined);
    }
  };

  const openSite = async (id: string) => {
    if (!onOpenSite) return;
    setSiteOpeningId(id);
    try {
      await onOpenSite(id);
    } finally {
      setSiteOpeningId(undefined);
    }
  };

  return (
    <main id={"tiendas"} tabIndex={-1} className="dashboard-page dashboard-cosmic">
      <Suspense
        fallback={<div className="cosmic-background cosmic-background--fallback" aria-hidden />}
      >
        <CosmicBackground intensity="normal" />
      </Suspense>
      <div className="dashboard-cosmic__scrim" aria-hidden />
      <div className="dashboard-wrap dashboard-cosmic__content">
        <section className="dashboard-cosmic-hero" aria-labelledby={dashboardTitleId}>
          <div className="dashboard-cosmic-hero__copy">
            <span className="dashboard-cosmic-kicker">Espacio local</span>
            <h1 id={dashboardTitleId}>Tus tiendas</h1>
            <p>Gestioná tus proyectos, catálogos y respaldos desde un solo lugar.</p>
            <Button ref={createButtonRef} variant="primary" icon={Plus} onClick={openCreate}>
              Nueva tienda
            </Button>
          </div>
          <section className="dashboard-cosmic-metrics" aria-label="Resumen de tiendas">
            <div>
              <strong>{stats.totalStores}</strong>
              <span>Tiendas totales</span>
            </div>
            <div>
              <strong>{stats.activeStores}</strong>
              <span>Tiendas activas</span>
            </div>
            <div>
              <strong>{stats.activeProducts.toLocaleString("es-AR")}</strong>
              <span>Productos activos</span>
            </div>
            <div>
              <strong>{stats.archivedStores}</strong>
              <span>Archivadas</span>
            </div>
          </section>
        </section>

        {shutdownState === "closed" ? (
          <output className="shutdown-status shutdown-status--cosmic">
            <CheckCircle aria-hidden size={18} />
            <span>
              <strong>Servidor local detenido.</strong> Podés cerrar esta pestaña del navegador.
            </span>
          </output>
        ) : null}

        <section className="dashboard-cosmic-library" aria-labelledby={libraryTitleId}>
          <header className="dashboard-cosmic-library__header">
            <div>
              <span className="dashboard-cosmic-kicker">Biblioteca</span>
              <h2 id={libraryTitleId}>Proyectos guardados</h2>
            </div>
            <span className="dashboard-cosmic-count" aria-live="polite" aria-atomic="true">
              {visible.length} visibles
            </span>
          </header>

          <DashboardToolbar
            query={query}
            statusFilter={statusFilter}
            sort={sort}
            view={view}
            onQueryChange={setQuery}
            onStatusFilterChange={setStatusFilter}
            onSortChange={setSort}
            onViewChange={setView}
          />

          <div className={`dashboard-cosmic-results dashboard-cosmic-results--${view}`}>
            <div className="dashboard-cosmic-store-grid" aria-live="polite">
              {visible.length === 0 ? (
                <EmptyState
                  icon={Storefront}
                  title={projects.length === 0 ? "Todavía no hay tiendas" : "No hay coincidencias"}
                  body={
                    projects.length === 0
                      ? "Creá una tienda para empezar a organizar tu catálogo."
                      : "Probá con otra búsqueda o limpiá los filtros activos."
                  }
                  action={
                    projects.length === 0 ? (
                      <Button variant="primary" icon={Plus} onClick={openCreate}>
                        Crear primera tienda
                      </Button>
                    ) : null
                  }
                />
              ) : (
                visible.map((record, index) => {
                  const metrics = getProjectMetrics(record.project);
                  const isSelected = record.id === selectedId;
                  const updatedLabel = formatDate(record.updatedAt);
                  return (
                    <motion.article
                      className={`dashboard-store-card${isSelected ? " is-selected" : ""}`}
                      key={record.id}
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(index * 0.025, 0.25) }}
                    >
                      <button
                        className="dashboard-store-card__button"
                        type="button"
                        aria-pressed={isSelected}
                        data-store-card-id={record.id}
                        ref={(element) => {
                          if (element) cardButtonRefs.current.set(record.id, element);
                          else cardButtonRefs.current.delete(record.id);
                        }}
                        onClick={() => setSelectedId(record.id)}
                        onDoubleClick={() => onOpen(record.id)}
                      >
                        <span className="dashboard-store-card__index">{index + 1}</span>
                        <span className="dashboard-store-card__mark" aria-hidden>
                          {record.name.slice(0, 2).toUpperCase()}
                        </span>
                        <strong>{record.name}</strong>
                        <span className={`dashboard-store-card__status is-${record.status}`}>
                          <span aria-hidden />
                          {statusLabel(record.status)}
                        </span>
                        <span className="dashboard-store-card__meta">
                          {metrics.activeProducts.toLocaleString("es-AR")} productos
                        </span>
                        <time
                          className="dashboard-store-card__meta"
                          dateTime={record.updatedAt}
                          title={`Actualizada ${updatedLabel}`}
                        >
                          {formatCompactDate(record.updatedAt)}
                        </time>
                      </button>
                      <button
                        className="dashboard-store-card__open"
                        type="button"
                        data-testid="ui-card-open"
                        aria-label="Abrir esta tienda"
                        onClick={() => onOpen(record.id)}
                      >
                        Abrir <ArrowUpRight aria-hidden size={13} />
                      </button>
                    </motion.article>
                  );
                })
              )}
            </div>

            <ProjectCard
              project={selected}
              detailRef={selectedPanelRef}
              backupId={backupId}
              siteOpeningId={siteOpeningId}
              onClose={() => setSelectedId(undefined)}
              onOpen={onOpen}
              onOpenSite={onOpenSite ? openSite : undefined}
              onOpenFolder={onOpenFolder}
              onBackup={createBackup}
              onDownloadBackup={onDownloadBackup}
              onDuplicate={onDuplicate}
              onArchive={onArchive}
            />
          </div>
        </section>
      </div>

      <dialog
        ref={createDialogRef}
        className="dashboard-cosmic-dialog"
        aria-labelledby={createStoreTitleId}
        onCancel={(event) => {
          event.preventDefault();
          closeCreate();
        }}
      >
        <form
          method="dialog"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <header className="dashboard-cosmic-dialog__header">
            <div>
              <span className="dashboard-cosmic-kicker">Nuevo proyecto</span>
              <h2 id={createStoreTitleId}>Crear tienda</h2>
            </div>
            <IconButton icon={X} label="Cerrar creación" onClick={closeCreate} />
          </header>
          <ol className="create-store__steps" aria-label="Pasos para preparar la tienda">
            <li className={step >= 1 ? "is-active" : ""}>1 Marca</li>
            <li className={step >= 2 ? "is-active" : ""}>2 Identidad y assets</li>
            <li className={step >= 3 ? "is-active" : ""}>3 Catálogo</li>
            <li className={step >= 4 ? "is-active" : ""}>4 Revisión</li>
          </ol>
          {createError ? <InlineError>{createError}</InlineError> : null}
          <Field label="Nueva tienda">
            <input
              ref={nameInputRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre comercial"
              autoComplete="organization"
            />
          </Field>
          {step >= 2 ? (
            <Field label="Nombre visible de la marca">
              <input
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                placeholder={name || "Nombre de marca"}
                autoComplete="organization"
              />
            </Field>
          ) : null}
          {step === 2 ? (
            <p className="dashboard-cosmic-dialog__summary">
              La plantilla deja listos los textos, la navegación y los espacios para tus imágenes.
            </p>
          ) : null}
          {step >= 3 ? (
            <div className="create-store__contact-fields">
              <Field label="Email de contacto (opcional)">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="hola@tumarca.com"
                  autoComplete="email"
                />
              </Field>
              <Field label="WhatsApp (opcional)">
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="5491123456789"
                  autoComplete="tel"
                  inputMode="tel"
                />
              </Field>
              <p className="dashboard-cosmic-dialog__summary">
                El catálogo comienza vacío. Después podrás importar un CSV o cargar productos
                manualmente.
              </p>
            </div>
          ) : null}
          {step === 4 ? (
            <p className="dashboard-cosmic-dialog__summary" aria-live="polite">
              Vas a crear una tienda vacía con el diseño Catalog Modern. La demo de 50 productos
              queda disponible como proyecto separado.
            </p>
          ) : null}
          <footer className="dashboard-cosmic-dialog__actions">
            {step > 1 ? (
              <Button
                variant="quiet"
                type="button"
                onClick={() => setStep((current) => (current - 1) as 1 | 2 | 3 | 4)}
              >
                Atrás
              </Button>
            ) : null}
            <Button variant="primary" icon={Plus} disabled={creatingProject} type="submit">
              {creatingProject ? "Creando" : step === 4 ? "Crear tienda vacía" : "Continuar"}
            </Button>
          </footer>
        </form>
      </dialog>

      <dialog
        ref={shutdownDialogRef}
        className="shutdown-dialog shutdown-dialog--cosmic"
        aria-labelledby={shutdownTitleId}
        onCancel={(event) => {
          event.preventDefault();
          if (shutdownState !== "closing") setShutdownDialogOpen(false);
        }}
      >
        <form
          method="dialog"
          onSubmit={(event) => {
            event.preventDefault();
            if (shutdownState !== "closing") void requestShutdown();
          }}
        >
          <p className="shutdown-dialog__eyebrow">Sesión local</p>
          <h2 id={shutdownTitleId}>¿Cerrar SolaraCommerce?</h2>
          <p>Se detendrá el servidor local. Tus tiendas y respaldos no se borran.</p>
          {shutdownError ? <InlineError>{shutdownError}</InlineError> : null}
          <div className="shutdown-dialog__actions">
            <Button
              variant="quiet"
              type="button"
              disabled={shutdownState === "closing"}
              onClick={() => setShutdownDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="danger" type="submit" disabled={shutdownState === "closing"}>
              {shutdownState === "closing" ? "Cerrando..." : "Cerrar y detener"}
            </Button>
          </div>
        </form>
      </dialog>
    </main>
  );
}
