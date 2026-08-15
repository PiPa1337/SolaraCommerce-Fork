/**
 * Biblioteca de tiendas: consulta la fuente disponible, aplica filtros y
 * expone creación, duplicado, archivo, respaldos y cierre del servidor propio.
 */
import {
  ArrowUpRight,
  CheckCircle,
  CloudArrowDown,
  GitDiff,
  Plus,
  Star,
  Storefront,
  X,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import {
  memo,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button, EmptyState, Field, IconButton, InlineError } from "../components/Ui";
import {
  auditStoreHealth,
  type DashboardSort,
  type DashboardStatusFilter,
  filterDashboardProjects,
  getDashboardStats,
  getProjectMetrics,
  partitionPinnedProjects,
} from "../lib/dashboardModel";
import {
  clearStoredSelectedId,
  type DashboardView,
  readPinnedIds,
  readStoredSelectedId,
  readStoredSort,
  readStoredView,
  writePinnedIds,
  writeStoredSelectedId,
  writeStoredSort,
  writeStoredView,
} from "../lib/dashboardStorage";
import { formatDate } from "../lib/format";
import type { StoredProject } from "../lib/repository";
import { bulkBackupToastMessage } from "./dashboard/bulkBackupModel";
import { CompareView } from "./dashboard/CompareView";
import { DashboardToolbar } from "./dashboard/DashboardToolbar";
import { DuplicateDialog } from "./dashboard/DuplicateDialog";
import { formatCompactDate, ProjectCard, statusLabel } from "./dashboard/ProjectCard";

interface DashboardProps {
  projects: StoredProject[];
  onCreate(input: { name: string; brandName: string; email: string; phone: string }): Promise<void>;
  onOpen(id: string): void;
  onDuplicate(id: string, name?: string): Promise<void>;
  onArchive(id: string, archived: boolean): Promise<void>;
  onBackup(id: string): Promise<void>;
  onDownloadBackup?(id: string): Promise<void>;
  onOpenSite?(id: string): Promise<void>;
  onOpenFolder?(id: string): Promise<void>;
  onSessionManaged?(managed: boolean): void;
  /** App confirmó el cierre del servidor: estado terminal que no se revierte. */
  shutdownTerminal?: boolean;
  /** Notifica a App cuando el cierre del servidor queda confirmado. */
  onShutdownTerminal?(terminal: boolean): void;
}

interface DashboardStoreCardProps {
  record: StoredProject;
  index: number;
  isSelected: boolean;
  isPinned: boolean;
  compareMode: boolean;
  isCompared: boolean;
  reduceMotion: boolean | null;
  cardButtonRefs: RefObject<Map<string, HTMLButtonElement>>;
  onOpen(id: string): void;
  onSelect(id: string): void;
  onPin(id: string): void;
  onToggleCompare(id: string): void;
  onKeyDown(event: ReactKeyboardEvent<HTMLElement>, record: StoredProject): void;
}

/** Card de tienda memoizada (T5.4): los handlers son useCallback estables y
 *  los datos vienen por referencia, así la selección/fijación sólo re-renderiza
 *  las cards afectadas mientras se escribe en la búsqueda. */
const DashboardStoreCard = memo(function DashboardStoreCard({
  record,
  index,
  isSelected,
  isPinned,
  compareMode,
  isCompared,
  reduceMotion,
  cardButtonRefs,
  onOpen,
  onSelect,
  onPin,
  onToggleCompare,
  onKeyDown,
}: DashboardStoreCardProps) {
  const metrics = getProjectMetrics(record.project);
  const updatedLabel = formatDate(record.updatedAt);
  return (
    <motion.article
      className={`dashboard-store-card${isSelected ? " is-selected" : ""}${
        compareMode ? " is-compare-mode" : ""
      }`}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.025, 0.25) }}
      // La elevación al hover debe pasar por motion: la animación de entrada
      // deja un transform inline y el CSS `:hover` no puede pisarlo (T5.1).
      {...(reduceMotion
        ? {}
        : { whileHover: { y: -2, transition: { duration: 0.16, delay: 0 } } as const })}
      onKeyDown={(event) => onKeyDown(event, record)}
    >
      {compareMode ? (
        <input
          type="checkbox"
          className="dashboard-store-card__compare"
          data-testid="ui-card-compare"
          aria-label={`Comparar ${record.name}`}
          checked={isCompared}
          onChange={() => onToggleCompare(record.id)}
        />
      ) : null}
      <button
        type="button"
        className="dashboard-store-card__pin"
        aria-pressed={isPinned}
        aria-description={`Tienda ${record.name}`}
        aria-label={isPinned ? "Quitar de fijadas" : "Fijar tienda"}
        data-testid="ui-card-pin"
        onClick={() => onPin(record.id)}
      >
        <Star aria-hidden size={16} weight={isPinned ? "fill" : "regular"} />
      </button>
      <button
        className="dashboard-store-card__button"
        type="button"
        aria-pressed={isSelected}
        data-store-card-id={record.id}
        ref={(element) => {
          if (element) cardButtonRefs.current.set(record.id, element);
          else cardButtonRefs.current.delete(record.id);
        }}
        onClick={() => onSelect(record.id)}
        onDoubleClick={() => onOpen(record.id)}
      >
        <span className="dashboard-store-card__index">{index + 1}</span>
        <span className="dashboard-store-card__mark" aria-hidden>
          {record.name.slice(0, 2).toUpperCase()}
        </span>
        <strong title={record.name}>{record.name}</strong>
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
        aria-description={`Tienda ${record.name}`}
        aria-label="Abrir esta tienda"
        onClick={() => onOpen(record.id)}
      >
        Abrir <ArrowUpRight aria-hidden size={13} />
      </button>
    </motion.article>
  );
});

