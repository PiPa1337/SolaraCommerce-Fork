/**
 * Shell del editor: coordina historial undo/redo, navegación entre herramientas,
 * preview y guardado. Los editores de cada pestaña modifican el proyecto a
 * través de este estado; no deben persistir directamente por fuera de sus
 * contratos de comandos o del controlador de guardado.
 */
import {
  ArrowLeft,
  ArrowUDownLeft,
  ArrowUDownRight,
  BoxArrowDown,
  ClipboardText,
  FloppyDisk,
  Image,
  Layout,
  MagnifyingGlass,
  Package,
  PaintBrush,
  Storefront,
  X,
} from "@phosphor-icons/react";
import {
  createHistory,
  type DomainCommand,
  executeCommand,
  type HistoryState,
  redo,
  undo,
} from "@solara/core";
import { type StoreProjectV1, StoreProjectV1Schema } from "@solara/project-schema";
import { motion } from "motion/react";
import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { IconButton } from "../components/Ui";
import { AutosaveQueue, type AutosaveState } from "../lib/autosave";
import type { LocalSaveReceipt } from "../lib/localStorage";
import { downloadBlob } from "../lib/projectArchive";
import { saveProject } from "../lib/repository";
import { createProjectArchiveInWorker } from "../lib/workers";
import { Assets } from "./Assets";
import { Builder } from "./Builder";
import { Catalog } from "./Catalog";
import { ExportPanel } from "./Export";
import { GuidedOverview } from "./GuidedOverview";
import { Overview } from "./Overview";
import { getPreviewRoutes, Preview, type PreviewSize, PreviewToolbar } from "./Preview";
import { Seo } from "./Seo";
import { ThemeEditor } from "./ThemeEditor";

const ManagedPersistenceControls = lazy(() =>
  import("./ManagedPersistenceControls").then(({ ManagedPersistenceControls: Component }) => ({
    default: Component,
  })),
);

type StudioTab =
  | "guided"
  | "overview"
  | "catalog"
  | "builder"
  | "theme"
  | "assets"
  | "seo"
  | "export";
const tabs: Array<{ id: StudioTab; label: string; icon: typeof Storefront }> = [
  { id: "guided", label: "Preparar", icon: ClipboardText },
  { id: "overview", label: "Resumen", icon: Storefront },
  { id: "catalog", label: "Catálogo", icon: Package },
  { id: "builder", label: "Constructor", icon: Layout },
  { id: "theme", label: "Tema", icon: PaintBrush },
  { id: "assets", label: "Recursos", icon: Image },
  { id: "seo", label: "SEO", icon: MagnifyingGlass },
  { id: "export", label: "Exportar", icon: BoxArrowDown },
];

