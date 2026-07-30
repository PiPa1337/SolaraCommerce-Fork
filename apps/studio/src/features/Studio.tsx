import {
  ArrowLeft,
  ArrowUDownLeft,
  ArrowUDownRight,
  BoxArrowDown,
  FloppyDisk,
  Image,
  Layout,
  MagnifyingGlass,
  Package,
  PaintBrush,
  Storefront,
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
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconButton } from "../components/Ui";
import { AutosaveQueue, type AutosaveState } from "../lib/autosave";
import { saveProject } from "../lib/repository";
import { Assets } from "./Assets";
import { Builder } from "./Builder";
import { Catalog } from "./Catalog";
import { ExportPanel } from "./Export";
import { Overview } from "./Overview";
import { Preview } from "./Preview";
import { Seo } from "./Seo";
import { ThemeEditor } from "./ThemeEditor";

type StudioTab = "overview" | "catalog" | "builder" | "theme" | "assets" | "seo" | "export";
const tabs: Array<{ id: StudioTab; label: string; icon: typeof Storefront }> = [
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
}: {
  initialProject: StoreProjectV1;
  onBack(): void;
  onProjectImported(project: StoreProjectV1): Promise<void>;
}) {
  const [history, setHistory] = useState<HistoryState>(() => createHistory(initialProject));
  const [tab, setTab] = useState<StudioTab>("overview");
  const [saveState, setSaveState] = useState<AutosaveState>("saved");
  const [validationError, setValidationError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [autosave] = useState(() => new AutosaveQueue(saveProject, 550));
  const lastProjectRef = useRef(initialProject);
  const reduceMotion = useReducedMotion();
  const project = history.present;

  useEffect(() => {
    return autosave.subscribe(setSaveState);
  }, [autosave]);

  useEffect(() => {
    if (project === lastProjectRef.current) return;
    lastProjectRef.current = project;
    autosave.schedule(project);
  }, [autosave, project]);

  useEffect(() => {
    const warnBeforeClose = (event: BeforeUnloadEvent) => {
      if (!autosave.hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeClose);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeClose);
      autosave.dispose();
    };
  }, [autosave]);

  const leaveStudio = async () => {
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
      case "overview":
        return <Overview project={project} onChange={replaceProject} />;
      case "catalog":
        return <Catalog project={project} onCommand={runCommand} />;
      case "builder":
        return <Builder project={project} onChange={replaceProject} />;
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
        <div className="save-status">
          {validationError ? (
            <output
              className="save-indicator save-indicator--error"
              aria-live="assertive"
              title={validationError}
            >
              Cambio inválido
            </output>
          ) : null}
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
      </header>

      <nav className="studio-nav" aria-label="Áreas de la tienda">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            <Icon aria-hidden size={19} weight={tab === id ? "fill" : "regular"} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="studio-workspace">
        <motion.main
          className="editor-pane"
          key={tab}
          initial={reduceMotion ? false : { opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18 }}
        >
          {renderTab()}
        </motion.main>
        <Preview project={project} />
      </div>
    </div>
  );
}
