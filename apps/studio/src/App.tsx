/**
 * Punto de composición de Studio: detecta el servidor local, carga la tienda
 * desde disco o Dexie, ofrece recovery drafts y entrega el proyecto al shell.
 * Las nuevas fuentes de persistencia deben integrarse aquí sin duplicar la
 * decisión de autoridad ni la inicialización de fixtures.
 */
import { WarningCircle } from "@phosphor-icons/react";
import { type StoreProjectV1, StoreProjectV1Schema } from "@solara/project-schema";
import {
  Component,
  type ErrorInfo,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ToastProvider } from "./components/Toast";
import { InlineError, Skeleton } from "./components/Ui";
import { Dashboard } from "./features/Dashboard";
import type { LocalStorageStatus } from "./lib/localStorage";
import { downloadBlob } from "./lib/projectArchive";
import {
  clearRecoveryDraft,
  consumeStorageResetNotice,
  createProject,
  duplicateProject,
  ensureDemoSectionOrder,
  ensureDeprecatedCategoriesRemoved,
  ensureFirstProject,
  ensureScaleDemoProject,
  expandCatalogModernDemoTestimonials,
  getProject,
  getProjectMigration,
  getRecoveryDraft,
  listProjectsWithRecovery,
  markProjectMigration,
  migrateCatalogModernDemo,
  type ProjectRecoveryIssue,
  purgeNonDemoStores,
  purgeRolledBackDemoRecords,
  retireLegacyDemoProjects,
  SCALE_DEMO_PROJECT_ID,
  type StoredProject,
  saveProject,
  saveRecoveryDraft,
  setProjectArchived,
  shouldSeedRecoveryDraft,
  slugify,
} from "./lib/repository";
import { createProjectArchiveInWorker, readProjectArchiveInWorker } from "./lib/workers";

const loadLocalStorage = () => import("./lib/localStorage");
const loadLocalProjectRepository = () => import("./lib/localProjectRepository");
const ComponentGallery = lazy(() =>
  import("./debug/ComponentGallery").then(({ ComponentGallery: Gallery }) => ({
    default: Gallery,
  })),
);
const Studio = lazy(() =>
  import("./features/Studio").then(({ Studio: Component }) => ({ default: Component })),
);

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
        <span className="brand-mark" aria-hidden>
          S
        </span>
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
            <span className="brand-mark" aria-hidden>
              S
            </span>
            <h1>SolaraCommerce</h1>
            <Skeleton lines={3} />
          </main>
        }
      >
        <ComponentGallery />
      </Suspense>
    );
  }
  return <StudioShell />;
}

