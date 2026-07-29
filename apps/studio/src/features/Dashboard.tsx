import { Archive, ArrowCounterClockwise, Copy, Plus, Storefront } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { Button, EmptyState, Field, SectionHeader } from "../components/Ui";
import { formatDate } from "../lib/format";
import type { StoredProject } from "../lib/repository";

interface DashboardProps {
  projects: StoredProject[];
  onCreate(name: string): Promise<void>;
  onOpen(id: string): void;
  onDuplicate(id: string): Promise<void>;
  onArchive(id: string, archived: boolean): Promise<void>;
}

export function Dashboard({ projects, onCreate, onOpen, onDuplicate, onArchive }: DashboardProps) {
  const [view, setView] = useState<"active" | "archived">("active");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const reduceMotion = useReducedMotion();
  const visible = useMemo(
    () => projects.filter((record) => record.status === view),
    [projects, view],
  );

  const submit = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await onCreate(name);
      setName("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="dashboard-page">
      <div className="dashboard-wrap">
        <SectionHeader
          title="Tus tiendas"
          description="Cada tienda vive en este dispositivo y se puede respaldar como archivo Solara."
          actions={
            <fieldset className="segmented">
              <legend className="visually-hidden">Estado de tiendas</legend>
              <button
                type="button"
                aria-pressed={view === "active"}
                onClick={() => setView("active")}
              >
                Activas
              </button>
              <button
                type="button"
                aria-pressed={view === "archived"}
                onClick={() => setView("archived")}
              >
                Archivadas
              </button>
            </fieldset>
          }
        />

        <form
          className="create-store"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field label="Nueva tienda">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre comercial"
              autoComplete="organization"
            />
          </Field>
          <Button variant="primary" icon={Plus} disabled={!name.trim() || creating} type="submit">
            {creating ? "Creando" : "Crear tienda"}
          </Button>
        </form>

        {visible.length === 0 ? (
          <EmptyState
            icon={view === "active" ? Storefront : Archive}
            title={view === "active" ? "No hay tiendas activas" : "No hay tiendas archivadas"}
            body={
              view === "active"
                ? "Creá una tienda para empezar a organizar catálogo, diseño y exportación."
                : "Las tiendas archivadas aparecen acá y se pueden restaurar."
            }
          />
        ) : (
          <div className="store-list">
            {visible.map((record, index) => (
              <motion.article
                className="store-row"
                key={record.id}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: index * 0.035 }}
              >
                <button className="store-open" type="button" onClick={() => onOpen(record.id)}>
                  <span className="store-monogram" aria-hidden>
                    {record.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{record.name}</strong>
                    <small>
                      {record.project.products.length} productos, guardada{" "}
                      {formatDate(record.updatedAt)}
                    </small>
                  </span>
                </button>
                <div className="row-actions">
                  {view === "active" ? (
                    <>
                      <Button
                        variant="quiet"
                        icon={Copy}
                        onClick={() => void onDuplicate(record.id)}
                      >
                        Duplicar
                      </Button>
                      <Button
                        variant="quiet"
                        icon={Archive}
                        onClick={() => void onArchive(record.id, true)}
                      >
                        Archivar
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="quiet"
                      icon={ArrowCounterClockwise}
                      onClick={() => void onArchive(record.id, false)}
                    >
                      Restaurar
                    </Button>
                  )}
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
