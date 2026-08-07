/**
 * Punto de composición de Studio: detecta el servidor local, carga la tienda
 * desde disco o Dexie, ofrece recovery drafts y entrega el proyecto al shell.
 * Las nuevas fuentes de persistencia deben integrarse aquí sin duplicar la
 * decisión de autoridad ni la inicialización de fixtures.
 */
import { WarningCircle } from "@phosphor-icons/react";
import type { StoreProjectV1 } from "@solara/project-schema";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
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
  type StoredProject,
  saveProject,
  saveRecoveryDraft,
  setProjectArchived,
} from "./lib/repository";
import { createProjectArchiveInWorker, readProjectArchiveInWorker } from "./lib/workers";

const loadLocalStorage = () => import("./lib/localStorage");
const loadLocalProjectRepository = () => import("./lib/localProjectRepository");
const Studio = lazy(() =>
  import("./features/Studio").then(({ Studio: Component }) => ({ default: Component })),
);

export function App() {
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
      <main className="boot-screen">
        <span className="brand-mark" aria-hidden>
          S
        </span>
        <h1>SolaraCommerce</h1>
        <Skeleton lines={3} />
      </main>
    );
  }

  if (active) {
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
        />
      </Suspense>
    );
  }

  return (
    <div className="app-root app-root--dashboard-cosmic">
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
        <output className="global-notice">
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
              Studio no los abrió porque no cumplen el schema actual. Conservá el archivo original y
              recuperá una copia compatible desde un respaldo .solara.json.
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
                    setNotice("Se recuperó el borrador local. Guardalo para confirmarlo en disco.");
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
        onDuplicate={(id) =>
          guard(async () => {
            const duplicate = await duplicateProject(id);
            if (storageModeRef.current) await persistToDisk(duplicate, null);
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
  );
}
