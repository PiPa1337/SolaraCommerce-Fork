/**
 * Diálogo de duplicado con nombre sugerido editable, estado de generación y
 * errores inline. El nombre elegido se propaga a `onDuplicate` para que el
 * handler de App lo aplique al proyecto creado.
 */
import { Copy, X } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import { Button, Field, IconButton, InlineError } from "../../components/Ui";
import type { StoredProject } from "../../lib/repository";

export interface DuplicateDialogProps {
  project: StoredProject | undefined;
  onClose(): void;
  onDuplicate(id: string, name: string): Promise<void>;
  onDone(): void;
}

export function DuplicateDialog({ project, onClose, onDuplicate, onDone }: DuplicateDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = project !== undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setName(`${project.name} (copia)`);
      setError("");
      dialog.showModal();
      requestAnimationFrame(() => nameInputRef.current?.focus());
    }
    if (!open && dialog.open) dialog.close();
  }, [open, project]);

  const confirm = async () => {
    if (!project || busy) return;
    setBusy(true);
    setError("");
    try {
      await onDuplicate(project.id, name.trim() || `${project.name} (copia)`);
      onDone();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo duplicar la tienda.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="dashboard-cosmic-dialog"
      aria-labelledby={titleId}
      data-testid="ui-duplicate-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          void confirm();
        }}
      >
        <header className="dashboard-cosmic-dialog__header">
          <div>
            <span className="dashboard-cosmic-kicker">Duplicar proyecto</span>
            <h2 id={titleId}>Duplicar tienda</h2>
          </div>
          <IconButton icon={X} label="Cancelar duplicado" disabled={busy} onClick={onClose} />
        </header>
        <p className="dashboard-cosmic-dialog__summary">
          Se creará una copia completa de <strong>{project?.name}</strong>: catálogo, tema,
          secciones y configuración.
        </p>
        <Field label="Nuevo nombre">
          <input
            ref={nameInputRef}
            data-testid="ui-duplicate-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
          />
        </Field>
        {error ? <InlineError>{error}</InlineError> : null}
        <footer className="dashboard-cosmic-dialog__actions">
          <Button variant="quiet" type="button" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" icon={Copy} disabled={busy} type="submit">
            {busy ? "Duplicando…" : "Duplicar"}
          </Button>
        </footer>
      </form>
    </dialog>
  );
}
