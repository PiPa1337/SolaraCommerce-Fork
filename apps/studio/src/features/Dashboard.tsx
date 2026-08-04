import {
  Archive,
  ArrowCounterClockwise,
  Copy,
  Plus,
  Power,
  Storefront,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, EmptyState, Field, InlineError, SectionHeader } from "../components/Ui";
import { formatDate } from "../lib/format";
import type { StoredProject } from "../lib/repository";

interface DashboardProps {
  projects: StoredProject[];
  onCreate(input: { name: string; brandName: string; email: string; phone: string }): Promise<void>;
  onOpen(id: string): void;
  onDuplicate(id: string): Promise<void>;
  onArchive(id: string, archived: boolean): Promise<void>;
}

export function Dashboard({ projects, onCreate, onOpen, onDuplicate, onArchive }: DashboardProps) {
  const [view, setView] = useState<"active" | "archived">("active");
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [shutdownState, setShutdownState] = useState<
    "checking" | "unavailable" | "available" | "closing" | "closed"
  >("checking");
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);
  const [shutdownError, setShutdownError] = useState("");
  const shutdownDialogRef = useRef<HTMLDialogElement>(null);
  const reduceMotion = useReducedMotion();
  const visible = useMemo(
    () => projects.filter((record) => record.status === view),
    [projects, view],
  );

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
      .then((managed) => setShutdownState(managed ? "available" : "unavailable"))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setShutdownState("unavailable");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const dialog = shutdownDialogRef.current;
    if (!dialog) return;
    if (shutdownDialogOpen && !dialog.open) dialog.showModal();
    if (!shutdownDialogOpen && dialog.open) dialog.close();
  }, [shutdownDialogOpen]);

  const requestShutdown = async () => {
    setShutdownState("closing");
    setShutdownError("");
    try {
      const response = await fetch("/__solara/shutdown", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("El servidor no aceptó el cierre.");
      setShutdownDialogOpen(false);
      setShutdownState("closed");
    } catch {
      setShutdownState("available");
      setShutdownError("No se pudo detener el servidor local.");
    }
  };

  const submit = async () => {
    if (step < 4) {
      setStep((current) => (current + 1) as 1 | 2 | 3 | 4);
      return;
    }
    if (!name.trim()) return;
    setCreating(true);
    try {
      await onCreate({ name, brandName: brandName || name, email, phone });
      setName("");
      setBrandName("");
      setEmail("");
      setPhone("");
      setStep(1);
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="dashboard-page">
      <div className="dashboard-wrap">
        <p className="dashboard-kicker">SolaraCommerce · Estudio local</p>
        <SectionHeader
          title="Tus tiendas"
          description="Cada tienda vive en este dispositivo y se puede respaldar como archivo Solara."
          actions={
            <div className="dashboard-session-actions">
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
              {shutdownState === "available" ? (
                <Button
                  variant="danger"
                  icon={Power}
                  onClick={() => {
                    setShutdownError("");
                    setShutdownDialogOpen(true);
                  }}
                >
                  Cerrar app
                </Button>
              ) : null}
            </div>
          }
        />

        {shutdownState === "closed" ? (
          <output className="shutdown-status">
            <strong>Servidor local detenido.</strong>
            <span>Podés cerrar esta pestaña del navegador.</span>
          </output>
        ) : null}

        <form
          className="create-store"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="create-store__intro">
            <span>Nuevo proyecto</span>
            <p>Empezá con una tienda completa y personalizala desde el constructor.</p>
          </div>
          <Field label="Nueva tienda">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre comercial"
              autoComplete="organization"
            />
          </Field>
          <ol className="create-store__steps" aria-label="Pasos para preparar la tienda">
            <li className={step >= 1 ? "is-active" : ""}>1 Marca</li>
            <li className={step >= 2 ? "is-active" : ""}>2 Identidad y assets</li>
            <li className={step >= 3 ? "is-active" : ""}>3 Catálogo</li>
            <li className={step >= 4 ? "is-active" : ""}>4 Revisión</li>
          </ol>
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
            <p className="create-store__summary">
              La plantilla deja listos los textos, la navegación y los espacios para tus imágenes.
              Después podrás reemplazar logo, media y copy desde Recursos y Constructor.
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
              <p className="create-store__summary">
                El catálogo comienza vacío. Al entrar a Catálogo podrás cargar productos uno a uno o
                importar el CSV comercial con variantes, categorías, colecciones e imágenes.
              </p>
            </div>
          ) : null}
          {step === 4 ? (
            <p className="create-store__summary" aria-live="polite">
              Vas a crear una tienda vacía con el diseño Catalog Modern. Después podrás cargar
              productos, imágenes y textos desde Studio. La demo de 50 productos queda disponible
              como proyecto separado.
            </p>
          ) : null}
          <div className="create-store__actions">
            {step > 1 ? (
              <Button
                variant="quiet"
                type="button"
                onClick={() => setStep((current) => (current - 1) as 1 | 2 | 3 | 4)}
              >
                Atrás
              </Button>
            ) : null}
            <Button variant="primary" icon={Plus} disabled={!name.trim() || creating} type="submit">
              {creating ? "Creando" : step === 4 ? "Crear tienda vacía" : "Continuar"}
            </Button>
          </div>
          <p className="create-store__seed-note">
            Plantilla: Catalog Modern · catálogo vacío guiado
          </p>
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
            <header className="store-list__header">
              <span>{view === "active" ? "Proyectos activos" : "Archivo"}</span>
              <span>{visible.length.toString().padStart(2, "0")}</span>
            </header>
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
                    <span className="store-row__template">
                      {record.project.origin?.seed === "clean"
                        ? "Plantilla guiada · catálogo listo para cargar"
                        : "Predeterminado · tienda ficticia con 50 productos"}
                    </span>
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
      <dialog
        ref={shutdownDialogRef}
        className="shutdown-dialog"
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
          <h2>¿Cerrar SolaraCommerce?</h2>
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
              {shutdownState === "closing" ? "Cerrando…" : "Cerrar y detener"}
            </Button>
          </div>
        </form>
      </dialog>
    </main>
  );
}
