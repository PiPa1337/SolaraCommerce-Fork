import { WarningCircle } from "@phosphor-icons/react";
import type { StoreProjectV1 } from "@solara/project-schema";
import { useCallback, useEffect, useState } from "react";
import { InlineError, Skeleton } from "./components/Ui";
import { Dashboard } from "./features/Dashboard";
import { Studio } from "./features/Studio";
import { downloadBlob } from "./lib/projectArchive";
import {
  consumeStorageResetNotice,
  createProject,
  duplicateProject,
  ensureDeprecatedCategoriesRemoved,
  ensureFirstProject,
  ensureScaleDemoProject,
  getProject,
  listProjectsWithRecovery,
  type ProjectRecoveryIssue,
  type StoredProject,
  saveProject,
  setProjectArchived,
} from "./lib/repository";
import { createProjectArchiveInWorker, readProjectArchiveInWorker } from "./lib/workers";

export function App() {
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [active, setActive] = useState<StoreProjectV1>();
  const [recovery, setRecovery] = useState<ProjectRecoveryIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sessionManaged, setSessionManaged] = useState(false);

  const refresh = useCallback(async () => {
    const result = await listProjectsWithRecovery();
    setProjects(result.projects);
    setRecovery(result.recovery);
    return result;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const result = await refresh();
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
        const deprecatedCategoriesRemoved = await ensureDeprecatedCategoriesRemoved();
        if (deprecatedCategoriesRemoved) {
          setNotice((current) =>
            current
              ? `${current} Se retiraron las categorias Sale y Novedades; los productos y sus precios se conservaron.`
              : "Se retiraron las categorias Sale y Novedades; los productos y sus precios se conservaron.",
          );
        }
        await refresh();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "No se pudo abrir Studio.");
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

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
      await saveProject(project);
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
      <Studio
        key={`${active.id}:${active.updatedAt}`}
        initialProject={active}
        onBack={() => {
          setActive(undefined);
          void refresh();
        }}
        onProjectImported={async (project) => {
          await saveProject(project);
          setActive(project);
          await refresh();
        }}
      />
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
              recuperá una copia compatible desde un respaldo .solara.zip.
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
              accept=".zip,.solara.zip,application/zip"
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
            await refresh();
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
            const project = await getProject(id);
            if (!project) throw new Error("No se encontró la tienda.");
            setActive(project);
          })
        }
        onDuplicate={(id) =>
          guard(async () => {
            await duplicateProject(id);
            await refresh();
          })
        }
        onArchive={(id, archived) =>
          guard(async () => {
            await setProjectArchived(id, archived);
            await refresh();
          })
        }
        onBackup={(id) =>
          guard(async () => {
            const project = await getProject(id);
            if (!project) throw new Error("No se encontró la tienda.");
            const archive = await createProjectArchiveInWorker(project);
            downloadBlob(archive, `${project.slug}-respaldo.solara.zip`, "application/zip");
          })
        }
        onSessionManaged={setSessionManaged}
      />
    </div>
  );
}
