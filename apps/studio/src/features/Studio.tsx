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
import type { Product, StoreProjectV1 } from "@solara/project-schema";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { IconButton } from "../components/Ui";
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
type SaveState = "saved" | "pending" | "saving" | "error";

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
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const reduceMotion = useReducedMotion();
  const project = history.present;

  useEffect(() => {
    setHistory(createHistory(initialProject));
  }, [initialProject]);

  useEffect(() => {
    setSaveState("pending");
    const timeout = window.setTimeout(() => {
      setSaveState("saving");
      void saveProject(project)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 550);
    return () => window.clearTimeout(timeout);
  }, [project]);

  const replaceProject = useCallback((next: StoreProjectV1) => {
    setHistory((current) => {
      if (next === current.present) return current;
      return { past: [...current.past, current.present], present: next, future: [] };
    });
  }, []);

  const runCommand = useCallback((command: DomainCommand) => {
    setHistory((current) => executeCommand(current, command));
  }, []);

  const replaceProducts = useCallback(
    (products: Product[]) => {
      const timestamp = new Date().toISOString();
      replaceProject({
        ...project,
        products,
        categories: project.categories.map((category) => ({
          ...category,
          productIds: products
            .filter((product) => product.categoryIds.includes(category.id))
            .map((product) => product.id),
        })),
        collections: project.collections.map((collection) => ({
          ...collection,
          productIds: products
            .filter((product) => product.collectionIds.includes(collection.id))
            .map((product) => product.id),
        })),
        updatedAt: timestamp,
      });
    },
    [project, replaceProject],
  );

  const renderTab = () => {
    switch (tab) {
      case "overview":
        return <Overview project={project} onChange={replaceProject} />;
      case "catalog":
        return (
          <Catalog project={project} onCommand={runCommand} onReplaceProducts={replaceProducts} />
        );
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
          <IconButton icon={ArrowLeft} label="Volver a tiendas" onClick={onBack} />
          <span className="brand-mark" aria-hidden>
            S
          </span>
          <div>
            <strong>{project.name}</strong>
            <small>{project.baseUrl}</small>
          </div>
        </div>
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
