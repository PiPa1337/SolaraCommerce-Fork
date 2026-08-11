/**
 * Shell del editor: coordina historial undo/redo, navegación entre herramientas,
 * preview y guardado. Los editores de cada pestaña modifican el proyecto a
 * través de este estado; no deben persistir directamente por fuera de sus
 * contratos de comandos o del controlador de guardado.
 */
import {
  ArrowLeft,
  ArrowsInSimple,
  ArrowsOutSimple,
  ArrowUDownLeft,
  ArrowUDownRight,
  BoxArrowDown,
  CheckCircle,
  ClipboardText,
  FloppyDisk,
  Image,
  Layout,
  MagnifyingGlass,
  Moon,
  Package,
  PaintBrush,
  Storefront,
  Sun,
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
import { motion, useReducedMotion } from "motion/react";
import {
  type KeyboardEvent,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Tooltip } from "../components/primitives";
import { Button, IconButton, InlineError } from "../components/Ui";
import { AutosaveQueue, type AutosaveState } from "../lib/autosave";
import { readExportHistory } from "../lib/exportHistory";
import type { LocalSaveReceipt, LocalStorageError } from "../lib/localStorage";
import { downloadBlob } from "../lib/projectArchive";
import { saveProject } from "../lib/repository";
import { formatSaveTime } from "../lib/saveTime";
import { formatLastExportLabel } from "../lib/statusBar";
import { createProjectArchiveInWorker } from "../lib/workers";
import { Assets } from "./Assets";
import { Builder } from "./Builder";
import { Catalog } from "./Catalog";
import { ExportPanel } from "./Export";
import { GuidedOverview } from "./GuidedOverview";
import { Overview } from "./Overview";
import {
  getPreviewRoutes,
  Preview,
  type PreviewSize,
  PreviewToolbar,
  type PreviewZoom,
} from "./Preview";
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

// Referencias estables para la transición del indicador de tab: el shell
// recrea el objeto inline en cada render y obliga a motion a re-renderizar.
const NAV_INDICATOR_TRANSITION = { type: "spring", stiffness: 420, damping: 34 } as const;
const NAV_INDICATOR_TRANSITION_STILL = { duration: 0 } as const;

interface StudioTabContentProps {
  tab: StudioTab;
  project: StoreProjectV1;
  advancedMode: boolean;
  replaceProject(next: StoreProjectV1): void;
  runCommand(command: DomainCommand): void;
  onNavigate(destination: StudioTab): void;
  onApplyUpgrade(nextProject: StoreProjectV1): void;
  onToggleAdvancedMode(): void;
  onEnableAdvanced(): void;
  onImport(project: StoreProjectV1): Promise<void>;
  onOpenSite?: ((id: string) => Promise<void>) | undefined;
}

// El contenido de la pestaña activa sólo se recalcula cuando cambia su
// entrada (proyecto, tab o modo). Los re-renders del shell por estado de
// guardado, marca de sucio o avisos no vuelven a montar el editor completo.
const StudioTabContent = memo(function StudioTabContent({
  tab,
  project,
  advancedMode,
  replaceProject,
  runCommand,
  onNavigate,
  onApplyUpgrade,
  onToggleAdvancedMode,
  onEnableAdvanced,
  onImport,
  onOpenSite,
}: StudioTabContentProps) {
  switch (tab) {
    case "guided":
      return (
        <GuidedOverview
          project={project}
          advancedMode={advancedMode}
          onNavigate={onNavigate}
          onToggleAdvancedMode={onToggleAdvancedMode}
          onApplyUpgrade={onApplyUpgrade}
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
          advancedMode={advancedMode}
          onEnableAdvanced={onEnableAdvanced}
        />
      );
    case "theme":
      return <ThemeEditor project={project} onChange={replaceProject} />;
    case "assets":
      return <Assets project={project} onChange={replaceProject} />;
    case "seo":
      return <Seo project={project} onChange={replaceProject} onNavigate={onNavigate} />;
    case "export":
      return (
        <ExportPanel
          project={project}
          onImport={onImport}
          onNavigate={onNavigate}
          {...(onOpenSite ? { onOpenSite } : {})}
        />
      );
  }
});

// El preview no se re-renderiza cuando el shell cambia estado (guardado,
// avisos, ticks): su entrada es sólo el proyecto y la configuración de ruta.
const MemoizedPreview = memo(function MemoizedPreview({
  project,
  route,
  size,
  zoom,
}: {
  project: StoreProjectV1;
  route: string;
  size: PreviewSize;
  zoom: PreviewZoom;
}) {
  return <Preview project={project} route={route} size={size} zoom={zoom} />;
});

export function Studio({
  initialProject,
  onBack,
  onProjectImported,
  managedStorage = false,
  diskVersion = null,
  diskBaseProject,
  onDiskSaved,
  onReloadFromDisk,
  onDuplicateDraft,
  onOpenSite,
}: {
  initialProject: StoreProjectV1;
  onBack(): void;
  onProjectImported(project: StoreProjectV1): Promise<void>;
  managedStorage?: boolean;
  diskVersion?: number | null;
  diskBaseProject?: StoreProjectV1;
  onDiskSaved?(receipt: LocalSaveReceipt): void;
  onReloadFromDisk?(): Promise<{ ok: true } | { ok: false; message: string }>;
  onDuplicateDraft?(
    project: StoreProjectV1,
  ): Promise<{ ok: true } | { ok: false; message: string }>;
  onOpenSite?(id: string): Promise<void>;
}) {
  const [history, setHistory] = useState<HistoryState>(() => createHistory(initialProject));
  const [tab, setTab] = useState<StudioTab>("guided");
  const [editorOpen, setEditorOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(`solara-editor-pane:${initialProject.id}`) === "open";
    } catch {
      return false;
    }
  });
  const [previewRoute, setPreviewRoute] = useState("/");
  const [previewSize, setPreviewSize] = useState<PreviewSize>("desktop");
  const [previewZoom, setPreviewZoom] = useState<PreviewZoom>(() => {
    try {
      const stored = Number(window.sessionStorage.getItem("solara-preview-zoom"));
      if (stored === 100 || stored === 75 || stored === 50) return stored;
    } catch {
      // Sesión no disponible: el zoom arranca en 100%.
    }
    return 100;
  });
  const [advancedMode, setAdvancedMode] = useState(false);
  const [saveState, setSaveState] = useState<AutosaveState>("saved");
  const [validationError, setValidationError] = useState("");
  const [conflict, setConflict] = useState<LocalStorageError | null>(null);

  // Trampa de foco del diálogo de conflicto: foco inicial al abrir, ciclo de
  // Tab dentro del diálogo y restauración al cerrar (T4.12/fix 409). El
  // navegador desenfoca el botón Guardar cuando pasa a disabled durante el
  // guardado y el activeElement capturado sería body: se recupera el opener
  // real (botón Guardar) como respaldo para que el restauro nunca caiga en
  // body (fixme A21/A14). El botón puede quedar disabled mientras el conflicto
  // está visible; se guarda igual porque se vuelve enfocable al cerrar.
  const conflictDialogRef = useRef<HTMLDivElement>(null);
  const conflictOpenerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!conflict) return;
    const active = document.activeElement;
    const saveButton = document.querySelector<HTMLElement>("[data-studio-save]");
    conflictOpenerRef.current =
      active instanceof HTMLElement &&
      active !== document.body &&
      !active.hasAttribute("disabled") &&
      !active.hasAttribute("inert")
        ? active
        : saveButton;
    setConfirmLeave(false);
    const firstFocusable =
      conflictDialogRef.current?.querySelector<HTMLElement>("button:not([disabled])");
    (firstFocusable ?? conflictDialogRef.current)?.focus();
  }, [conflict]);
  useEffect(() => {
    if (conflict) return;
    conflictOpenerRef.current?.focus();
    conflictOpenerRef.current = null;
  }, [conflict]);

  const keepConflictDraft = useCallback(() => {
    setConflict(null);
    setNotice(
      "Borrador conservado en este navegador. Al abrir la tienda otra vez podés recuperarlo, o duplicar el borrador para continuar en una copia.",
    );
  }, []);

  const trapConflictFocus = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      keepConflictDraft();
      return;
    }
    if (event.key !== "Tab" || !conflictDialogRef.current) return;
    const focusable = Array.from(
      conflictDialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])"),
    );
    if (focusable.length === 0) return;
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const [notice, setNotice] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [managedDirty, setManagedDirty] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [lastExportedAt, setLastExportedAt] = useState("");
  const [exportTick, setExportTick] = useState(0);
  const [lastVisitedAt, setLastVisitedAt] = useState<Partial<Record<StudioTab, string>>>(() =>
    tabs.reduce(
      (acc, item) => {
        acc[item.id] = initialProject.updatedAt;
        return acc;
      },
      {} as Partial<Record<StudioTab, string>>,
    ),
  );
  const [theme, setTheme] = useState<"light" | "dark" | null>(() => {
    try {
      const stored = window.localStorage.getItem("solara-studio-theme");
      return stored === "dark" ? "dark" : stored === "light" ? "light" : null;
    } catch {
      return null;
    }
  });
  // El tema efectivo resuelve el override almacenado contra la preferencia del
  // sistema: sin override el chrome sigue al media query y el toggle debe
  // ofrecer (y reflejar) el tema que realmente está aplicado (A14).
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  const resolvedTheme: "light" | "dark" = theme ?? (systemPrefersDark ? "dark" : "light");
  const [autosave] = useState(() => new AutosaveQueue(saveProject, 550));
  const editorPaneId = useId();
  const conflictTitleId = useId();
  const focusToggleId = useId();
  const focusExitId = useId();
  const lastProjectRef = useRef(initialProject);
  const previousSaveStateRef = useRef<AutosaveState>("saved");
  // El pane sólo se reabre por un cambio de pestaña cuando el usuario no lo
  // cerró explícitamente en esta sesión (H3-B3: el estado cerrado se conserva).
  const paneClosedByUserRef = useRef(false);
  // Scroll por pestaña del panel de edición (H3-B2): el pane no se remonta y
  // cada pestaña recupera su posición al volver.
  const paneScrollPositionsRef = useRef<Partial<Record<StudioTab, number>>>({});
  const paneRef = useRef<HTMLElement | null>(null);
  // Transición sucio → guardado: la marca de "todo visitado" sólo se aplica
  // cuando un guardado termina, nunca en el commit del cambio (H3-B1).
  const dirtyRef = useRef(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const project = history.present;
  // La ruta del preview no se descarta en silencio cuando sale de la muestra
  // de getPreviewRoutes: renderPreviewHtml resuelve cualquier página real del
  // sitio (p. ej. /envios/ fuera del datalist) y cae a la página inicial para
  // rutas inexistentes (fixme A20/A14). Sin efecto de reset, la ruta
  // commiteada en el selector se conserva y el srcdoc la renderiza.
  const previewRoutes = useMemo(() => getPreviewRoutes(project), [project]);
  const paneStorageKey = useMemo(
    () => `solara-editor-pane:${initialProject.id}`,
    [initialProject.id],
  );
  const reduceMotion = useReducedMotion();
  // biome-ignore lint/correctness/useExhaustiveDependencies: exportTick fuerza el recálculo del rótulo al volver a la ventana (focus y visibilitychange), así no queda viejo tras exportar.
  const lastExportLabel = useMemo(
    () =>
      formatLastExportLabel(
        readExportHistory(project.slug),
        lastExportedAt || null,
        new Date().toISOString(),
      ),
    [exportTick, lastExportedAt, project.slug],
  );

  const setPaneOpen = useCallback(
    (open: boolean) => {
      paneClosedByUserRef.current = !open;
      setEditorOpen(open);
      try {
        window.localStorage.setItem(paneStorageKey, open ? "open" : "closed");
      } catch {
        // Almacenamiento bloqueado: el colapso se conserva sólo en memoria.
      }
    },
    [paneStorageKey],
  );

  const changePreviewZoom = useCallback((zoom: PreviewZoom) => {
    setPreviewZoom(zoom);
    try {
      window.sessionStorage.setItem("solara-preview-zoom", String(zoom));
    } catch {
      // Sesión no disponible: el zoom se conserva sólo en memoria.
    }
  }, []);

  useEffect(() => {
    return autosave.subscribe(setSaveState);
  }, [autosave]);

  useEffect(() => {
    const wasWorking =
      previousSaveStateRef.current === "saving" || previousSaveStateRef.current === "pending";
    previousSaveStateRef.current = saveState;
    if (wasWorking && saveState === "saved") setLastSavedAt(Date.now());
  }, [saveState]);

  useEffect(() => {
    const handlePaneShortcut = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key !== "\\") return;
      event.preventDefault();
      setEditorOpen((current) => {
        const next = !current;
        paneClosedByUserRef.current = !next;
        try {
          window.localStorage.setItem(paneStorageKey, next ? "open" : "closed");
        } catch {
          // Almacenamiento bloqueado: el colapso se conserva sólo en memoria.
        }
        return next;
      });
    };
    window.addEventListener("keydown", handlePaneShortcut);
    return () => window.removeEventListener("keydown", handlePaneShortcut);
  }, [paneStorageKey]);

  useEffect(() => {
    const bumpExportTick = () => {
      // Pestaña oculta: nada pinta ni necesita releer el historial de
      // exportación. El rótulo se refresca al volver a ser visible.
      if (document.visibilityState === "hidden") return;
      setExportTick((current) => current + 1);
    };
    window.addEventListener("focus", bumpExportTick);
    document.addEventListener("visibilitychange", bumpExportTick);
    return () => {
      window.removeEventListener("focus", bumpExportTick);
      document.removeEventListener("visibilitychange", bumpExportTick);
    };
  }, []);

  const dirtyTabs = useMemo(() => {
    const updatedAt = project.updatedAt;
    return new Set(
      tabs
        .filter((item) => item.id !== tab && (lastVisitedAt[item.id] ?? "") < updatedAt)
        .map((item) => item.id),
    );
  }, [lastVisitedAt, project.updatedAt, tab]);

  useEffect(() => {
    setLastVisitedAt((current) => {
      if (current[tab] === project.updatedAt) return current;
      return { ...current, [tab]: project.updatedAt };
    });
  }, [project.updatedAt, tab]);

  // El panel no se remonta al cambiar de pestaña (H3-B2): conserva el DOM y
  // su scroll; al volver a una pestaña se restaura la posición guardada.
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    pane.scrollTop = paneScrollPositionsRef.current[tab] ?? 0;
  }, [tab]);

  // Cerrar el pane no puede dejar el foco en contenido oculto: si el foco
  // estaba dentro del panel cuando se cierra (X o Ctrl+\) se devuelve al tab
  // activo, dueño del panel según aria-controls (A14).
  useEffect(() => {
    if (editorOpen) return;
    const pane = paneRef.current;
    const active = document.activeElement;
    if (active instanceof HTMLElement && pane !== null && pane.contains(active)) {
      document.getElementById(`studio-tab-${tab}`)?.focus();
    }
  }, [editorOpen, tab]);

  useEffect(() => {
    const dirty = managedStorage ? managedDirty : saveState !== "saved";
    const wasDirty = dirtyRef.current;
    dirtyRef.current = dirty;
    // La marca de "todo visitado" se aplica sólo en la transición
    // sucio → guardado. En el commit del cambio (mismo render con saveState
    // todavía "saved", antes del aviso de schedule) no hay transición, así el
    // wipe no borra el punto antes de que renderice.
    if (!wasDirty || dirty) return;
    setLastVisitedAt((current) => {
      let changed = false;
      const next = { ...current };
      for (const item of tabs) {
        if (next[item.id] !== project.updatedAt) {
          next[item.id] = project.updatedAt;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [managedDirty, managedStorage, project.updatedAt, saveState]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === null) root.removeAttribute("data-studio-theme");
    else root.setAttribute("data-studio-theme", theme);
  }, [theme]);

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
    return () => window.removeEventListener("beforeunload", warnBeforeClose);
  }, [autosave, managedDirty, managedStorage]);

  useEffect(() => () => autosave.dispose(), [autosave]);

  const performLeave = async () => {
    setLeaving(true);
    try {
      await autosave.flush();
      onBack();
    } catch {
      setSaveState("error");
      setLeaving(false);
    }
  };

  const requestLeave = () => {
    if (managedStorage && managedDirty) {
      setConfirmLeave(true);
      return;
    }
    void performLeave();
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

  const navigateFromGuided = useCallback(
    (destination: StudioTab) => {
      if (destination === "builder") setAdvancedMode(true);
      setTab(destination);
      setPaneOpen(true);
    },
    [setPaneOpen],
  );

  // Toggle de Preparar (contrato PT4, Opción A): además de navegar al
  // Constructor, enciende/apaga el Modo avanzado para que el estado sea
  // visible y reversible desde el propio control que lo activa.
  const toggleAdvancedMode = useCallback(() => {
    setAdvancedMode((current) => !current);
    setTab("builder");
    setPaneOpen(true);
  }, [setPaneOpen]);

  const enableAdvancedMode = useCallback(() => setAdvancedMode(true), []);

  const applyGuidedUpgrade = useCallback(
    (nextProject: StoreProjectV1) => {
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
    },
    [autosave, project, replaceProject],
  );

  const importFromExport = useCallback(
    async (imported: StoreProjectV1) => {
      await autosave.flush();
      await onProjectImported(imported);
      setHistory(createHistory(imported));
    },
    [autosave, onProjectImported],
  );

  const selectTab = useCallback(
    (nextId: StudioTab, focusTab = false) => {
      // El Modo avanzado es estado de sesión del shell (contrato PT4, Opción A):
      // persiste entre TODAS las pestañas (incluido Preparar) para que haya un
      // único estado observable, independiente del camino. Nace en `false` al
      // abrir la tienda y no sobrevive a recargas; se activa desde el flujo
      // guiado (navigateFromGuided), desde el toggle de Preparar o desde el
      // botón Desbloquear del Constructor, y se apaga con el mismo toggle.
      setTab(nextId);
      setLastVisitedAt((current) => ({ ...current, [nextId]: project.updatedAt }));
      // El pane conserva su estado al cambiar de pestaña (H3-B3): sólo se
      // abre si el usuario no lo cerró explícitamente en esta sesión.
      if (!paneClosedByUserRef.current) setPaneOpen(true);
      if (focusTab) {
        requestAnimationFrame(() => {
          const tabElement = document.getElementById(`studio-tab-${nextId}`);
          tabElement?.focus();
          tabElement?.scrollIntoView({ block: "nearest", inline: "nearest" });
        });
      }
    },
    [project.updatedAt, setPaneOpen],
  );

  const toggleFocusMode = useCallback(() => {
    if (focusMode) {
      setFocusMode(false);
      requestAnimationFrame(() => {
        document.getElementById(focusToggleId)?.focus();
      });
    } else {
      setFocusMode(true);
      requestAnimationFrame(() => {
        document.getElementById(focusExitId)?.focus();
      });
    }
  }, [focusExitId, focusMode, focusToggleId]);

  const toggleTheme = useCallback(() => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      window.localStorage.setItem("solara-studio-theme", next);
    } catch {
      // Almacenamiento bloqueado: el tema se conserva sólo en memoria.
    }
  }, [resolvedTheme]);

  const handleDiskSaved = useCallback(
    (receipt: LocalSaveReceipt) => {
      if (receipt.site?.savedAt) setLastExportedAt(receipt.site.savedAt);
      onDiskSaved?.(receipt);
    },
    [onDiskSaved],
  );

  // Atajos globales del shell (H3-B4/B5): Ctrl+S (modo navegador), Ctrl+Z y
  // Ctrl+Shift+Z. Escuchan en `window` y se re-registran con cleanup, así que
  // no hay doble bind. Limitación conocida (T19): el preview es un iframe con
  // su propio documento; los keydown con foco dentro del iframe no cruzan al
  // documento del Studio, por lo que los atajos no operan sobre el editor
  // mientras el foco está en el preview (el sitio público no conoce atajos).
  useEffect(() => {
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFocusMode();
        return;
      }
      if (focusMode && event.key === "Escape") {
        event.preventDefault();
        setFocusMode(false);
        requestAnimationFrame(() => {
          document.getElementById(focusToggleId)?.focus();
        });
        return;
      }
      const target = event.target as HTMLElement | null;
      const editingText =
        target !== null &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        // En modo managed el atajo vive en ManagedPersistenceControls; acá
        // sólo existe el flush del autosave del modo navegador (H3-B4).
        if (managedStorage) return;
        event.preventDefault();
        void autosave.flush().catch(() => undefined);
        return;
      }
      if (!editingText && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        // Dentro de un campo de texto manda el undo nativo del navegador;
        // fuera de él, el historial del editor (H3-B5). Sin historial no se
        // secuestra el atajo.
        if (event.shiftKey) {
          if (history.future.length === 0) return;
          event.preventDefault();
          setHistory((current) => redo(current));
        } else {
          if (history.past.length === 0) return;
          event.preventDefault();
          setHistory((current) => undo(current));
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    autosave,
    focusMode,
    focusToggleId,
    history.future.length,
    history.past.length,
    managedStorage,
    toggleFocusMode,
  ]);

  const moveTabFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = event.key === "Home" ? tabs[0] : tabs[tabs.length - 1];
      if (next) selectTab(next.id, true);
      return;
    }
    const isHorizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
    const isVertical = event.key === "ArrowUp" || event.key === "ArrowDown";
    if (!isHorizontal && !isVertical) return;
    event.preventDefault();
    const index = tabs.findIndex((item) => item.id === tab);
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    const next = tabs[(index + direction + tabs.length) % tabs.length];
    if (!next) return;
    selectTab(next.id, true);
  };

  return (
    <>
      <div
        className="studio-shell"
        data-studio-focus={focusMode || undefined}
        inert={conflict ? true : undefined}
      >
        <a className="skip-link" href={`#${editorPaneId}`}>
          Saltar al panel de edición
        </a>
        <header className="studio-topbar">
          <div className="studio-brand">
            <Tooltip tip="Volver a tiendas" position="bottom">
              <IconButton
                icon={ArrowLeft}
                label="Volver a tiendas"
                disabled={leaving}
                onClick={() => requestLeave()}
              />
            </Tooltip>
            <span className="brand-mark" aria-hidden>
              S
            </span>
            <div className="studio-brand-info">
              <nav className="studio-breadcrumb" aria-label="Navegación">
                <button
                  type="button"
                  className="studio-breadcrumb__link"
                  disabled={leaving}
                  onClick={() => requestLeave()}
                >
                  Tiendas
                </button>
                <span className="studio-breadcrumb__sep" aria-hidden>
                  /
                </span>
                <strong className="studio-breadcrumb__current" aria-current="page">
                  {project.name}
                </strong>
              </nav>
              <small>{project.baseUrl}</small>
            </div>
          </div>
          <PreviewToolbar
            routes={previewRoutes}
            route={previewRoute}
            size={previewSize}
            zoom={previewZoom}
            onRouteChange={setPreviewRoute}
            onSizeChange={setPreviewSize}
            onZoomChange={changePreviewZoom}
            onOpenEditor={() => setPaneOpen(true)}
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
                  onConflict={setConflict}
                  onSaved={handleDiskSaved}
                  blocked={conflict !== null}
                />
              </Suspense>
            ) : (
              <div className="save-status">
                <output
                  className={`save-indicator save-indicator--${saveState}`}
                  aria-live="polite"
                >
                  {saveState === "saving" ? (
                    <span className="save-spinner" aria-hidden />
                  ) : saveState === "saved" ? (
                    <CheckCircle className="save-check" aria-hidden size={16} />
                  ) : (
                    <FloppyDisk aria-hidden size={16} />
                  )}
                  {saveState === "saved"
                    ? lastSavedAt
                      ? `Guardado ${formatSaveTime(lastSavedAt)}`
                      : "Guardado"
                    : saveState === "pending"
                      ? "Cambios pendientes"
                      : saveState === "saving"
                        ? "Guardando…"
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
            <Tooltip
              tip={focusMode ? "Salir del modo foco" : "Modo foco de la vista previa"}
              position="bottom"
            >
              <IconButton
                id={focusToggleId}
                icon={focusMode ? ArrowsInSimple : ArrowsOutSimple}
                label={focusMode ? "Salir del modo foco" : "Modo foco de la vista previa"}
                aria-pressed={focusMode}
                data-testid="ui-focus-toggle"
                onClick={toggleFocusMode}
              />
            </Tooltip>
            <Tooltip
              tip={resolvedTheme === "dark" ? "Usar tema claro" : "Usar tema oscuro"}
              position="bottom"
            >
              <IconButton
                icon={resolvedTheme === "dark" ? Sun : Moon}
                label={resolvedTheme === "dark" ? "Usar tema claro" : "Usar tema oscuro"}
                aria-pressed={resolvedTheme === "dark"}
                data-testid="ui-theme-toggle"
                onClick={toggleTheme}
              />
            </Tooltip>
            <div className="history-actions">
              <Tooltip tip="Deshacer" position="bottom">
                <IconButton
                  icon={ArrowUDownLeft}
                  label="Deshacer"
                  disabled={history.past.length === 0}
                  onClick={() => setHistory((current) => undo(current))}
                />
              </Tooltip>
              <Tooltip tip="Rehacer" position="bottom">
                <IconButton
                  icon={ArrowUDownRight}
                  label="Rehacer"
                  disabled={history.future.length === 0}
                  onClick={() => setHistory((current) => redo(current))}
                />
              </Tooltip>
            </div>
          </div>
        </header>

        <nav className="studio-nav" aria-label="Áreas de la tienda">
          <div
            role="tablist"
            aria-label="Áreas de la tienda"
            aria-orientation="vertical"
            onKeyDown={moveTabFocus}
          >
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                id={`studio-tab-${id}`}
                data-testid="ui-tab"
                role="tab"
                aria-selected={tab === id}
                aria-controls={editorPaneId}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => selectTab(id)}
              >
                <Icon aria-hidden size={19} weight={tab === id ? "fill" : "regular"} />
                <span>{label}</span>
                {dirtyTabs.has(id) ? (
                  <>
                    <span className="visually-hidden">cambios sin revisar</span>
                    <span
                      className="studio-tab-dirty"
                      data-testid="ui-tab-dirty"
                      aria-hidden="true"
                      title={`${label} tiene cambios sin revisar`}
                    />
                  </>
                ) : null}
                {tab === id ? (
                  <motion.span
                    layoutId="studio-nav-indicator"
                    className="studio-nav-indicator"
                    aria-hidden
                    transition={
                      reduceMotion ? NAV_INDICATOR_TRANSITION_STILL : NAV_INDICATOR_TRANSITION
                    }
                  />
                ) : null}
              </button>
            ))}
          </div>
        </nav>

        {notice ? (
          <output className="studio-notice" data-testid="ui-studio-notice">
            <span>{notice}</span>
            <IconButton icon={X} label="Cerrar aviso" onClick={() => setNotice("")} />
          </output>
        ) : null}

        <div className="studio-workspace">
          <motion.main
            ref={paneRef}
            id={editorPaneId}
            data-studio-editor-pane
            data-tab={tab}
            role="tabpanel"
            aria-labelledby={`studio-tab-${tab}`}
            aria-hidden={!editorOpen}
            tabIndex={-1}
            className={`editor-pane${editorOpen ? " editor-pane--open" : " editor-pane--closed"}`}
            initial={false}
            onScroll={(event) => {
              paneScrollPositionsRef.current[tab] = event.currentTarget.scrollTop;
            }}
          >
            <Tooltip tip="Cerrar panel de edición" position="bottom" className="editor-pane-close">
              <IconButton
                icon={X}
                label="Cerrar panel de edición"
                onClick={() => setPaneOpen(false)}
              />
            </Tooltip>
            <StudioTabContent
              tab={tab}
              project={project}
              advancedMode={advancedMode}
              replaceProject={replaceProject}
              runCommand={runCommand}
              onNavigate={navigateFromGuided}
              onApplyUpgrade={applyGuidedUpgrade}
              onToggleAdvancedMode={toggleAdvancedMode}
              onEnableAdvanced={enableAdvancedMode}
              onImport={importFromExport}
              onOpenSite={onOpenSite}
            />
          </motion.main>
          <MemoizedPreview
            project={project}
            route={previewRoute}
            size={previewSize}
            zoom={previewZoom}
          />
        </div>

        {focusMode ? (
          <Tooltip tip="Salir del modo foco" position="bottom" className="studio-focus-exit">
            <IconButton
              id={focusExitId}
              icon={ArrowsInSimple}
              label="Salir del modo foco"
              data-testid="ui-focus-exit"
              onClick={() => {
                setFocusMode(false);
                requestAnimationFrame(() => {
                  document.getElementById(focusToggleId)?.focus();
                });
              }}
            />
          </Tooltip>
        ) : null}

        <footer className="studio-statusbar" data-testid="ui-status-bar">
          <span>Esquema v{project.schemaVersion}</span>
          <span>Última exportación: {lastExportLabel}</span>
          <span>Persistencia: {managedStorage ? "Disco" : "IndexedDB"}</span>
          {validationError ? <InlineError>{validationError}</InlineError> : null}
        </footer>
      </div>

      {conflict ? (
        <div
          className="conflict-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={conflictTitleId}
          data-testid="ui-conflict-dialog"
          onKeyDown={trapConflictFocus}
        >
          <div className="conflict-dialog" ref={conflictDialogRef} tabIndex={-1}>
            <h3 id={conflictTitleId}>La tienda cambió en otra pestaña</h3>
            <p>
              {conflict.message} Tu borrador quedó guardado en este navegador. Elegí cómo seguir:
            </p>
            <div className="conflict-dialog__options">
              <Button variant="quiet" data-testid="ui-conflict-keep" onClick={keepConflictDraft}>
                Conservar borrador
              </Button>
              <Button
                variant="secondary"
                data-testid="ui-conflict-reload"
                onClick={() => {
                  setConflict(null);
                  void onReloadFromDisk?.()
                    .then((outcome) => {
                      if (outcome && !outcome.ok) setNotice(outcome.message);
                    })
                    .catch((reason) =>
                      setNotice(
                        reason instanceof Error
                          ? reason.message
                          : "No se pudo recargar desde disco.",
                      ),
                    );
                }}
              >
                Recargar desde disco
              </Button>
              <Button
                variant="primary"
                data-testid="ui-conflict-duplicate"
                onClick={() => {
                  setConflict(null);
                  void onDuplicateDraft?.(project)
                    .then((outcome) => {
                      if (outcome && !outcome.ok) setNotice(outcome.message);
                    })
                    .catch((reason) =>
                      setNotice(
                        reason instanceof Error
                          ? reason.message
                          : "No se pudo duplicar el borrador.",
                      ),
                    );
                }}
              >
                Duplicar con mi borrador
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmLeave && !conflict ? (
        <ConfirmDialog
          title="Salir sin guardar"
          body="Hay cambios sin guardar en esta tienda. ¿Querés salir de todos modos?"
          confirmLabel="Salir sin guardar"
          cancelLabel="Quedarme"
          danger
          onConfirm={() => {
            setConfirmLeave(false);
            void performLeave();
          }}
          onCancel={() => setConfirmLeave(false)}
        />
      ) : null}
    </>
  );
}
