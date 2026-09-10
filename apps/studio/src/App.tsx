/**
 * Punto de composición de Studio: detecta el servidor local, carga la tienda
 * desde disco o Dexie, ofrece recovery drafts y entrega el proyecto al shell.
 * Las nuevas fuentes de persistencia deben integrarse aquí sin duplicar la
 * decisión de autoridad ni la inicialización de fixtures.
 */
import { GearSix, WarningCircle } from "@phosphor-icons/react";
import { type StoreProjectV1, StoreProjectV1Schema } from "@solara/project-schema";
import { isBaseTemplate } from "@solara/project-schema/project-policy";
import {
  Component,
  type ErrorInfo,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ToastProvider } from "./components/Toast";
import { Button, InlineError } from "./components/Ui";
import { Dashboard } from "./features/Dashboard";
import { GRAVITY_INTRO_DURATION_MS } from "./features/dashboard/GravityField";
import { GravitySettingsPanel } from "./features/dashboard/GravitySettingsPanel";
import {
  applyBuiltInGravityPreset,
  DEFAULT_GRAVITY_SETTINGS,
  type GravityPreferences,
  type GravitySettings,
  type GravityTaaQuality,
  loadGravityPreferences,
  loadGravityPreferencesFromDisk,
  type NumericGravitySetting,
  persistGravityPreferences,
  persistGravityPreferencesToDisk,
} from "./features/dashboard/gravitySettings";
import type { LocalStorageStatus } from "./lib/localStorage";
import { downloadBlob } from "./lib/projectArchive";
import {
  type RecoveryDraftDecision,
  resolveRecoveryDraftDecision,
} from "./lib/recoveryDraftDecision";
import {
  clearRecoveryDraft,
  consumeStorageResetNotice,
  createProject,
  deleteProject,
  duplicateProject,
  ensureDeprecatedCategoriesRemoved,
  ensureFirstProject,
  ensureScaleDemoProject,
  expandCatalogModernDemoTestimonials,
  getProject,
  getProjectMigration,
  getRecoveryDraft,
  importProject,
  listProjectsWithRecovery,
  markProjectMigration,
  migrateCatalogModernDemo,
  optimizeProjectAssets,
  type ProjectRecoveryIssue,
  purgeNonDemoStores,
  purgeRolledBackDemoRecords,
  retireLegacyDemoProjects,
  type StoredProject,
  saveProject,
  saveRecoveryDraft,
  setProjectArchived,
  shouldSeedRecoveryDraft,
  slugify,
} from "./lib/repository";
import { createProjectArchiveInWorker, readProjectArchiveInWorker } from "./lib/workers";

const loadLocalStorage = (() => {
  let cached: Promise<typeof import("./lib/localStorage")> | null = null;
  return () => {
    if (cached === null) cached = import("./lib/localStorage");
    return cached;
  };
})();
const loadLocalProjectRepository = (() => {
  let cached: Promise<typeof import("./lib/localProjectRepository")> | null = null;
  return () => {
    if (cached === null) cached = import("./lib/localProjectRepository");
    return cached;
  };
})();
const ComponentGallery = lazy(() =>
  import("./debug/ComponentGallery").then(({ ComponentGallery: Gallery }) => ({
    default: Gallery,
  })),
);
const Studio = lazy(() =>
  import("./features/Studio").then(({ Studio: Component }) => ({ default: Component })),
);

interface StudioBootProgress {
  percent: number;
  label: string;
  detail: string;
}

const INITIAL_STUDIO_BOOT_PROGRESS: StudioBootProgress = {
  percent: 0,
  label: "Preparando tu espacio local",
  detail: "Iniciando el almacenamiento local…",
};

const STUDIO_BOOT_RESOURCE_URLS = [
  "/branding/solara-orbit-64.png",
  "/branding/gargantua-reference.png",
];

function preloadStudioBootImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    const settle = () => resolve();

    image.addEventListener("load", settle, { once: true });
    image.addEventListener("error", settle, { once: true });
    image.src = src;
  });
}

async function preloadStudioBootResources(onProgress: (percent: number) => void): Promise<void> {
  const imagePromises = STUDIO_BOOT_RESOURCE_URLS.map(preloadStudioBootImage);
  const fontPromise = typeof document !== "undefined" && document.fonts ? document.fonts.ready : Promise.resolve();
  const totalResources = imagePromises.length + 1;
  let completedResources = 0;

  const markResourceComplete = () => {
    completedResources += 1;
    onProgress(Math.round((completedResources / totalResources) * 100));
  };

  await Promise.all(
    imagePromises.map(async (resourcePromise) => {
      try {
        await resourcePromise;
      } finally {
        markResourceComplete();
      }
    }),
  );

  try {
    await fontPromise;
  } finally {
    markResourceComplete();
  }

  onProgress(100);
}

const APP_BOOT_FIELD_REVEAL_MS = GRAVITY_INTRO_DURATION_MS;
const APP_BOOT_SPLASH_EXTRA_MS = 3_000;
const APP_BOOT_BLACKOUT_MS = 720;
const APP_BOOT_ZOOM_MS = GRAVITY_INTRO_DURATION_MS;
const APP_BOOT_DASHBOARD_ENTRY_MS = 1600;

