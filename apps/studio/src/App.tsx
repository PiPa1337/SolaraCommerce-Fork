/**
 * Punto de composición de Studio: detecta el servidor local, carga la tienda
 * desde disco o Dexie, ofrece recovery drafts y entrega el proyecto al shell.
 * Las nuevas fuentes de persistencia deben integrarse aquí sin duplicar la
 * decisión de autoridad ni la inicialización de fixtures.
 */
import { WarningCircle } from "@phosphor-icons/react";
import { type StoreProjectV1, StoreProjectV1Schema } from "@solara/project-schema";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
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
  ensureCatalogModernDemoReviews,
  ensureDeprecatedCategoriesRemoved,
  ensureFirstProject,
  ensureRevampDemoProject,
  ensureScaleDemoProject,
  getProject,
  getProjectMigration,
  getRecoveryDraft,
  listProjectsWithRecovery,
  markProjectMigration,
  type ProjectRecoveryIssue,
  REVAMP_DEMO_PROJECT_ID,
  type StoredProject,
  saveProject,
  saveRecoveryDraft,
  setProjectArchived,
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
  const [sessionManaged, setSessionManaged] = useState(false);
  const [localStorageStatus, setLocalStorageStatus] = useState<LocalStorageStatus>({
    managed: false,
    writable: false,
  });
  const [activeDiskVersion, setActiveDiskVersion] = useState<number | null>(null);
  const [activeDiskBaseProject, setActiveDiskBaseProject] = useState<StoreProjectV1 | undefined>();
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
        const { getLocalStorageStatus } = await loadLocalStorage();
        const detectedStorage = await getLocalStorageStatus().catch(() => ({
          managed: false,
          writable: false,
        }));
        storageModeRef.current = detectedStorage.managed;
        setLocalStorageStatus(detectedStorage);
        const diskListing = detectedStorage.managed
          ? await (await loadLocalProjectRepository()).loadAllDiskProjects()
          : undefined;
        if (diskListing?.projects.length) {
          if (detectedStorage.writable) {
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
              if (JSON.stringify(stored.project) !== JSON.stringify(diskProject.project)) {
                await saveRecoveryDraft(stored.project, diskProject.diskVersion ?? 0);
              }
            }
          }
          const revampOnDisk = diskListing.projects.some(
            (item) => item.id === REVAMP_DEMO_PROJECT_ID,
          );
          if (!revampOnDisk && detectedStorage.writable) {
            await ensureRevampDemoProject();
            const revamp = await getProject(REVAMP_DEMO_PROJECT_ID);
            if (revamp) {
              await persistToDisk(revamp, null);
              setNotice(
                "Se agregó la tienda Predeterminado Revamp para comparar la nueva experiencia de movimiento.",
              );
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
        if (result.projects.length === 0 && result.recovery.length === 0) {
          await ensureFirstProject();
        }
        const demoCreated = await ensureScaleDemoProject();
        if (demoCreated) {
          setNotice((current) =>
            current
              ? `${current} También se agregó la tienda Predeterminado con 50 productos para explorar la escala del catálogo.`
              : "Se agregó la tienda Predeterminado con 50 productos para explorar la escala del catálogo.",
          );
        }
        const revampCreated = await ensureRevampDemoProject();
        if (revampCreated) {
          setNotice((current) =>
            current
              ? `${current} Se agregó la tienda Predeterminado Revamp para comparar la nueva experiencia de movimiento.`
              : "Se agregó la tienda Predeterminado Revamp para comparar la nueva experiencia de movimiento.",
          );
        }
        const demoReviewsExpanded = await ensureCatalogModernDemoReviews();
        if (demoReviewsExpanded) {
          setNotice((current) =>
            current
              ? `${current} Se actualizaron las reseñas de Predeterminado.`
              : "Se actualizaron las reseñas de Predeterminado.",
          );
        }
        const deprecatedCategoriesRemoved = await ensureDeprecatedCategoriesRemoved();
        if (deprecatedCategoriesRemoved) {
          setNotice((current) =>
            current
              ? `${current} Se retiraron las categorias Sale y Novedades; los productos y sus precios se conservaron.`
              : "Se retiraron las categorias Sale y Novedades; los productos y sus precios se conservaron.",
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
          setNotice((current) =>
            current
              ? `${current} Se migraron las tiendas locales a proyectos/.`
              : "Las tiendas locales se migraron a proyectos/.",
          );
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "No se pudo abrir Studio.");
      } finally {
        setLoading(false);
      }
    })();
  }, [persistToDisk, refreshBrowser, refreshDisk]);

  const guard = async (action: () => Promise<void>) => {
    setError("");
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La operación no pudo completarse.");
    }
  };

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

  if (active) {
    return (
      <ToastProvider>
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
            <span className="app-local-status">Studio local</span>
            <span className="app-local-indicator" aria-hidden />
            {sessionManaged ? (
              <button
                className="app-shutdown-button"
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("solara:open-shutdown"))}
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
                  if (file) void importRecoveryArchive(file);
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
                    const recover = window.confirm(
                      "Hay un borrador sin guardar de esta tienda. ¿Querés recuperarlo?",
                    );
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
            })
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
                onOpenSite: async (id: string) => {
                  const popup = window.open("about:blank", "_blank");
                  await guard(async () => {
                    try {
                      const { openLocalSite } = await loadLocalStorage();
                      const url = await openLocalSite(id);
                      if (popup) popup.location.href = url;
                      else window.open(url, "_blank");
                    } catch (reason) {
                      popup?.close();
                      throw reason;
                    }
                  });
                },
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
        />
      </div>
    </ToastProvider>
  );
}
