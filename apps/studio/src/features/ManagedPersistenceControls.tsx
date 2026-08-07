/**
 * Control explícito de persistencia cuando existe servidor local: mantiene el
 * RecoveryDraft como red de seguridad y sólo marca la versión como guardada
 * después del commit confirmado por disco.
 */
import { FloppyDisk } from "@phosphor-icons/react";
import type { StoreProjectV1 } from "@solara/project-schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { AutosaveQueue } from "../lib/autosave";
import type { LocalSaveReceipt } from "../lib/localStorage";
import { clearRecoveryDraft, saveRecoveryDraft } from "../lib/repository";

type DiskSaveState = "saved" | "saving" | "site-outdated" | "error";

export function ManagedPersistenceControls({
  project,
  diskVersion,
  diskBaseProject,
  validationError,
  onDirtyChange,
  onError,
  onSaved,
}: {
  project: StoreProjectV1;
  diskVersion: number | null;
  diskBaseProject?: StoreProjectV1;
  validationError: string;
  onDirtyChange(dirty: boolean): void;
  onError(message: string): void;
  onSaved?(receipt: LocalSaveReceipt): void;
}) {
  const [state, setState] = useState<DiskSaveState>("saved");
  const savedProjectRef = useRef(diskBaseProject ?? project);
  const lastProjectRef = useRef(project);
  const diskVersionRef = useRef(diskVersion);
  const saveInFlightRef = useRef(false);
  const saveRef = useRef<() => Promise<void>>(async () => undefined);
  const [draftQueue] = useState(
    () =>
      new AutosaveQueue(
        (value: StoreProjectV1) => saveRecoveryDraft(value, diskVersionRef.current ?? 0),
        550,
      ),
  );
  const dirty = project !== savedProjectRef.current;

  useEffect(() => {
    diskVersionRef.current = diskVersion;
  }, [diskVersion]);

  useEffect(() => {
    if (project === lastProjectRef.current) return;
    lastProjectRef.current = project;
    draftQueue.schedule(project);
  }, [draftQueue, project]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const save = useCallback(async () => {
    if (!dirty || saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setState("saving");
    onError("");
    try {
      await draftQueue.flush();
      const { persistProjectToDisk } = await import("../lib/localProjectRepository");
      const result = await persistProjectToDisk(project, diskVersionRef.current);
      await clearRecoveryDraft(project.id);
      savedProjectRef.current = project;
      diskVersionRef.current = result.receipt.version;
      onSaved?.(result.receipt);
      setState(result.siteError ? "site-outdated" : "saved");
      if (result.siteError) onError(result.siteError);
    } catch (reason) {
      setState("error");
      onError(reason instanceof Error ? reason.message : "No se pudo guardar la tienda en disco.");
    } finally {
      saveInFlightRef.current = false;
    }
  }, [dirty, draftQueue, onError, onSaved, project]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      void saveRef.current();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
      draftQueue.dispose();
    };
  }, [draftQueue]);

  return (
    <div className="save-status">
      <button
        type="button"
        className="save-button"
        data-studio-save
        disabled={!dirty || state === "saving"}
        onClick={() => void save()}
      >
        <FloppyDisk aria-hidden size={16} />
        Guardar
      </button>
      {validationError ? (
        <output className="save-indicator save-indicator--error" aria-live="assertive">
          Cambio inválido
        </output>
      ) : null}
      <output className={`save-indicator save-indicator--${state}`} aria-live="polite">
        <FloppyDisk aria-hidden size={16} />
        {state === "saved"
          ? "Guardado"
          : state === "saving"
            ? "Guardando en disco"
            : state === "site-outdated"
              ? "Sitio anterior conservado"
              : "Error al guardar"}
      </output>
      {state === "error" ? (
        <button type="button" className="save-retry" onClick={() => void save()}>
          Reintentar
        </button>
      ) : null}
    </div>
  );
}