function StudioShell() {
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [active, setActive] = useState<StoreProjectV1>();
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
  const pendingRecoverResolverRef = useRef<((recover: boolean) => void) | null>(null);
  const storageModeRef = useRef(false);

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
      const { persistProjectToDisk } = await loadLocalProjectRepository();
      const result = await persistProjectToDisk(project, expectedVersion);
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
      try {
        await purgeRolledBackDemoRecords();
        const { getLocalStorageStatus } = await loadLocalStorage();
        const detectedStorage = await getLocalStorageStatus().catch(() => ({
          managed: false,
          writable: false,
        }));
        storageModeRef.current = detectedStorage.managed;
        setLocalStorageStatus(detectedStorage);
        let retiredLegacyProjects = false;
        if (detectedStorage.managed && detectedStorage.writable) {
          const { retireLegacyDemoProjectsOnDisk } = await loadLocalStorage();
          const removedFromDisk = await retireLegacyDemoProjectsOnDisk();
          retiredLegacyProjects = removedFromDisk.length > 0;
        }
        if (!detectedStorage.managed || detectedStorage.writable) {
          retiredLegacyProjects = (await retireLegacyDemoProjects()) || retiredLegacyProjects;
        }
        if (retiredLegacyProjects) {
          notify("Se retiraron las referencias legacy; la demo V2 es la única demo integrada.");
        }
        const diskListing = detectedStorage.managed
          ? await (await loadLocalProjectRepository()).loadAllDiskProjects()
          : undefined;
        if (diskListing?.projects.length) {
          if (detectedStorage.writable) {
            await purgeNonDemoStores();
            const reordered = await ensureDemoSectionOrder();
            if (reordered) {
              // El reorden vive en IndexedDB; se confirma en disco para que
              // el arranque no quede con un draft divergente y el siguiente
              // Guardar exporte la home con el orden nuevo.
              const demo = await getProject(SCALE_DEMO_PROJECT_ID);
              const diskDemo = diskListing.projects.find(
                (item) => item.id === SCALE_DEMO_PROJECT_ID,
              );
              if (demo) {
                await markProjectMigration(demo.id, "pending");
                const saved = await persistToDisk(demo, diskDemo?.diskVersion ?? null);
                await markProjectMigration(demo.id, "done");
                if (diskDemo) {
                  diskDemo.project = demo;
                  diskDemo.diskVersion = saved.receipt.version;
                }
              }
            }
            for (const diskProject of diskListing.projects) {
              const migrated = await migrateCatalogModernDemo(diskProject.project);
              const testimonialsExpanded = expandCatalogModernDemoTestimonials(migrated);
              if (testimonialsExpanded === diskProject.project) continue;
              await markProjectMigration(diskProject.id, "pending");
              const saved = await persistToDisk(
                testimonialsExpanded,
                diskProject.diskVersion ?? null,
              );
              await markProjectMigration(diskProject.id, "done");
              diskProject.project = testimonialsExpanded;
              diskProject.diskVersion = saved.receipt.version;
            }
            const browserProjects = await listProjectsWithRecovery();
            const diskById = new Map(diskListing.projects.map((item) => [item.id, item]));
            for (const stored of browserProjects.projects) {
              const diskProject = diskById.get(stored.id);
              if (!diskProject) {
                await markProjectMigration(stored.id, "pending");
                await persistToDisk(stored.project, null);
                await markProjectMigration(stored.id, "done");
                continue;
              }
              if (await getProjectMigration(diskProject.id)) {
                await markProjectMigration(diskProject.id, "done");
              }
              if (
                shouldSeedRecoveryDraft(
                  stored.project,
                  diskProject.project,
                  JSON.stringify(stored.project) !== JSON.stringify(diskProject.project),
                )
              ) {
                await saveRecoveryDraft(stored.project, diskProject.diskVersion ?? 0);
              }
            }
          }
          await refreshDisk();
          return;
        }

        const result = await refreshBrowser();
        if (consumeStorageResetNotice()) {
          setNotice(
            "Se reinició la base local para activar el contrato de tienda v2. Los respaldos y exportaciones no fueron modificados.",
          );
        }
        await purgeNonDemoStores();
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
        const browserResult = await refreshBrowser();
        if (detectedStorage.managed && detectedStorage.writable) {
          for (const stored of browserResult.projects) {
            await markProjectMigration(stored.id, "pending");
            await persistToDisk(stored.project, null);
            await markProjectMigration(stored.id, "done");
          }
          await refreshDisk();
          notify("Las tiendas locales se migraron a proyectos/.");
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "No se pudo abrir Studio.");
      } finally {
        setLoading(false);
      }
    })();
  }, [notify, persistToDisk, refreshBrowser, refreshDisk]);

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
      const project = await readProjectArchiveInWorker(file);
      if (storageModeRef.current) {
        const existing = projects.find((item) => item.id === project.id) as
          | (StoredProject & { diskVersion?: number })
          | undefined;
        const result = await persistToDisk(project, existing?.diskVersion ?? null);
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
    return (
      <ToastProvider>
        <main className="boot-screen">
          <span className="brand-mark" aria-hidden>
            S
          </span>
          <h1>SolaraCommerce</h1>
          <Skeleton lines={3} />
        </main>
      </ToastProvider>
    );
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
              <span className="brand-mark" aria-hidden>
                S
              </span>
              <h1>SolaraCommerce</h1>
              <Skeleton lines={3} />
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
              setActiveDiskVersion(null);
              setActiveDiskBaseProject(undefined);
              void refresh();
            }}
            onProjectImported={async (project) => {
              if (storageModeRef.current) {
                const existing = projects.find((item) => item.id === project.id) as
                  | (StoredProject & { diskVersion?: number })
                  | undefined;
                await persistToDisk(project, existing?.diskVersion ?? null);
                setActiveDiskBaseProject(project);
              } else {
                await saveProject(project);
              }
              setActive(project);
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
              await saveProject(duplicate);
              if (storageModeRef.current) {
                const result = await persistToDisk(duplicate, null);
                setActiveDiskVersion(result.receipt.version);
              } else {
                setActiveDiskVersion(null);
              }
              await refresh();
              setActiveDiskBaseProject(duplicate);
              setActive(duplicate);
              return { ok: true as const };
            }}
          />
        </Suspense>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      {banners}
      <div className="app-root app-root--dashboard-cosmic">
        <a className="skip-link" href="#tiendas">
          Saltar al contenido
        </a>
        <header className="app-header app-header--dashboard-cosmic">
          <a className="app-wordmark" href="/" aria-label="SolaraCommerce, inicio">
            <img
              className="app-wordmark__logo"
              src="/branding/solara-orbit-64.png"
              alt="Logo de SolaraCommerce"
              width="64"
              height="64"
              srcSet="/branding/solara-orbit-32.png 32w, /branding/solara-orbit-64.png 64w, /branding/solara-orbit-128.png 128w, /branding/solara-orbit-256.png 256w"
              sizes="40px"
              decoding="async"
            />
            <span>SolaraCommerce</span>
          </a>
          <nav className="app-header__nav" aria-label="Sección actual">
            <a href="#tiendas" aria-current="page">
              Tiendas
            </a>
          </nav>
          <div className="app-header__actions">
            <span className="app-local-status">
              Studio local · {__BUILD_HASH__} · {__BUILD_DATE__}
            </span>
            <span className="app-local-indicator" aria-hidden />
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
          </div>
        </header>
        {error ? (
          <div className="global-error">
            <InlineError>{error}</InlineError>
            <button type="button" onClick={() => setError("")} aria-label="Cerrar mensaje">
              <WarningCircle aria-hidden size={17} />
            </button>
          </div>
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
                Studio no los abrió porque no cumplen el schema actual. Conservá el archivo original
                y recuperá una copia compatible desde un respaldo .solara.json.
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
          projects={projects}
          onCreate={async (input) => {
            setError("");
            try {
              const project = await createProject(input);
              if (storageModeRef.current) await persistToDisk(project, null);
              await refresh();
              if (storageModeRef.current) setActiveDiskVersion(1);
              setActive(project);
            } catch (reason) {
              const message =
                reason instanceof Error ? reason.message : "No se pudo crear la tienda.";
              setError(message);
              throw new Error(message);
            }
          }}
          onOpen={(id) =>
            void guard(async () => {
              let project: StoreProjectV1 | undefined;
              if (storageModeRef.current) {
                const result = await refreshDisk();
                const selected = result.projects.find((item) => item.id === id) as
                  | (StoredProject & { diskVersion?: number })
                  | undefined;
                const diskProject = selected?.project;
                project = diskProject;
                setActiveDiskVersion(selected?.diskVersion ?? null);
                setActiveDiskBaseProject(diskProject);
                if (diskProject) {
                  const draft = await getRecoveryDraft(diskProject.id);
                  if (draft && JSON.stringify(draft.project) !== JSON.stringify(diskProject)) {
                    const recover = await new Promise<boolean>((resolve) => {
                      pendingRecoverResolverRef.current = resolve;
                      setPendingRecover({ projectId: diskProject.id, draft: draft.project });
                    });
                    if (recover) {
                      project = draft.project;
                      setNotice(
                        "Se recuperó el borrador local. Guardalo para confirmarlo en disco.",
                      );
                    } else {
                      await clearRecoveryDraft(diskProject.id);
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
            }).catch(() => undefined)
          }
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
                    downloadBlob(
                      bytes,
                      `${selected?.project.slug ?? "tienda"}${version}.solara.json`,
                      "application/vnd.solara.project+json",
                    );
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

        {pendingRecover ? (
          <ConfirmDialog
            title="Recuperar borrador"
            body="Hay un borrador sin guardar de esta tienda. ¿Querés recuperarlo? Si lo descartás, se borra del navegador y se abre la versión del disco."
            confirmLabel="Recuperar borrador"
            cancelLabel="Descartar borrador"
            onConfirm={() => {
              pendingRecoverResolverRef.current?.(true);
              pendingRecoverResolverRef.current = null;
              setPendingRecover(null);
            }}
            onCancel={() => {
              pendingRecoverResolverRef.current?.(false);
              pendingRecoverResolverRef.current = null;
              setPendingRecover(null);
            }}
          />
        ) : null}
      </div>
    </ToastProvider>
  );
}