export function Studio({
  initialProject,
  onBack,
  onProjectImported,
  managedStorage = false,
  diskVersion = null,
  diskBaseProject,
  onDiskSaved,
}: {
  initialProject: StoreProjectV1;
  onBack(): void;
  onProjectImported(project: StoreProjectV1): Promise<void>;
  managedStorage?: boolean;
  diskVersion?: number | null;
  diskBaseProject?: StoreProjectV1;
  onDiskSaved?(receipt: LocalSaveReceipt): void;
}) {
  const [history, setHistory] = useState<HistoryState>(() => createHistory(initialProject));
  const [tab, setTab] = useState<StudioTab>("guided");
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewRoute, setPreviewRoute] = useState("/");
  const [previewSize, setPreviewSize] = useState<PreviewSize>("desktop");
  const [advancedMode, setAdvancedMode] = useState(false);
  const [saveState, setSaveState] = useState<AutosaveState>("saved");
  const [validationError, setValidationError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [managedDirty, setManagedDirty] = useState(false);
  const [autosave] = useState(() => new AutosaveQueue(saveProject, 550));
  const editorPaneId = useId();
  const lastProjectRef = useRef(initialProject);
  const project = history.present;
  const previewRoutes = useMemo(() => getPreviewRoutes(project), [project]);

  useEffect(() => {
    if (!previewRoutes.some((item) => item.path === previewRoute)) setPreviewRoute("/");
  }, [previewRoutes, previewRoute]);

  useEffect(() => {
    return autosave.subscribe(setSaveState);
  }, [autosave]);

  useEffect(() => {
    if (project === lastProjectRef.current) return;
    lastProjectRef.current = project;
    if (!managedStorage) autosave.schedule(project);
  }, [autosave, managedStorage, project]);

  useEffect(() => {
    const warnBeforeClose = (event: BeforeUnloadEvent) => {
      const hasChanges = managedStorage ? managedDirty : autosave.hasUnsavedChanges;
      if (!hasChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeClose);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeClose);
      autosave.dispose();
    };
  }, [autosave, managedDirty, managedStorage]);

  const leaveStudio = async () => {
    if (
      managedStorage &&
      managedDirty &&
      !window.confirm("Hay cambios sin guardar. ¿Salir sin guardar?")
    ) {
      return;
    }
    setLeaving(true);
    try {
      await autosave.flush();
      onBack();
    } catch {
      setSaveState("error");
      setLeaving(false);
    }
  };

  const replaceProject = useCallback((next: StoreProjectV1) => {
    const result = StoreProjectV1Schema.safeParse(next);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue?.path.join(".") || "project";
      setValidationError(`${path}: ${issue?.message ?? "Proyecto inválido."}`);
      return;
    }
    setValidationError("");
    setHistory((current) => {
      if (result.data === current.present) return current;
      return { past: [...current.past, current.present], present: result.data, future: [] };
    });
  }, []);

  const runCommand = useCallback((command: DomainCommand) => {
    setHistory((current) => executeCommand(current, command));
  }, []);

  const renderTab = () => {
    switch (tab) {
      case "guided":
        return (
          <GuidedOverview
            project={project}
            onNavigate={(destination) => {
              if (destination === "builder") setAdvancedMode(true);
              setTab(destination);
            }}
            onApplyUpgrade={(nextProject) => {
              void (async () => {
                try {
                  await autosave.flush();
                  const archive = await createProjectArchiveInWorker(project);
                  downloadBlob(
                    archive,
                    `${project.slug}-antes-de-actualizar.solara.json`,
                    "application/vnd.solara.project+json",
                  );
                  replaceProject(nextProject);
                } catch (reason) {
                  setValidationError(
                    reason instanceof Error
                      ? `No se pudo crear el respaldo: ${reason.message}`
                      : "No se pudo crear el respaldo antes de actualizar.",
                  );
                }
              })();
            }}
          />
        );
      case "overview":
        return <Overview project={project} onChange={replaceProject} />;
      case "catalog":
        return <Catalog project={project} onCommand={runCommand} onChange={replaceProject} />;
      case "builder":
        return (
          <Builder
            project={project}
            onChange={replaceProject}
            protectedBase={!advancedMode && project.origin?.seed === "clean"}
          />
        );
      case "theme":
        return <ThemeEditor project={project} onChange={replaceProject} />;
      case "assets":
        return <Assets project={project} onChange={replaceProject} />;
      case "seo":
        return <Seo project={project} onChange={replaceProject} />;
      case "export":
        return (
          <ExportPanel
            project={project}
            onImport={async (imported) => {
              await autosave.flush();
              await onProjectImported(imported);
              setHistory(createHistory(imported));
            }}
          />
        );
    }
  };

  return (
    <div className="studio-shell">
      <header className="studio-topbar">
        <div className="studio-brand">
          <IconButton
            icon={ArrowLeft}
            label="Volver a tiendas"
            disabled={leaving}
            onClick={() => void leaveStudio()}
          />
          <span className="brand-mark" aria-hidden>
            S
          </span>
          <div>
            <strong>{project.name}</strong>
            <small>{project.baseUrl}</small>
          </div>
        </div>
        <PreviewToolbar
          routes={previewRoutes}
          route={previewRoute}
          size={previewSize}
          onRouteChange={setPreviewRoute}
          onSizeChange={setPreviewSize}
          onOpenEditor={() => setEditorOpen(true)}
        />
        <div className="studio-topbar-actions">
          {managedStorage ? (
            <Suspense
              fallback={
                <div className="save-status">
                  <output className="save-indicator save-indicator--saved" aria-live="polite">
                    <FloppyDisk aria-hidden size={16} />
                    Guardado
                  </output>
                </div>
              }
            >
              <ManagedPersistenceControls
                project={project}
                diskVersion={diskVersion}
                {...(diskBaseProject ? { diskBaseProject } : {})}
                validationError={validationError}
                onDirtyChange={setManagedDirty}
                onError={setValidationError}
                {...(onDiskSaved ? { onSaved: onDiskSaved } : {})}
              />
            </Suspense>
          ) : (
            <div className="save-status">
              <output className={`save-indicator save-indicator--${saveState}`} aria-live="polite">
                <FloppyDisk aria-hidden size={16} />
                {saveState === "saved"
                  ? "Guardado"
                  : saveState === "pending"
                    ? "Cambios pendientes"
                    : saveState === "saving"
                      ? "Guardando"
                      : "Error al guardar"}
              </output>
              {saveState === "error" ? (
                <button
                  type="button"
                  className="save-retry"
                  onClick={() => void autosave.flush().catch(() => undefined)}
                >
                  Reintentar
                </button>
              ) : null}
            </div>
          )}
          <div className="history-actions">
            <IconButton
              icon={ArrowUDownLeft}
              label="Deshacer"
              disabled={history.past.length === 0}
              onClick={() => setHistory((current) => undo(current))}
            />
            <IconButton
              icon={ArrowUDownRight}
              label="Rehacer"
              disabled={history.future.length === 0}
              onClick={() => setHistory((current) => redo(current))}
            />
          </div>
        </div>
      </header>

      <nav className="studio-nav" aria-label="Áreas de la tienda">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            aria-current={tab === id ? "page" : undefined}
            aria-controls={editorPaneId}
            aria-expanded={tab === id ? editorOpen : false}
            onClick={() => {
              if (id !== "guided") setAdvancedMode(true);
              else setAdvancedMode(false);
              setTab(id);
              setEditorOpen(true);
            }}
          >
            <Icon aria-hidden size={19} weight={tab === id ? "fill" : "regular"} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="studio-workspace">
        <motion.main
          id={editorPaneId}
          data-studio-editor-pane
          aria-label="Panel de edición"
          aria-hidden={!editorOpen}
          className={`editor-pane${editorOpen ? " editor-pane--open" : " editor-pane--closed"}`}
          key={tab}
          initial={false}
        >
          <IconButton
            className="editor-pane-close"
            icon={X}
            label="Cerrar panel de edición"
            onClick={() => setEditorOpen(false)}
          />
          {renderTab()}
        </motion.main>
        <Preview project={project} route={previewRoute} size={previewSize} />
      </div>
    </div>
  );
}