interface DashboardToast {
  message: string;
  actionLabel?: string;
  onAction?(): void;
}

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
  shutdownTerminal,
  onShutdownTerminal,
}: DashboardProps) {
  const [statusFilter, setStatusFilter] = useState<DashboardStatusFilter>("active");
  const [sort, setSort] = useState<DashboardSort>(readStoredSort);
  const [view, setView] = useState<DashboardView>(readStoredView);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(readStoredSelectedId);
  const [pinnedIds, setPinnedIds] = useState<string[]>(readPinnedIds);
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
  const [folderOpeningId, setFolderOpeningId] = useState<string>();
  const [downloadingId, setDownloadingId] = useState<string>();
  const [actionNotice, setActionNotice] = useState("");
  const [shutdownState, setShutdownState] = useState<
    "checking" | "unavailable" | "available" | "closing" | "closed"
  >("checking");
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);
  const [shutdownError, setShutdownError] = useState("");
  const [toast, setToast] = useState<DashboardToast>();
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<StoredProject>();
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string>();
  const [backingUp, setBackingUp] = useState<string>();
  const [criticalIssues, setCriticalIssues] = useState<number | null>(null);
  const [auditSkipped, setAuditSkipped] = useState(0);
  const [portableFirstRunAt, setPortableFirstRunAt] = useState<string | null>(null);
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const shutdownDialogRef = useRef<HTMLDialogElement>(null);
  const shutdownTerminalRef = useRef(shutdownTerminal === true);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const selectedPanelRef = useRef<HTMLFieldSetElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const createOpenerRef = useRef<HTMLElement | null>(null);
  const shutdownOpenerRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cardButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const lastSelectedIdRef = useRef<string | undefined>(undefined);
  const selectionInitializedRef = useRef(false);
  const focusCardOnSelectRef = useRef(false);
  const actionNoticeTimerRef = useRef<number | undefined>(undefined);
  const toastTimerRef = useRef<number | undefined>(undefined);
  const reduceMotion = useReducedMotion();
  const dashboardTitleId = useId();
  const libraryTitleId = useId();
  const createStoreTitleId = useId();
  const shutdownTitleId = useId();
  const pinnedGroupTitleId = useId();

  const visible = useMemo(
    () => filterDashboardProjects(projects, query, statusFilter, sort),
    [projects, query, sort, statusFilter],
  );
  const stats = useMemo(() => getDashboardStats(projects), [projects]);
  const selected = projects.find((record) => record.id === selectedId);
  const { pinned: pinnedVisible, rest: restVisible } = useMemo(
    () => partitionPinnedProjects(visible, pinnedIds),
    [pinnedIds, visible],
  );
  const visibleIndexById = useMemo(
    () => new Map(visible.map((record, index) => [record.id, index])),
    [visible],
  );
  const isShutdownTerminal = shutdownTerminal === true || shutdownState === "closed";
  const managed = shutdownState === "available" && !isShutdownTerminal;
  const outdatedStores = useMemo(
    () =>
      projects.filter(
        (record) => record.status === "active" && record.diskSiteStatus === "site-outdated",
      ),
    [projects],
  );
  const comparePair = useMemo(() => {
    if (compareIds.length !== 2) return undefined;
    const left = projects.find((record) => record.id === compareIds[0]);
    const right = projects.find((record) => record.id === compareIds[1]);
    return left && right ? { left, right } : undefined;
  }, [compareIds, projects]);

  useEffect(() => {
    if (projects.length === 0) return;
    const selectedIsVisible = selectedId
      ? visible.some((record) => record.id === selectedId)
      : false;
    if (selectedIsVisible) {
      selectionInitializedRef.current = true;
      return;
    }
    if (selectedId) {
      setSelectedId(visible[0]?.id);
      return;
    }
    if (!selectionInitializedRef.current && visible[0]) {
      selectionInitializedRef.current = true;
      setSelectedId(visible[0].id);
    }
  }, [projects.length, selectedId, visible]);

  useEffect(() => {
    const dialog = createDialogRef.current;
    if (!dialog) return;
    if (creating && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => nameInputRef.current?.focus());
    }
    if (!creating && dialog.open) {
      dialog.close();
      const opener = createOpenerRef.current ?? createButtonRef.current;
      createOpenerRef.current = null;
      if (!opener?.isConnected) return;
      const frame = requestAnimationFrame(() => opener.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(frame);
    }
  }, [creating]);

  useEffect(() => {
    const dialog = shutdownDialogRef.current;
    if (!dialog) return;
    if (shutdownDialogOpen && !dialog.open) dialog.showModal();
    if (!shutdownDialogOpen && dialog.open) {
      dialog.close();
      const opener = shutdownOpenerRef.current;
      shutdownOpenerRef.current = null;
      if (!opener?.isConnected) return;
      const frame = requestAnimationFrame(() => opener.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(frame);
    }
  }, [shutdownDialogOpen]);

  useEffect(() => {
    if (shutdownTerminal === true) shutdownTerminalRef.current = true;
  }, [shutdownTerminal]);

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
    const openShutdown = () => {
      if (shutdownTerminalRef.current) return;
      shutdownOpenerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setShutdownDialogOpen(true);
    };
    window.addEventListener("solara:open-shutdown", openShutdown);
    return () => window.removeEventListener("solara:open-shutdown", openShutdown);
  }, []);

  useEffect(() => {
    if (window.location.protocol !== "solara:") return;
    const desktop = (
      window as Window & {
        solaraDesktop?: { diagnostics?: () => Promise<{ portableFirstRunAt?: string }> };
      }
    ).solaraDesktop;
    void desktop
      ?.diagnostics?.()
      .then((info) => setPortableFirstRunAt(info.portableFirstRunAt ?? null))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (selected) {
      lastSelectedIdRef.current = selected.id;
      if (focusCardOnSelectRef.current) {
        focusCardOnSelectRef.current = false;
        requestAnimationFrame(() => cardButtonRefs.current.get(selected.id)?.focus());
        return;
      }
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

  useEffect(() => () => window.clearTimeout(actionNoticeTimerRef.current), []);

  const openCreate = useCallback(() => {
    const activeElement = document.activeElement;
    createOpenerRef.current =
      activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : createButtonRef.current;
    setStep(1);
    setName("");
    setBrandName("");
    setEmail("");
    setPhone("");
    setCreateError("");
    setCreating(true);
  }, []);

  const closeCreate = () => {
    if (creatingProject) return;
    setCreating(false);
  };

  const selectCard = useCallback((id: string, options?: { focusCard?: boolean }) => {
    if (options?.focusCard) focusCardOnSelectRef.current = true;
    writeStoredSelectedId(id);
    setSelectedId(id);
  }, []);

  const clearSelected = useCallback(() => {
    clearStoredSelectedId();
    setSelectedId(undefined);
  }, []);

  const changeSort = useCallback((next: DashboardSort) => {
    writeStoredSort(next);
    setSort(next);
  }, []);

  const changeView = useCallback((next: DashboardView) => {
    writeStoredView(next);
    setView(next);
  }, []);

  const togglePin = useCallback((id: string) => {
    setPinnedIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      writePinnedIds(next);
      return next;
    });
  }, []);

  const announceAction = useCallback((message: string) => {
    setActionNotice(message);
    window.clearTimeout(actionNoticeTimerRef.current);
    actionNoticeTimerRef.current = window.setTimeout(() => setActionNotice(""), 5000);
  }, []);

  const showToast = useCallback((next: DashboardToast) => {
    setToast(next);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(undefined), 5000);
  }, []);

  const doArchive = useCallback(
    async (id: string, archived: boolean) => {
      // Restaurar debe devolver el foco a la card: la refresh posterior
      // re-renderiza `projects` y el efecto de selección enfocaría el panel;
      // la bandera hace que ese mismo efecto enfoque la card restaurada.
      if (!archived) focusCardOnSelectRef.current = true;
      setArchivingId(id);
      try {
        await onArchive(id, archived);
        setArchivingId(undefined);
      } catch {
        setArchivingId(undefined);
        focusCardOnSelectRef.current = false;
        // el error ya quedó visible en el banner global del dashboard
        return;
      }
      const record = projects.find((item) => item.id === id);
      if (archived) {
        showToast({
          message: `Tienda "${record?.name ?? "archivada"}" archivada.`,
          actionLabel: "Deshacer",
          onAction: () => {
            setToast(undefined);
            void doArchive(id, false);
          },
        });
        return;
      }
      showToast({ message: `Tienda "${record?.name ?? "restaurada"}" restaurada.` });
    },
    [onArchive, projects, showToast],
  );

  const handleArchive = useCallback(
    (id: string, archived: boolean): Promise<void> => {
      if (archived) {
        setPendingArchiveId(id);
        return Promise.resolve();
      }
      return doArchive(id, false);
    },
    [doArchive],
  );

  const pendingArchiveRecord = projects.find((item) => item.id === pendingArchiveId) ?? null;

  const visibleRef = useRef<StoredProject[]>(visible);
  visibleRef.current = visible;

  const moveCardSelection = useCallback(
    (key: string, fromId: string) => {
      const ids = visibleRef.current.map((record) => record.id);
      if (ids.length === 0) return;
      const fromIndex = ids.indexOf(fromId);
      if (fromIndex === -1) return;
      if (key !== "ArrowUp" && key !== "ArrowDown") {
        const delta = key === "ArrowRight" ? 1 : -1;
        const nextId = ids[(fromIndex + delta + ids.length) % ids.length];
        if (nextId) selectCard(nextId, { focusCard: true });
        return;
      }
      const goingDown = key === "ArrowDown";
      const fromRect = cardButtonRefs.current.get(fromId)?.getBoundingClientRect();
      if (!fromRect) return;
      let bestIndex = -1;
      let bestScore = Number.POSITIVE_INFINITY;
      for (let index = 0; index < ids.length; index++) {
        if (index === fromIndex) continue;
        const candidateId = ids[index];
        if (!candidateId) continue;
        const rect = cardButtonRefs.current.get(candidateId)?.getBoundingClientRect();
        if (!rect) continue;
        const deltaY = goingDown ? rect.top - fromRect.top : fromRect.top - rect.top;
        if (deltaY < -4) continue;
        const fromCenterX = fromRect.left + fromRect.width / 2;
        const centerX = rect.left + rect.width / 2;
        const score = Math.abs(centerX - fromCenterX) * 100 + Math.abs(deltaY);
        if (score < bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }
      const bestId = ids[bestIndex];
      if (bestId) selectCard(bestId, { focusCard: true });
    },
    [selectCard],
  );

  const handleCardKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>, record: StoredProject) => {
      const target = event.target as HTMLElement;
      if (event.key === "Escape") {
        event.preventDefault();
        clearSelected();
        return;
      }
      const onCardControl =
        target.hasAttribute("data-store-card-id") ||
        target.classList.contains("dashboard-store-card__open");
      if (!onCardControl) return;
      if (event.key === "Enter") {
        if (target.hasAttribute("data-store-card-id")) {
          event.preventDefault();
          onOpen(record.id);
        }
        return;
      }
      if (event.key === " ") {
        if (target.classList.contains("dashboard-store-card__open")) {
          event.preventDefault();
          selectCard(record.id);
        }
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (record.status === "archived") return;
        event.preventDefault();
        void handleArchive(record.id, true);
        return;
      }
      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        moveCardSelection(event.key, record.id);
      }
    },
    [clearSelected, handleArchive, moveCardSelection, onOpen, selectCard],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        creating ||
        shutdownDialogOpen ||
        shutdownState === "closing" ||
        duplicateTarget !== undefined ||
        compareOpen ||
        pendingArchiveId !== null
      ) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLButtonElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        openCreate();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    creating,
    openCreate,
    shutdownDialogOpen,
    shutdownState,
    duplicateTarget,
    compareOpen,
    pendingArchiveId,
  ]);

  useEffect(() => {
    let cancelled = false;
    setAuditSkipped(0);
    setCriticalIssues(null);
    const active = projects.filter((record) => record.status === "active");
    if (active.length === 0) {
      setCriticalIssues(0);
      return;
    }
    void import("@solara/exporter")
      .then(({ auditProject }) => {
        const { critical, skipped } = auditStoreHealth(
          active,
          (project) =>
            auditProject(project).filter((issue) => issue.severity === "critical").length,
          300,
          () => performance.now(),
        );
        if (cancelled) return;
        setCriticalIssues(critical);
        setAuditSkipped(skipped);
      })
      .catch(() => {
        if (!cancelled) setAuditSkipped(active.length);
      });
    return () => {
      cancelled = true;
    };
  }, [projects]);

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
    if (shutdownTerminalRef.current) return;
    setShutdownState("closing");
    setShutdownError("");
    try {
      const response = await fetch("/__solara/shutdown", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("El servidor no aceptó el cierre.");
      shutdownTerminalRef.current = true;
      setShutdownDialogOpen(false);
      setShutdownState("closed");
      onShutdownTerminal?.(true);
    } catch {
      if (!shutdownTerminalRef.current) setShutdownState("available");
      setShutdownError("No se pudo detener el servidor local.");
    }
  };

  const createBackup = async (id: string) => {
    setBackupId(id);
    try {
      await onBackup(id);
      announceAction("Se creó un respaldo.");
    } catch {
      // el error ya quedó visible en el banner global del dashboard
    } finally {
      setBackupId(undefined);
    }
  };

  const openSite = async (id: string) => {
    if (!onOpenSite) return;
    setSiteOpeningId(id);
    try {
      await onOpenSite(id);
    } catch {
      // el error ya quedó visible en el banner global del dashboard
    } finally {
      setSiteOpeningId(undefined);
    }
  };

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  const openDuplicate = async (id: string) => {
    setDuplicateTarget(projects.find((record) => record.id === id));
  };

  const closeDuplicate = () => {
    const id = duplicateTarget?.id;
    setDuplicateTarget(undefined);
    if (!id) return;
    requestAnimationFrame(() => cardButtonRefs.current.get(id)?.focus());
  };

  const confirmDuplicate = async (id: string, name: string) => {
    // Simetría con el camino de cancelar: la refresh posterior re-renderiza
    // `projects` y el efecto de selección robaría el foco al panel de detalle;
    // la bandera hace que ese mismo efecto enfoque la card de origen.
    focusCardOnSelectRef.current = true;
    try {
      await onDuplicate(id, name);
    } catch (reason) {
      focusCardOnSelectRef.current = false;
      // el DuplicateDialog muestra el error inline y mantiene el diálogo abierto
      throw reason instanceof Error ? reason : new Error("No se pudo duplicar la tienda.");
    }
    setDuplicateTarget(undefined);
    showToast({ message: "Tienda duplicada." });
    requestAnimationFrame(() => cardButtonRefs.current.get(id)?.focus());
  };

  const toggleCompare = () => {
    if (compareMode) {
      setCompareMode(false);
      setCompareIds([]);
      setCompareOpen(false);
      return;
    }
    setCompareMode(true);
  };

  const toggleCompareId = useCallback((id: string) => {
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 2) return current;
      return [...current, id];
    });
  }, []);

  const backupAll = async () => {
    if (!managed || backingUp) return;
    const targets = projects.filter((record) => record.status === "active");
    if (targets.length === 0) return;
    setBackingUp(`1 de ${targets.length}`);
    let failed = 0;
    let firstError = "";
    try {
      for (let index = 0; index < targets.length; index += 1) {
        setBackingUp(`${index + 1} de ${targets.length}`);
        const target = targets[index];
        if (!target) continue;
        try {
          await onBackup(target.id);
        } catch (reason) {
          failed += 1;
          if (!firstError) {
            firstError = reason instanceof Error ? reason.message : "No se pudo crear el respaldo.";
          }
        }
      }
    } finally {
      setBackingUp(undefined);
    }
    showToast({
      message: bulkBackupToastMessage({
        total: targets.length,
        failed,
        ...(firstError ? { firstError } : {}),
      }),
    });
  };

  const openFolder = async (id: string) => {
    if (!onOpenFolder) return;
    setFolderOpeningId(id);
    try {
      await onOpenFolder(id);
    } catch {
      // el error ya quedó visible en el banner global del dashboard
    } finally {
      setFolderOpeningId(undefined);
    }
  };

  const downloadBackup = async (id: string) => {
    if (!onDownloadBackup) return;
    setDownloadingId(id);
    try {
      await onDownloadBackup(id);
      announceAction("Respaldo descargado.");
    } catch {
      // el error ya quedó visible en el banner global del dashboard
    } finally {
      setDownloadingId(undefined);
    }
  };

  return (
    <main id={"tiendas"} tabIndex={-1} className="dashboard-page dashboard-cosmic">
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

        <section
          className="dashboard-cosmic-health"
          aria-label="Salud de las tiendas"
          data-testid="ui-dashboard-health"
        >
          <div className="dashboard-cosmic-health__title">
            <span className="dashboard-cosmic-kicker">Salud</span>
            <strong>Sitios y auditoría</strong>
          </div>
          <div className="dashboard-cosmic-health__stats">
            <div className={outdatedStores.length > 0 ? "is-warn" : ""}>
              <strong>{outdatedStores.length}</strong>
              <span>Sitios desactualizados</span>
            </div>
            <div className={criticalIssues !== null && criticalIssues > 0 ? "is-warn" : ""}>
              <strong>{criticalIssues ?? "…"}</strong>
              <span>
                {auditSkipped > 0
                  ? `Auditoría omitida en ${auditSkipped} ${auditSkipped === 1 ? "tienda" : "tiendas"} (catálogo grande)`
                  : "Errores críticos"}
              </span>
            </div>
          </div>
          {outdatedStores.length > 0 ? (
            <ul
              className="dashboard-cosmic-health__chips"
              aria-label="Tiendas con sitio desactualizado"
            >
              {outdatedStores.map((record) => (
                <li key={record.id}>
                  <button
                    type="button"
                    data-testid="ui-health-chip"
                    onClick={() => {
                      // Los chips listan tiendas activas: para que la selección
                      // no sea anulada por el efecto de sincronización con la
                      // lista visible, se limpian búsqueda y filtro y se pasa
                      // por el mismo receptor que las cards (persistencia).
                      setQuery("");
                      setStatusFilter("active");
                      selectCard(record.id, { focusCard: true });
                    }}
                  >
                    {record.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {isShutdownTerminal ? (
          <output className="shutdown-status shutdown-status--cosmic">
            <CheckCircle aria-hidden size={18} />
            <span>
              <strong>Servidor local detenido.</strong> Podés cerrar esta pestaña del navegador.
            </span>
          </output>
        ) : null}

        {portableFirstRunAt ? (
          <output className="shutdown-status">
            <CheckCircle aria-hidden size={18} />
            <span>
              <strong>Primera vez que SolaraCommerce se abre en esta carpeta.</strong> Si moviste la
              aplicación, tus tiendas siguen en la ubicación anterior: {portableFirstRunAt}.
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
            searchRef={searchInputRef}
            onQueryChange={setQuery}
            onStatusFilterChange={setStatusFilter}
            onSortChange={changeSort}
            onViewChange={changeView}
          />

          <div className="dashboard-cosmic-actions">
            <Button icon={GitDiff} aria-pressed={compareMode} onClick={toggleCompare}>
              Comparar tiendas
            </Button>
            <Button
              icon={CloudArrowDown}
              disabled={!managed || backingUp !== undefined}
              loading={backingUp !== undefined}
              title={
                managed
                  ? undefined
                  : "En modo navegador los respaldos se descargan por tienda. Usá el botón de cada tienda."
              }
              onClick={() => void backupAll()}
            >
              {backingUp !== undefined ? `Respaldando ${backingUp}` : "Respaldar todo"}
            </Button>
            {compareMode ? (
              <div className="dashboard-cosmic-comparebar">
                <span className="dashboard-cosmic-comparebar__count" aria-live="polite">
                  {compareIds.length === 2
                    ? "2 tiendas seleccionadas"
                    : compareIds.length === 1
                      ? "1 tienda seleccionada"
                      : "Elegí 2 tiendas para comparar"}
                </span>
                <Button
                  variant="primary"
                  icon={GitDiff}
                  disabled={compareIds.length !== 2}
                  onClick={() => setCompareOpen(true)}
                >
                  Comparar
                </Button>
                <Button variant="quiet" onClick={toggleCompare}>
                  Cancelar
                </Button>
              </div>
            ) : null}
          </div>

          <div className={`dashboard-cosmic-results dashboard-cosmic-results--${view}`}>
            <div className="dashboard-cosmic-store-groups" aria-live="polite">
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
                <>
                  {pinnedVisible.length > 0 ? (
                    <section
                      className="dashboard-cosmic-group"
                      aria-labelledby={pinnedGroupTitleId}
                    >
                      <h3 id={pinnedGroupTitleId}>Fijadas</h3>
                      <div className="dashboard-cosmic-store-grid">
                        {pinnedVisible.map((record) => (
                          <DashboardStoreCard
                            key={record.id}
                            record={record}
                            index={visibleIndexById.get(record.id) ?? 0}
                            isSelected={record.id === selectedId}
                            isPinned={pinnedIds.includes(record.id)}
                            compareMode={compareMode}
                            isCompared={compareIds.includes(record.id)}
                            reduceMotion={reduceMotion}
                            cardButtonRefs={cardButtonRefs}
                            onOpen={onOpen}
                            onSelect={selectCard}
                            onPin={togglePin}
                            onToggleCompare={toggleCompareId}
                            onKeyDown={handleCardKeyDown}
                          />
                        ))}
                      </div>
                    </section>
                  ) : null}
                  <section className="dashboard-cosmic-group">
                    {pinnedVisible.length > 0 ? <h3>Todas</h3> : null}
                    <div className="dashboard-cosmic-store-grid">
                      {restVisible.map((record) => (
                        <DashboardStoreCard
                          key={record.id}
                          record={record}
                          index={visibleIndexById.get(record.id) ?? 0}
                          isSelected={record.id === selectedId}
                          isPinned={pinnedIds.includes(record.id)}
                          compareMode={compareMode}
                          isCompared={compareIds.includes(record.id)}
                          reduceMotion={reduceMotion}
                          cardButtonRefs={cardButtonRefs}
                          onOpen={onOpen}
                          onSelect={selectCard}
                          onPin={togglePin}
                          onToggleCompare={toggleCompareId}
                          onKeyDown={handleCardKeyDown}
                        />
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>

            <ProjectCard
              project={selected}
              detailRef={selectedPanelRef}
              backupId={backupId}
              archivingId={archivingId}
              siteOpeningId={siteOpeningId}
              folderOpeningId={folderOpeningId}
              downloadingId={downloadingId}
              actionNotice={actionNotice}
              onClose={clearSelected}
              onOpen={onOpen}
              onOpenSite={onOpenSite ? openSite : undefined}
              onOpenFolder={onOpenFolder ? openFolder : undefined}
              onBackup={createBackup}
              onDownloadBackup={onDownloadBackup ? downloadBackup : undefined}
              onDuplicate={openDuplicate}
              onArchive={handleArchive}
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
            <IconButton
              icon={X}
              label="Cerrar creación"
              disabled={creatingProject}
              onClick={closeCreate}
            />
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

      <CompareView
        left={comparePair?.left}
        right={comparePair?.right}
        open={compareOpen && comparePair !== undefined}
        onClose={() => setCompareOpen(false)}
      />

      <DuplicateDialog
        project={duplicateTarget}
        onClose={closeDuplicate}
        onDuplicate={confirmDuplicate}
        onDone={() => setDuplicateTarget(undefined)}
      />

      {toast
        ? createPortal(
            <output className="dashboard-toast" data-testid="ui-dashboard-toast">
              <span>{toast.message}</span>
              {toast.actionLabel && toast.onAction ? (
                <Button variant="quiet" onClick={() => toast.onAction?.()}>
                  {toast.actionLabel}
                </Button>
              ) : null}
              <IconButton icon={X} label="Cerrar aviso" onClick={() => setToast(undefined)} />
            </output>,
            document.body,
          )
        : null}

      {pendingArchiveRecord ? (
        <ConfirmDialog
          title="Archivar tienda"
          body={`¿Archivar la tienda "${pendingArchiveRecord.name}"? Podés restaurarla después desde el filtro de archivadas.`}
          confirmLabel="Archivar"
          cancelLabel="Cancelar"
          danger
          onConfirm={() => {
            const id = pendingArchiveRecord.id;
            setPendingArchiveId(null);
            void doArchive(id, true);
          }}
          onCancel={() => setPendingArchiveId(null)}
        />
      ) : null}
    </main>
  );
}
