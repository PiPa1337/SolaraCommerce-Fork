import { WarningCircle } from "@phosphor-icons/react";
import type { StoreProjectV1 } from "@solara/project-schema";
import { useCallback, useEffect, useState } from "react";
import { InlineError, Skeleton } from "./components/Ui";
import { Dashboard } from "./features/Dashboard";
import { Studio } from "./features/Studio";
import {
  createProject,
  duplicateProject,
  ensureFirstProject,
  getProject,
  listProjectsWithRecovery,
  type ProjectRecoveryIssue,
  type StoredProject,
  saveProject,
  setProjectArchived,
} from "./lib/repository";
import { readProjectArchiveInWorker } from "./lib/workers";

export function App() {
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [active, setActive] = useState<StoreProjectV1>();
  const [recovery, setRecovery] = useState<ProjectRecoveryIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        if (result.projects.length === 0 && result.recovery.length === 0) {
          await ensureFirstProject();
          await refresh();
        }
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
    <div className="app-root">
      <header className="app-header">
        <a className="app-wordmark" href="/" aria-label="SolaraCommerce, inicio">
          <span className="brand-mark" aria-hidden>
            S
          </span>
          <span>SolaraCommerce</span>
        </a>
        <p>Studio local</p>
      </header>
      {error ? (
        <div className="global-error">
          <InlineError>{error}</InlineError>
          <button type="button" onClick={() => setError("")} aria-label="Cerrar mensaje">
            <WarningCircle aria-hidden size={17} />
          </button>
        </div>
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
        onCreate={(name) =>
          guard(async () => {
            const project = await createProject(name);
            await refresh();
            setActive(project);
          })
        }
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
      />
    </div>
  );
}