function StudioBootSequence({
  ready,
  progress,
  onZoomStart,
}: {
  ready: boolean;
  progress: StudioBootProgress;
  onZoomStart: (clockOrigin: number) => void;
}) {
  const [phase, setPhase] = useState<
    "loading" | "blackout" | "returning" | "dashboard" | "done"
  >("loading");
  const startedAtRef = useRef(0);
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fieldRevealDuration = reducedMotion ? 240 : APP_BOOT_FIELD_REVEAL_MS;
  const splashExtraDuration = reducedMotion ? 0 : APP_BOOT_SPLASH_EXTRA_MS;
  const blackoutDuration = reducedMotion ? 180 : APP_BOOT_BLACKOUT_MS;
  const zoomDuration = reducedMotion ? 240 : APP_BOOT_ZOOM_MS;
  const dashboardEntryDuration = reducedMotion ? 240 : APP_BOOT_DASHBOARD_ENTRY_MS;

  useEffect(() => {
    startedAtRef.current = performance.now();
    document.documentElement.dataset.solaraBoot = "loading";
    return () => {
      delete document.documentElement.dataset.solaraBoot;
      delete document.documentElement.dataset.solaraDashboardEntry;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    const elapsed = performance.now() - startedAtRef.current;
    const revealWait = Math.max(0, fieldRevealDuration - elapsed) + splashExtraDuration;
    let blackoutTimer: number | undefined;
    let dashboardTimer: number | undefined;
    const releaseTimer = window.setTimeout(() => {
      setPhase("blackout");
      blackoutTimer = window.setTimeout(() => {
        onZoomStart(performance.now());
        delete document.documentElement.dataset.solaraBoot;
        setPhase("returning");
        dashboardTimer = window.setTimeout(() => {
          // The CSS entry starts only after the real zoom has completed. Keep
          // the marker alive until the staggered dashboard animations settle.
          document.documentElement.dataset.solaraDashboardEntry = "true";
          setPhase("dashboard");
          dashboardTimer = window.setTimeout(() => {
            delete document.documentElement.dataset.solaraDashboardEntry;
            setPhase("done");
          }, dashboardEntryDuration);
        }, zoomDuration);
      }, blackoutDuration);
    }, revealWait);

    return () => {
      window.clearTimeout(releaseTimer);
      if (blackoutTimer !== undefined) window.clearTimeout(blackoutTimer);
      if (dashboardTimer !== undefined) window.clearTimeout(dashboardTimer);
    };
  }, [
    blackoutDuration,
    dashboardEntryDuration,
    fieldRevealDuration,
    onZoomStart,
    ready,
    splashExtraDuration,
    zoomDuration,
  ]);

  if (phase === "done") return null;

  const progressPercent = Math.min(100, Math.max(0, Math.round(progress.percent)));

  return (
    <div
      className={`app-boot-sequence${phase === "blackout" ? " is-blackout" : ""}${phase === "returning" ? " is-returning" : ""}${phase === "dashboard" ? " is-dashboard" : ""}`}
      data-boot-phase={phase}
      data-testid="solara-app-boot"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="app-boot-sequence__veil" aria-hidden="true" />
      <div className="app-boot-sequence__blackout" aria-hidden="true" />
      <section className="app-boot-sequence__panel" aria-label="Progreso de carga">
        <div className="app-boot-sequence__brand">
          <img
            className="app-boot-sequence__logo"
            src="/branding/solara-orbit-64.png"
            srcSet="/branding/solara-orbit-32.png 32w, /branding/solara-orbit-64.png 64w, /branding/solara-orbit-128.png 128w"
            sizes="44px"
            alt=""
            width={44}
            height={44}
            decoding="async"
            fetchPriority="high"
          />
          <div>
            <p className="app-boot-sequence__eyebrow">SolaraCommerce</p>
            <p className="app-boot-sequence__brand-detail">Local-first commerce studio</p>
          </div>
        </div>
        <div className="app-boot-sequence__copy">
          <h1 data-testid="solara-boot-progress-label">{progress.label}</h1>
          <p data-testid="solara-boot-progress-detail">{progress.detail}</p>
        </div>
        <div className="app-boot-sequence__progress">
          <div
            className="app-boot-sequence__progress-track"
            data-testid="solara-boot-progress"
            role="progressbar"
            aria-label="Progreso de carga"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-valuetext={`${progress.label}: ${progressPercent}%`}
          >
            <span
              className="app-boot-sequence__progress-value"
              data-testid="solara-boot-progress-bar"
              style={{ transform: `scaleX(${progressPercent / 100})` }}
            />
          </div>
          <div className="app-boot-sequence__progress-meta">
            <span data-testid="solara-boot-progress-status">Estado local en tiempo real</span>
            <strong data-testid="solara-boot-progress-value">{progressPercent}%</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

type StoreLaunchCurtainPhase = "idle" | "covering" | "releasing";

function StoreLaunchCurtain({ phase }: { phase: StoreLaunchCurtainPhase }) {
  if (phase === "idle") return null;
  return (
    <div
      className={`store-launch-curtain is-${phase}`}
      data-testid="store-route-curtain"
      aria-hidden="true"
    />
  );
}

export function App() {
  return (
    <AppErrorBoundary>
      <AppInner />
    </AppErrorBoundary>
  );
}

interface AppErrorBoundaryState {
  error: Error | null;
}

/** Última red: un error no controlado no debe dejar la app en blanco. */
class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("SolaraCommerce: error no controlado en la interfaz.", error, info);
  }

  override render() {
    if (this.state.error === null) return this.props.children;
    return (
      <main className="boot-screen" role="alert" aria-live="assertive">
        <img
          className="brand-mark brand-mark--orbit"
          src="/branding/solara-orbit-64.png"
          srcSet="/branding/solara-orbit-32.png 32w, /branding/solara-orbit-64.png 64w, /branding/solara-orbit-128.png 128w"
          sizes="64px"
          alt=""
          width={64}
          height={64}
          decoding="async"
        />
        <h1>Algo salió mal</h1>
        <p>
          SolaraCommerce encontró un error inesperado y detuvo la edición para evitar perder
          cambios. Recargá la app para continuar; tu borrador se conserva en este navegador.
        </p>
        <button
          className="button button--primary"
          type="button"
          onClick={() => window.location.reload()}
        >
          Recargar
        </button>
      </main>
    );
  }
}

function AppInner() {
  // Ruta oculta de desarrollo: galería de componentes del editor. No existe en
  // el sitio público; se detecta por pathname antes de montar el dashboard.
  // App no declara hooks: la rama de la galería devuelve sin montar el shell.
  if (typeof window !== "undefined" && window.location.pathname === "/__studio/components") {
    return (
      <Suspense
        fallback={
          <main className="boot-screen">
            <img
              className="brand-mark brand-mark--orbit"
              src="/branding/solara-orbit-64.png"
              srcSet="/branding/solara-orbit-32.png 32w, /branding/solara-orbit-64.png 64w, /branding/solara-orbit-128.png 128w"
              sizes="64px"
              alt=""
              width={64}
              height={64}
              decoding="async"
            />
            <h1>SolaraCommerce</h1>
            <p className="boot-screen__subtitle">Cargando galería de componentes…</p>
          </main>
        }
      >
        <ComponentGallery />
      </Suspense>
    );
  }
  return <StudioShellWithBoot />;
}

function StudioShellWithBoot() {
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [initialLoadProgress, setInitialLoadProgress] = useState<StudioBootProgress>(
    INITIAL_STUDIO_BOOT_PROGRESS,
  );
  const [resourceProgress, setResourceProgress] = useState(0);
  const [resourcesReady, setResourcesReady] = useState(false);
  const handleInitialLoadComplete = useCallback(() => setInitialLoadComplete(true), []);
  const handleInitialLoadProgress = useCallback(
    (progress: StudioBootProgress) => setInitialLoadProgress(progress),
    [],
  );
  const [gravityClockOrigin, setGravityClockOrigin] = useState(() => performance.now());
  const handleBootZoomStart = useCallback(
    (nextClockOrigin: number) => setGravityClockOrigin(nextClockOrigin),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void preloadStudioBootResources((percent) => {
      if (!cancelled) setResourceProgress(percent);
    }).then(() => {
      if (!cancelled) setResourcesReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const bootProgress: StudioBootProgress = {
    ...initialLoadProgress,
    percent: Math.round(initialLoadProgress.percent * 0.82 + resourceProgress * 0.18),
    detail:
      resourceProgress < 100
        ? "Precalentando el logo, el fondo y las tipografías…"
        : initialLoadProgress.detail,
  };

  return (
    <>
      <StudioShell
        onInitialLoadComplete={handleInitialLoadComplete}
        onInitialLoadProgress={handleInitialLoadProgress}
        clockOrigin={gravityClockOrigin}
      />
      <StudioBootSequence
        ready={initialLoadComplete && resourcesReady}
        progress={bootProgress}
        onZoomStart={handleBootZoomStart}
      />
    </>
  );
}

function StudioShell({
  onInitialLoadComplete,
  onInitialLoadProgress,
  clockOrigin,
}: {
  onInitialLoadComplete: () => void;
  onInitialLoadProgress: (progress: StudioBootProgress) => void;
  clockOrigin: number;
}) {
  const gravitySettingsPanelId = useId();
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [active, setActive] = useState<StoreProjectV1>();
  const [storeLaunchCurtain, setStoreLaunchCurtain] = useState<StoreLaunchCurtainPhase>("idle");
  const [recovery, setRecovery] = useState<ProjectRecoveryIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Deduplica por contenido: en dev StrictMode ejecuta el efecto de arranque
  // dos veces y los notices de seeding se repetían en el banner.
  const notify = useCallback((message: string) => {
    setNotice((current) =>
      current?.includes(message) ? current : current ? `${current} ${message}` : message,
    );
  }, []);
  const [sessionManaged, setSessionManaged] = useState(false);
  // H7-B1: tras «Cerrar y detener» el cierre es terminal; App lo guarda para no
  // ofrecer «Cerrar app» ni reintentar el cierre con el servidor muerto.
  const [shutdownTerminal, setShutdownTerminal] = useState(false);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);
  const [gargantuaUiOpacity, setGargantuaUiOpacity] = useState(1);
  const [gravityPreferences] = useState<GravityPreferences>(() => loadGravityPreferences());
  const [gravitySettingsOpen, setGravitySettingsOpen] = useState(false);
  const [gravitySettings, setGravitySettings] = useState<GravitySettings>(
    gravityPreferences.activeSettings,
  );
  const [customGravityPresets, setCustomGravityPresets] = useState(
    gravityPreferences.customPresets,
  );
  const [selectedCustomGravityPreset, setSelectedCustomGravityPreset] = useState(
    gravityPreferences.selectedCustomPreset,
  );
  const [activeCustomGravityPreset, setActiveCustomGravityPreset] = useState<number | null>(
    gravityPreferences.activeCustomPreset,
  );
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [localStorageStatus, setLocalStorageStatus] = useState<LocalStorageStatus>({
    managed: false,
    writable: false,
  });
  const [activeDiskVersion, setActiveDiskVersion] = useState<number | null>(null);
  const [activeDiskBaseProject, setActiveDiskBaseProject] = useState<StoreProjectV1 | undefined>();
  const [pendingRecover, setPendingRecover] = useState<{
    projectId: string;
    draft: StoreProjectV1;
  } | null>(null);
  const [pendingRecoverDiscard, setPendingRecoverDiscard] = useState(false);
  const pendingRecoverResolverRef = useRef<((decision: RecoveryDraftDecision) => void) | null>(
    null,
  );
  const gravitySettingsTriggerRef = useRef<HTMLButtonElement>(null);
  const storageModeRef = useRef(false);

  const closeGravitySettings = useCallback(() => {
    setGravitySettingsOpen(false);
    requestAnimationFrame(() => gravitySettingsTriggerRef.current?.focus());
  }, []);

  const updateGravitySetting = useCallback((setting: NumericGravitySetting, value: number) => {
    setGravitySettings((current) => ({ ...current, [setting]: value }));
  }, []);

  const updateGravityTaaQuality = useCallback((taaQuality: GravityTaaQuality) => {
    setGravitySettings((current) => ({ ...current, taaQuality }));
    setActiveCustomGravityPreset(null);
  }, []);

  const selectBuiltInGravityPreset = useCallback((next: GravitySettings) => {
    setGravitySettings((current) => applyBuiltInGravityPreset(current, next));
    setActiveCustomGravityPreset(null);
  }, []);

  const selectCustomGravityPreset = useCallback(
    (index: number) => {
      setSelectedCustomGravityPreset(index);
      setActiveCustomGravityPreset(index);
      const preset = customGravityPresets[index];
      if (preset) setGravitySettings(preset);
    },
    [customGravityPresets],
  );

  const saveCustomGravityPreset = useCallback(() => {
    const savedSettings = { ...gravitySettings };
    const nextPresets = customGravityPresets.map((preset, index) =>
      index === selectedCustomGravityPreset ? savedSettings : preset,
    );
    const persistedPreferences = {
      customPresets: nextPresets,
      activeSettings: savedSettings,
      activeCustomPreset: selectedCustomGravityPreset,
      selectedCustomPreset: selectedCustomGravityPreset,
    };
    setCustomGravityPresets(nextPresets);
    setActiveCustomGravityPreset(selectedCustomGravityPreset);
    persistGravityPreferences(persistedPreferences);
    if (storageModeRef.current) {
      void persistGravityPreferencesToDisk(persistedPreferences).then((persisted) => {
        if (!persisted) {
          setNotice(
            "El preset quedó guardado en el navegador, pero no pudo actualizar el archivo local.",
          );
        }
      });
    }
  }, [customGravityPresets, gravitySettings, selectedCustomGravityPreset]);

  const resetGravitySettings = useCallback(() => {
    setGravitySettings(DEFAULT_GRAVITY_SETTINGS);
    setActiveCustomGravityPreset(null);
  }, []);

  const toggleGravityPauseWhenHidden = useCallback((value: boolean) => {
    setGravitySettings((current) => ({ ...current, pauseWhenHidden: value }));
  }, []);

  const toggleGravityStaticDiskDetails = useCallback((value: boolean) => {
    setGravitySettings((current) => ({ ...current, staticDiskDetails: value }));
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--gargantua-debug-ui-opacity",
      String(gargantuaUiOpacity),
    );
    return () => {
      document.documentElement.style.removeProperty("--gargantua-debug-ui-opacity");
    };
  }, [gargantuaUiOpacity]);

  const refreshBrowser = useCallback(async () => {
    const result = await listProjectsWithRecovery();
    setProjects(result.projects);
    setRecovery(result.recovery);
    return result;
  }, []);

  const refreshDisk = useCallback(async () => {
    const { loadAllDiskProjects } = await loadLocalProjectRepository();
    const result = await loadAllDiskProjects();
    setProjects(result.projects);
    setRecovery(result.recovery);
    return result;
  }, []);

  const refresh = useCallback(
    async () => (storageModeRef.current ? refreshDisk() : refreshBrowser()),
    [refreshBrowser, refreshDisk],
  );

  const persistToDisk = useCallback(
    async (project: StoreProjectV1, expectedVersion: number | null) => {
      const { persistProjectToDisk: persist } = await loadLocalProjectRepository();
      const result = await persist(project, expectedVersion);
      await clearRecoveryDraft(project.id);
      if (result.siteError) {
        setNotice(`Proyecto guardado · sitio público pendiente: ${result.siteError}`);
      }
      return result;
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      let bootFailed = false;
      try {
        onInitialLoadProgress({
          percent: 4,
          label: "Preparando tu espacio local",
          detail: "Comprobando el almacenamiento disponible…",
        });
        const purgePromise = purgeRolledBackDemoRecords();
        const storagePromise = loadLocalStorage()
          .then(({ getLocalStorageStatus }) =>
            getLocalStorageStatus().catch(() => ({
              managed: false,
              writable: false,
            })),
          )
          .catch(() => ({ managed: false, writable: false }));
        const [, detectedStorage] = await Promise.all([purgePromise, storagePromise]);
        onInitialLoadProgress({
          percent: 16,
          label: "Verificando almacenamiento local",
          detail: "Buscando tiendas y respaldos disponibles…",
        });
        storageModeRef.current = detectedStorage.managed;
        setLocalStorageStatus(detectedStorage);
        if (detectedStorage.managed) {
          onInitialLoadProgress({
            percent: 19,
            label: "Cargando preferencias del dashboard",
            detail: "Revisando los presets guardados en la instalación…",
          });
          const diskGravityPreferences = await loadGravityPreferencesFromDisk();
          if (diskGravityPreferences) {
            setGravitySettings(diskGravityPreferences.activeSettings);
            setCustomGravityPresets(diskGravityPreferences.customPresets);
            setSelectedCustomGravityPreset(diskGravityPreferences.selectedCustomPreset);
            setActiveCustomGravityPreset(diskGravityPreferences.activeCustomPreset);
          } else if (detectedStorage.writable) {
            // Migra una vez el preset anterior del navegador al archivo local.
            await persistGravityPreferencesToDisk(gravityPreferences);
          }
        }
        const retireDiskPromise = (async () => {
          if (detectedStorage.managed && detectedStorage.writable) {
            const { retireLegacyDemoProjectsOnDisk } = await loadLocalStorage();
            const removedFromDisk = await retireLegacyDemoProjectsOnDisk();
            return removedFromDisk.length > 0;
          }
          return false;
        })();
        const retireBrowserPromise = (async () => {
          if (!detectedStorage.managed || detectedStorage.writable) {
            return retireLegacyDemoProjects();
          }
          return false;
        })();
        const [retiredDisk, retiredBrowser] = await Promise.all([
          retireDiskPromise,
          retireBrowserPromise,
        ]);
        onInitialLoadProgress({
          percent: 24,
          label: "Comprobando versiones",
          detail: "Validando el estado de tus tiendas…",
        });
        const retiredLegacyProjects = retiredDisk || retiredBrowser;
        if (retiredLegacyProjects) {
          notify("Se retiraron las referencias legacy; la demo V2 es la única demo integrada.");
        }
        const diskListing = detectedStorage.managed
          ? await (await loadLocalProjectRepository()).loadAllDiskProjects()
          : undefined;
        onInitialLoadProgress({
          percent: 42,
          label: "Cargando tiendas guardadas",
          detail: detectedStorage.managed
            ? "Leyendo proyectos confirmados en disco…"
            : "Leyendo proyectos locales del navegador…",
        });
        // Un recovery de disco es estado administrado: no caer al seeding de
        // IndexedDB, que intentaría volver a guardar con una versión nula.
        if (diskListing && (diskListing.projects.length > 0 || diskListing.recovery.length > 0)) {
          // El listing ya está validado en memoria; sólo hay que releer el disco
          // cuando una migración escribe sobre él.
          onInitialLoadProgress({
            percent: 54,
            label: "Sincronizando tus tiendas",
            detail: "Revisando migraciones y respaldos pendientes…",
          });
          let diskMutated = false;
          if (detectedStorage.writable) {
            await Promise.allSettled(
              diskListing.projects.map(async (diskProject) => {
                if (isBaseTemplate(diskProject.project)) return;
                const migrated = await migrateCatalogModernDemo(diskProject.project);
                const testimonialsExpanded = expandCatalogModernDemoTestimonials(migrated);
                if (testimonialsExpanded === diskProject.project && !diskProject.mediaRepairPending)
                  return;
                await markProjectMigration(diskProject.id, "pending");
                const saved = await persistToDisk(
                  testimonialsExpanded,
                  diskProject.diskVersion ?? null,
                );
                await markProjectMigration(diskProject.id, "done");
                diskProject.project = testimonialsExpanded;
                diskProject.diskVersion = saved.receipt.version;
                diskProject.mediaRepairPending = false;
                diskMutated = true;
              }),
            );
            const browserProjects = await listProjectsWithRecovery();
            const diskById = new Map(diskListing.projects.map((item) => [item.id, item]));
            await Promise.allSettled(
              browserProjects.projects.map(async (stored) => {
                if (isBaseTemplate(stored.project)) return;
                const diskProject = diskById.get(stored.id);
                if (!diskProject) {
                  await markProjectMigration(stored.id, "pending");
                  await persistToDisk(stored.project, null);
                  await markProjectMigration(stored.id, "done");
                  diskMutated = true;
                  return;
                }
                if (await getProjectMigration(diskProject.id)) {
                  await markProjectMigration(diskProject.id, "done");
                }
                if (
                  shouldSeedRecoveryDraft(
                    stored.project,
                    diskProject.project,
                    stored.project.updatedAt !== diskProject.project.updatedAt ||
                      stored.project.id !== diskProject.project.id,
                  )
                ) {
                  await saveRecoveryDraft(stored.project, diskProject.diskVersion ?? 0);
                }
              }),
            );
          }
          onInitialLoadProgress({
            percent: 78,
            label: "Validando tus tiendas",
            detail: "Aplicando recuperación y migraciones…",
          });
          if (diskMutated) {
            await refreshDisk();
          } else {
            setProjects(diskListing.projects);
            setRecovery(diskListing.recovery);
          }
          onInitialLoadProgress({
            percent: 94,
            label: "Ajustando el dashboard",
            detail: "Preparando la biblioteca de tiendas…",
          });
          return;
        }

        const result = await refreshBrowser();
        onInitialLoadProgress({
          percent: 52,
          label: "Cargando tiendas guardadas",
          detail: "Verificando la tienda base y sus recursos…",
        });
        if (consumeStorageResetNotice()) {
          setNotice(
            "Se reinició la base local para activar el contrato de tienda v2. Los respaldos y exportaciones no fueron modificados.",
          );
        }
        // La purga histórica sólo pertenece al perfil browser-only. En modo
        // administrado, IndexedDB puede contener RecoveryDrafts que deben
        // conservarse y reconciliarse con el almacenamiento comercial en disco.
        if (!detectedStorage.managed) await purgeNonDemoStores();
        onInitialLoadProgress({
          percent: 62,
          label: "Preparando la biblioteca",
          detail: "Verificando la tienda inicial y sus categorías…",
        });
        if (result.projects.length === 0 && result.recovery.length === 0) {
          await ensureFirstProject();
        }
        const demoCreated = await ensureScaleDemoProject();
        if (demoCreated) {
          notify("Se creó tu tienda base: reemplazá los placeholders con tus productos.");
        }
        const deprecatedCategoriesRemoved = await ensureDeprecatedCategoriesRemoved();
        if (deprecatedCategoriesRemoved) {
          notify(
            "Se retiraron las categorias Sale y Novedades; los productos y sus precios se conservaron.",
          );
        }
        onInitialLoadProgress({
          percent: 80,
          label: "Sincronizando el catálogo",
          detail: "Aplicando las últimas comprobaciones…",
        });
        const browserResult = await refreshBrowser();
        onInitialLoadProgress({
          percent: 92,
          label: "Ajustando el dashboard",
          detail: "Preparando la biblioteca de tiendas…",
        });
        if (detectedStorage.managed && detectedStorage.writable) {
          await Promise.allSettled(
            browserResult.projects.map(async (stored) => {
              if (isBaseTemplate(stored.project)) return;
              await markProjectMigration(stored.id, "pending");
              const { persistProjectToDisk } = await loadLocalProjectRepository();
              const result = await persistProjectToDisk(stored.project, null);
              await markProjectMigration(stored.id, "done");
              void result;
            }),
          );
          await refreshDisk();
          onInitialLoadProgress({
            percent: 96,
            label: "Ajustando el dashboard",
            detail: "Confirmando las tiendas guardadas en disco…",
          });
          notify("Las tiendas locales se migraron a proyectos/.");
        }
      } catch (reason) {
        bootFailed = true;
        setError(reason instanceof Error ? reason.message : "No se pudo abrir Studio.");
      } finally {
        setLoading(false);
        onInitialLoadProgress(
          bootFailed
            ? {
                percent: 100,
                label: "Arranque con avisos",
                detail: "El dashboard se abrirá con el estado disponible.",
              }
            : {
                percent: 100,
                label: "Todo listo",
                detail: "Abriendo tu espacio de trabajo…",
              },
        );
        onInitialLoadComplete();
      }
    })();
  }, [
    notify,
    onInitialLoadComplete,
    onInitialLoadProgress,
    persistToDisk,
    refreshBrowser,
    refreshDisk,
    gravityPreferences,
  ]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const onSwUpdate = () => setSwUpdateAvailable(true);
    window.addEventListener("solara-sw-update", onSwUpdate as unknown as EventListener);
    return () =>
      window.removeEventListener("solara-sw-update", onSwUpdate as unknown as EventListener);
  }, []);

  const guard = async (action: () => Promise<void>) => {
    setError("");
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La operación no pudo completarse.");
      throw reason;
    }
  };

  useEffect(() => {
    if (!active || storeLaunchCurtain !== "covering") return;
    const frame = window.requestAnimationFrame(() => setStoreLaunchCurtain("releasing"));
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [active, storeLaunchCurtain]);

  useEffect(() => {
    if (storeLaunchCurtain !== "releasing") return;
    const timer = window.setTimeout(() => setStoreLaunchCurtain("idle"), 560);
    return () => window.clearTimeout(timer);
  }, [storeLaunchCurtain]);

  const openSite = useCallback(async (id: string) => {
    const popup = window.open("about:blank", "_blank");
    try {
      const { openLocalSite } = await loadLocalStorage();
      const url = await openLocalSite(id);
      if (popup) popup.location.href = url;
      else window.open(url, "_blank");
    } catch (reason) {
      popup?.close();
      throw reason;
    }
  }, []);

  const importRecoveryArchive = async (file: File) => {
    await guard(async () => {
      const project = await optimizeProjectAssets(await readProjectArchiveInWorker(file));
      if (storageModeRef.current) {
        const existing = projects.find((item) => item.id === project.id) as
          | (StoredProject & { diskVersion?: number })
          | undefined;
        const recovered = recovery.find((item) => item.projectId === project.id);
        const expectedVersion = existing?.diskVersion ?? recovered?.diskVersion ?? null;
        const result = await persistToDisk(project, expectedVersion);
        setActiveDiskVersion(result.receipt.version);
        setActiveDiskBaseProject(project);
      } else {
        await saveProject(project);
      }
      await refresh();
      setActive(project);
    });
  };

  if (loading) {
    return null;
  }

  const banners = (
    <>
      {!isOnline ? (
        <output
          aria-live="polite"
          style={{
            background: "#b91c1c",
            color: "white",
            padding: "6px 12px",
            textAlign: "center",
            fontSize: "13px",
          }}
        >
          Sin conexion: los cambios se guardan localmente.
        </output>
      ) : null}
      {swUpdateAvailable ? (
        <output
          aria-live="polite"
          style={{
            background: "#1e40af",
            color: "white",
            padding: "6px 12px",
            textAlign: "center",
            fontSize: "13px",
          }}
        >
          Nueva version disponible{" "}
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem("solara-sw-update-available");
              } catch {}
              window.dispatchEvent(new CustomEvent("solara-sw-activate"));
              setSwUpdateAvailable(false);
            }}
            style={{
              marginLeft: 12,
              background: "white",
              color: "#1e40af",
              border: "none",
              padding: "4px 8px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Actualizar
          </button>{" "}
          <button
            type="button"
            onClick={() => setSwUpdateAvailable(false)}
            style={{
              marginLeft: 8,
              background: "transparent",
              color: "white",
              border: "1px solid white",
              padding: "4px 8px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        </output>
      ) : null}
    </>
  );

  if (active) {
    return (
      <ToastProvider>
        {banners}
        <Suspense
          fallback={
            <main className="boot-screen">
              <img
                className="brand-mark brand-mark--orbit"
                src="/branding/solara-orbit-64.png"
                srcSet="/branding/solara-orbit-32.png 32w, /branding/solara-orbit-64.png 64w, /branding/solara-orbit-128.png 128w, /branding/solara-orbit-256.png 256w"
                sizes="64px"
                alt=""
                width={64}
                height={64}
                decoding="async"
              />
              <h1>SolaraCommerce</h1>
              <p className="boot-screen__subtitle">Cargando el editor…</p>
            </main>
          }
        >
          <Studio
            key={`${active.id}:${active.updatedAt}`}
            initialProject={active}
            managedStorage={localStorageStatus.managed && localStorageStatus.writable}
            diskVersion={activeDiskVersion}
            {...(activeDiskBaseProject ? { diskBaseProject: activeDiskBaseProject } : {})}
            onDiskSaved={(receipt) => setActiveDiskVersion(receipt.version)}
            onBack={() => {
              setActive(undefined);
              setStoreLaunchCurtain("idle");
              setActiveDiskVersion(null);
              setActiveDiskBaseProject(undefined);
              void refresh();
            }}
            onProjectImported={async (project) => {
              const optimizedProject = await optimizeProjectAssets(project);
              if (storageModeRef.current) {
                const existing = projects.find((item) => item.id === optimizedProject.id) as
                  | (StoredProject & { diskVersion?: number })
                  | undefined;
                await persistToDisk(optimizedProject, existing?.diskVersion ?? null);
                setActiveDiskBaseProject(optimizedProject);
              } else {
                await saveProject(optimizedProject);
              }
              setActive(optimizedProject);
              await refresh();
            }}
            {...(localStorageStatus.managed
              ? { onOpenSite: (id: string) => guard(() => openSite(id)) }
              : {})}
            onReloadFromDisk={async () => {
              const result = await refreshDisk();
              const selected = result.projects.find((item) => item.id === active?.id) as
                | (StoredProject & { diskVersion?: number })
                | undefined;
              if (!selected?.project) {
                return {
                  ok: false as const,
                  message:
                    "La tienda ya no existe en disco. Tu borrador se conservó en este navegador.",
                };
              }
              await clearRecoveryDraft(selected.id);
              setActiveDiskVersion(selected.diskVersion ?? null);
              setActiveDiskBaseProject(selected.project);
              setActive(selected.project);
              return { ok: true as const };
            }}
            onDuplicateDraft={async (draft) => {
              const timestamp = new Date().toISOString();
              const suffix = crypto.randomUUID();
              const duplicate = StoreProjectV1Schema.parse({
                ...structuredClone(draft),
                id: `store-${suffix}`,
                name: `${draft.name} copia`,
                slug: slugify(`${draft.slug}-copia`, suffix.slice(0, 6)),
                status: "active",
                createdAt: timestamp,
                updatedAt: timestamp,
              });
              const optimizedDuplicate = await saveProject(duplicate);
              if (storageModeRef.current) {
                const result = await persistToDisk(optimizedDuplicate, null);
                setActiveDiskVersion(result.receipt.version);
              } else {
                setActiveDiskVersion(null);
              }
              await refresh();
              setActiveDiskBaseProject(optimizedDuplicate);
              setActive(optimizedDuplicate);
              return { ok: true as const };
            }}
          />
        </Suspense>
        <StoreLaunchCurtain phase={storeLaunchCurtain} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div
        className="app-root app-root--dashboard-cosmic"
        data-gargantua-debug="true"
        data-gargantua-settings-open={gravitySettingsOpen ? "true" : undefined}
      >
        <div className="dashboard-cosmic__banners">{banners}</div>
        <a className="skip-link" href="#tiendas">
          Saltar al contenido
        </a>
        <header className="app-header app-header--dashboard-cosmic">
          <a
            className="app-wordmark"
            href="/"
            aria-label="SolaraCommerce, inicio"
            title={`Build ${__BUILD_HASH__} · ${__BUILD_DATE__}`}
          >
            <img
              className="app-wordmark__logo"
              src="/branding/solara-orbit-64.png"
              alt="Logo de SolaraCommerce"
              width="42"
              height="42"
              srcSet="/branding/solara-orbit-32.png 32w, /branding/solara-orbit-64.png 64w, /branding/solara-orbit-128.png 128w, /branding/solara-orbit-192.png 192w, /branding/solara-orbit-256.png 256w"
              sizes="42px"
              decoding="async"
              fetchPriority="high"
            />
            <span>SolaraCommerce</span>
          </a>
          <nav className="app-header__nav" aria-label="Sección actual">
            <a href="#tiendas" aria-current="page">
              Tiendas
            </a>
          </nav>
          <div className="app-header__actions">
            <label
              className="app-gargantua-opacity-control"
              data-testid="gargantua-debug-controls"
              title="Ajustar opacidad de la interfaz del dashboard"
            >
              <span className="app-gargantua-opacity-control__label" aria-hidden="true">
                UI
              </span>
              <input
                id="gargantua-debug-ui-opacity"
                type="range"
                min="0"
                max="100"
                step="1"
                value={Math.round(gargantuaUiOpacity * 100)}
                onChange={(event) => setGargantuaUiOpacity(Number(event.target.value) / 100)}
                aria-label="Opacidad de la interfaz del dashboard"
              />
              <output htmlFor="gargantua-debug-ui-opacity">
                {Math.round(gargantuaUiOpacity * 100)}%
              </output>
            </label>
            {sessionManaged && !shutdownTerminal ? (
              <button
                className="app-shutdown-button"
                type="button"
                onClick={() => {
                  if (shutdownTerminal) return;
                  window.dispatchEvent(new CustomEvent("solara:open-shutdown"));
                }}
              >
                Cerrar app
              </button>
            ) : null}
            <button
              ref={gravitySettingsTriggerRef}
              className={`app-gargantua-settings-trigger${gravitySettingsOpen ? " is-active" : ""}`}
              type="button"
              aria-label="Ajustar animación del fondo"
              aria-expanded={gravitySettingsOpen}
              aria-controls={gravitySettingsPanelId}
              title="Ajustar animación del fondo"
              onClick={() => setGravitySettingsOpen((open) => !open)}
            >
              <GearSix aria-hidden size={17} />
            </button>
          </div>
        </header>
        <GravitySettingsPanel
          id={gravitySettingsPanelId}
          open={gravitySettingsOpen}
          settings={gravitySettings}
          customPresets={customGravityPresets}
          selectedCustomPreset={selectedCustomGravityPreset}
          activeCustomPreset={activeCustomGravityPreset}
          onChange={updateGravitySetting}
          onSelectBuiltInPreset={selectBuiltInGravityPreset}
          onSelectCustomPreset={selectCustomGravityPreset}
          onSaveCustomPreset={saveCustomGravityPreset}
          onTaaQualityChange={updateGravityTaaQuality}
          onToggleStaticDiskDetails={toggleGravityStaticDiskDetails}
          onTogglePauseWhenHidden={toggleGravityPauseWhenHidden}
          onReset={resetGravitySettings}
          onClose={closeGravitySettings}
        />
        {error ? (
          <div className="global-error">
            <InlineError>{error}</InlineError>
            <button type="button" onClick={() => setError("")} aria-label="Cerrar mensaje">
              <WarningCircle aria-hidden size={17} />
            </button>
          </div>
        ) : null}
        {error ? (
          <span data-testid="ui-global-error-text" className="visually-hidden">
            {error}
          </span>
        ) : null}
        {notice ? (
          <output className="global-notice" aria-live="polite">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")} aria-label="Cerrar aviso">
              <WarningCircle aria-hidden size={17} />
            </button>
          </output>
        ) : null}
        {recovery.length > 0 ? (
          <div className="global-warning" aria-live="polite">
            <div>
              <strong>{recovery.length} proyecto(s) requieren recuperación.</strong>
              <p>
                Studio no los abrió porque el respaldo local no pudo validarse. Conservá el archivo
                original y recuperá una copia compatible desde un respaldo .solara.json.
              </p>
              <ul>
                {recovery.map((item) => (
                  <li key={item.id}>
                    {item.name}: {item.message}
                  </li>
                ))}
              </ul>
            </div>
            <label className="button button--primary">
              Importar respaldo
              <input
                className="visually-hidden"
                type="file"
                accept=".json,.solara.json,application/json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importRecoveryArchive(file).catch(() => undefined);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        ) : null}
        <Dashboard
          clockOrigin={clockOrigin}
          gravitySettings={gravitySettings}
          settingsOpen={gravitySettingsOpen}
          projects={projects}
          onCreate={async (input) => {
            setError("");
            try {
              const project = await createProject(input);
              let activeProject = project;
              if (storageModeRef.current) {
                const saved = await persistToDisk(project, null);
                setActiveDiskVersion(saved.receipt.version);
                setActiveDiskBaseProject(project);
                const refreshed = await refresh();
                const refreshedProject = refreshed.projects.find((item) => item.id === project.id);
                if (refreshedProject) {
                  activeProject = refreshedProject.project;
                  setActiveDiskVersion(refreshedProject.diskVersion ?? saved.receipt.version);
                  setActiveDiskBaseProject(refreshedProject.project);
                }
              } else {
                await refresh();
              }
              setActive(activeProject);
            } catch (reason) {
              const message =
                reason instanceof Error ? reason.message : "No se pudo crear la tienda.";
              setError(message);
              throw new Error(message);
            }
          }}
          onImport={async (file) => {
            setError("");
            try {
              const project = await importProject(await readProjectArchiveInWorker(file));
              let activeProject = project;
              if (storageModeRef.current) {
                const saved = await persistToDisk(project, null);
                setActiveDiskVersion(saved.receipt.version);
                setActiveDiskBaseProject(project);
                const refreshed = await refresh();
                const refreshedProject = refreshed.projects.find((item) => item.id === project.id);
                if (refreshedProject) {
                  activeProject = refreshedProject.project;
                  setActiveDiskVersion(refreshedProject.diskVersion ?? saved.receipt.version);
                  setActiveDiskBaseProject(refreshedProject.project);
                }
              } else {
                await refresh();
              }
              setActive(activeProject);
            } catch (reason) {
              const message =
                reason instanceof Error ? reason.message : "No se pudo importar la tienda.";
              setError(message);
              throw new Error(message);
            }
          }}
          onOpen={async (id) => {
            setStoreLaunchCurtain("covering");
            try {
              await guard(async () => {
                let project: StoreProjectV1 | undefined;
                if (storageModeRef.current) {
                  // El listing es metadata barata; el respaldo completo sólo se
                  // re-descarga si el disco avanzó respecto del estado cargado.
                  const { loadDiskProject } = await loadLocalProjectRepository();
                  const { listLocalProjects } = await loadLocalStorage();
                  const listing = await listLocalProjects();
                  const summary = listing.projects.find((item) => item.projectId === id);
                  const cached = projects.find((item) => item.id === id) as
                    | (StoredProject & { diskVersion?: number })
                    | undefined;
                  let selected: (StoredProject & { diskVersion?: number }) | undefined;
                  if (cached && summary && cached.diskVersion === summary.version) {
                    selected = cached;
                  } else if (summary) {
                    const loaded = await loadDiskProject(summary);
                    selected = loaded;
                    setProjects((previous) => {
                      const withoutId = previous.filter((item) => item.id !== id);
                      return [...withoutId, loaded].sort((left, right) =>
                        right.updatedAt.localeCompare(left.updatedAt),
                      );
                    });
                  }
                  const diskProject = selected?.project;
                  project = diskProject;
                  setActiveDiskVersion(selected?.diskVersion ?? null);
                  setActiveDiskBaseProject(diskProject);
                  if (diskProject) {
                    const draft = await getRecoveryDraft(diskProject.id);
                    if (draft && JSON.stringify(draft.project) !== JSON.stringify(diskProject)) {
                      const recoveryDecision = await new Promise<RecoveryDraftDecision>((resolve) => {
                        pendingRecoverResolverRef.current = resolve;
                        setPendingRecover({ projectId: diskProject.id, draft: draft.project });
                      });
                      project = await resolveRecoveryDraftDecision(
                        recoveryDecision,
                        diskProject,
                        draft.project,
                        clearRecoveryDraft,
                      );
                      if (recoveryDecision === "recover") {
                        setNotice(
                          "Se recuperó el borrador local. Guardalo para confirmarlo en disco.",
                        );
                      }
                    }
                  }
                } else {
                  project = await getProject(id);
                  setActiveDiskVersion(null);
                  setActiveDiskBaseProject(undefined);
                }
                if (!project) throw new Error("No se encontró la tienda.");
                setActive(project);
              });
            } catch (reason) {
              setStoreLaunchCurtain("idle");
              throw reason;
            }
          }}
          onDuplicate={(id, name) =>
            guard(async () => {
              const duplicate = await duplicateProject(id);
              const trimmed = name?.trim();
              const named =
                trimmed && trimmed !== duplicate.name ? { ...duplicate, name: trimmed } : duplicate;
              if (storageModeRef.current) {
                await persistToDisk(named, null);
              } else if (named !== duplicate) {
                await saveProject(named);
              }
              await refresh();
            })
          }
          onArchive={(id, archived) =>
            guard(async () => {
              await setProjectArchived(id, archived);
              if (storageModeRef.current) {
                const project = await getProject(id);
                if (project) {
                  const selected = projects.find((item) => item.id === id) as
                    | (StoredProject & { diskVersion?: number })
                    | undefined;
                  await persistToDisk(project, selected?.diskVersion ?? null);
                }
              }
              await refresh();
            })
          }
          onDelete={(id) =>
            guard(async () => {
              if (storageModeRef.current) {
                const { deleteLocalProject } = await loadLocalStorage();
                try {
                  await deleteLocalProject(id);
                } catch (reason) {
                  // Si no existe en disco (p.ej. tienda sólo en navegador), se
                  // sigue con el borrado local: el mensaje del servidor lo dice.
                  const message = reason instanceof Error ? reason.message : "";
                  if (!message.includes("no existe en disco")) throw reason;
                }
              }
              await deleteProject(id);
              await refresh();
            })
          }
          onBackup={(id) =>
            guard(async () => {
              if (storageModeRef.current) {
                const { createLocalManualBackup } = await loadLocalStorage();
                await createLocalManualBackup(id);
                setNotice("Se creó un respaldo manual en proyectos/.");
                return;
              }
              const project = await getProject(id);
              if (!project) throw new Error("No se encontró la tienda.");
              const archive = await createProjectArchiveInWorker(project);
              downloadBlob(
                archive,
                `${project.slug}-respaldo.solara.json`,
                "application/vnd.solara.project+json",
              );
            })
          }
          {...(localStorageStatus.managed
            ? {
                onDownloadBackup: (id: string) =>
                  guard(async () => {
                    const selected = projects.find((item) => item.id === id);
                    const { readLocalProject } = await loadLocalStorage();
                    const bytes = await readLocalProject(id);
                    const version = selected?.diskVersion ? `-v${selected.diskVersion}` : "";
                    const filename = `${selected?.project.slug ?? "tienda"}${version}.solara.json`;
                    downloadBlob(bytes, filename, "application/vnd.solara.project+json");
                  }),
              }
            : {})}
          {...(localStorageStatus.managed
            ? {
                onOpenSite: (id: string) => guard(() => openSite(id)),
              }
            : {})}
          {...(localStorageStatus.managed
            ? {
                onOpenFolder: async (id: string) => {
                  await guard(async () => {
                    const { openLocalProjectFolder } = await loadLocalStorage();
                    await openLocalProjectFolder(id);
                  });
                },
              }
            : {})}
          onSessionManaged={setSessionManaged}
          shutdownTerminal={shutdownTerminal}
          onShutdownTerminal={setShutdownTerminal}
        />

        {pendingRecover && pendingRecoverDiscard ? (
          <ConfirmDialog
            title="Descartar borrador"
            body="Esta acción elimina el borrador de recuperación del navegador. La versión guardada en disco se conserva."
            confirmLabel="Descartar definitivamente"
            cancelLabel="Volver"
            danger
            onConfirm={() => {
              pendingRecoverResolverRef.current?.("discard");
              pendingRecoverResolverRef.current = null;
              setPendingRecoverDiscard(false);
              setPendingRecover(null);
            }}
            onCancel={() => setPendingRecoverDiscard(false)}
          />
        ) : pendingRecover ? (
          <ConfirmDialog
            title="Recuperar borrador"
            body={
              <>
                <p>
                  Hay un borrador sin guardar de esta tienda. Podés recuperarlo, exportar una copia
                  antes de decidir o cerrar este diálogo sin borrar nada.
                </p>
                <div className="confirm-dialog__actions-inline">
                  <Button
                    variant="quiet"
                    onClick={() =>
                      void guard(async () => {
                        const archive = await createProjectArchiveInWorker(pendingRecover.draft);
                        downloadBlob(
                          archive,
                          `${pendingRecover.draft.slug}-recovery.solara.json`,
                          "application/vnd.solara.project+json",
                        );
                        setNotice("Se exportó una copia del borrador de recuperación.");
                      })
                    }
                  >
                    Exportar borrador
                  </Button>
                  <Button variant="danger" onClick={() => setPendingRecoverDiscard(true)}>
                    Descartar borrador
                  </Button>
                </div>
              </>
            }
            confirmLabel="Recuperar borrador"
            cancelLabel="Cerrar sin borrar"
            onConfirm={() => {
              pendingRecoverResolverRef.current?.("recover");
              pendingRecoverResolverRef.current = null;
              setPendingRecover(null);
            }}
            onCancel={() => {
              pendingRecoverResolverRef.current?.("keep");
              pendingRecoverResolverRef.current = null;
              setPendingRecover(null);
            }}
          />
        ) : null}
      </div>
    </ToastProvider>
  );
}
