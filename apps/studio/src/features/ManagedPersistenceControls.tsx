/**
 * Control explícito de persistencia cuando existe servidor local: mantiene el
 * RecoveryDraft como red de seguridad y sólo marca la versión como guardada
 * después del commit confirmado por disco.
 */
import { CheckCircle, FloppyDisk } from "@phosphor-icons/react";
import type { StoreProjectV1 } from "@solara/project-schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { InlineError } from "../components/Ui";
import { AutosaveQueue } from "../lib/autosave";
import { type LocalSaveReceipt, LocalStorageError } from "../lib/localStorage";
import { clearRecoveryDraft, saveRecoveryDraft } from "../lib/repository";
import { formatSaveTime } from "../lib/saveTime";

type DiskSaveState = "saved" | "saving" | "site-outdated" | "error";

/**
 * Texto del indicador de guardado administrado. Con `dirty` y estado `saved`
 * el editor tiene cambios pendientes: el rótulo debe anunciarlo y no decir
 * «Guardado» (feedback coherente con la lógica del botón). En el estado
 * `error` el rótulo lleva el mensaje: el bloque completo (InlineError +
 * Reintentar) desborda el topbar fijo y queda tapado por el iframe del
 * preview, dejando «Reintentar» sin click accesible.
 */
export function saveIndicatorLabel(
  state: DiskSaveState,
  dirty: boolean,
  savedAt: number | null,
): string {
  if (state === "saving") return "Guardando…";
  if (state === "saved" && dirty) return "Cambios pendientes";
  if (state === "saved") return savedAt ? `Guardado ${formatSaveTime(savedAt)}` : "Guardado";
  if (state === "site-outdated") return "Sitio anterior conservado";
  return "Error al guardar";
}

/**
 * Devuelve la base de disco que corresponde al proyecto actual después de una
 * recarga (App entrega el mismo objeto en `project` y `diskBaseProject` tras
 * «Recargar desde disco»). Si coinciden, el editor quedó alineado con disco y
 * el indicador debe volver a `saved` sin re-guardar contenido idéntico.
 */
export function resolveDiskRebase(
  project: StoreProjectV1,
  diskBaseProject: StoreProjectV1 | undefined,
): { base: StoreProjectV1; synced: boolean } {
  if (diskBaseProject && project === diskBaseProject) {
    return { base: diskBaseProject, synced: true };
  }
  return { base: project, synced: false };
}

export function ManagedPersistenceControls({
  project,
  diskVersion,
  diskBaseProject,
  validationError,
  onDirtyChange,
  onError,
  onConflict,
  onSaved,
  blocked = false,
}: {
  project: StoreProjectV1;
  diskVersion: number | null;
  diskBaseProject?: StoreProjectV1;
  validationError: string;
  onDirtyChange(dirty: boolean): void;
  onError(message: string): void;
  onConflict?(reason: LocalStorageError): void;
  onSaved?(receipt: LocalSaveReceipt): void;
  blocked?: boolean;
}) {
  const [state, setState] = useState<DiskSaveState>("saved");
  const [savedAt, setSavedAt] = useState<number | null>(null);
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

  // Una recarga desde disco (App cambia `project` y `diskBaseProject` juntos)
  // deja el editor alineado con disco: no debe quedar el indicador en «error»
  // ni exigir re-guardar contenido idéntico para volver a `saved`.
  useEffect(() => {
    const rebase = resolveDiskRebase(project, diskBaseProject);
    if (rebase.synced) {
      savedProjectRef.current = rebase.base;
      setState("saved");
    }
  }, [diskBaseProject, project]);

  useEffect(() => {
    if (project === lastProjectRef.current) return;
    lastProjectRef.current = project;
    draftQueue.schedule(project);
  }, [draftQueue, project]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const save = useCallback(async () => {
    if (blocked || saveInFlightRef.current) return;
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
      setSavedAt(Date.now());
      onSaved?.(result.receipt);
      setState(result.siteError ? "site-outdated" : "saved");
      if (result.siteError) onError(result.siteError);
    } catch (reason) {
      if (reason instanceof LocalStorageError && reason.code === "VERSION_CONFLICT") {
        setState("error");
        onConflict?.(reason);
      } else {
        setState("error");
        onError(
          reason instanceof Error ? reason.message : "No se pudo guardar la tienda en disco.",
        );
      }
    } finally {
      saveInFlightRef.current = false;
    }
  }, [blocked, draftQueue, onConflict, onError, onSaved, project]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (blocked) return;
      void saveRef.current();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
      draftQueue.dispose();
    };
  }, [blocked, draftQueue]);

  return (
    <div className="save-status">
      <button
        type="button"
        className="save-button"
        data-studio-save
        disabled={state === "saving" || blocked}
        aria-busy={state === "saving"}
        onClick={() => void save()}
      >
        <FloppyDisk aria-hidden size={16} />
        Guardar
      </button>
      <output className={`save-indicator save-indicator--${state}`} aria-live="polite">
        {state === "saving" ? (
          <span className="save-spinner" aria-hidden />
        ) : state === "saved" && !dirty ? (
          <CheckCircle className="save-check" aria-hidden size={16} />
        ) : (
          <FloppyDisk aria-hidden size={16} />
        )}
        {saveIndicatorLabel(state, dirty, savedAt)}
      </output>
      {validationError ? <InlineError>{validationError}</InlineError> : null}
      {state === "error" ? (
        <button type="button" className="save-retry" onClick={() => void save()}>
          Reintentar
        </button>
      ) : null}
    </div>
  );
}
