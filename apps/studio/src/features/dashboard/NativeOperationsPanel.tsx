import {
  ArrowCounterClockwise,
  ArrowUpRight,
  CheckCircle,
  GitDiff,
  Play,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { isBaseTemplate } from "@solara/project-schema/project-policy";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Button, InlineError } from "../../components/Ui";
import { type DesktopAgentBridge, getDesktopAgentBridge } from "../../lib/desktopBridge";
import type { StoredProject } from "../../lib/repository";

type NativeOperationsPanelProps = { projects: StoredProject[] };
type RolloutKind = "site-rebuild" | "project-migration";

type TemplateSnapshot = {
  version?: number;
  templateVersion?: number | null;
  updatePolicy?: string;
};

type TemplatePreview = TemplateSnapshot & {
  previewId: string;
  fromVersion: number;
  toVersion: number;
  safeChanges: Array<{ id: string; label?: string }>;
  conflicts: Array<{ id: string; label?: string; path?: string; reason?: string }>;
  requiresConfirmation: string;
};

type RolloutStore = {
  storeId: string;
  name: string;
  baseVersion: number;
  status: "ready" | "skipped" | "conflict" | "failed" | "applied";
  reason?: string;
  safeChanges?: string[];
  conflicts?: string[];
};

type RolloutPreview = {
  previewId: string;
  kind: RolloutKind;
  stores: RolloutStore[];
  expiresAt?: string;
};

type RolloutResult = {
  storeId: string;
  status: string;
  reason?: string;
  site?: { version?: number; previousSite?: unknown };
  result?: { version?: number };
};

type RolloutJob = {
  jobId?: string;
  status?: string;
  result?: { results?: RolloutResult[]; counts?: Record<string, number> };
  error?: { message?: string };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function nativeError(reason: unknown): string {
  const record = asRecord(reason);
  const message = record.message;
  return typeof message === "string" && message
    ? message
    : "La operación nativa no pudo completarse.";
}

function countStatuses(stores: RolloutStore[]): string {
  const ready = stores.filter((store) => store.status === "ready").length;
  const conflicts = stores.filter((store) => store.status === "conflict").length;
  const skipped = stores.filter((store) => store.status === "skipped").length;
  return `${ready} listas · ${conflicts} conflictos · ${skipped} omitidas`;
}

export function NativeOperationsPanel({ projects }: NativeOperationsPanelProps) {
  const [bridge] = useState<DesktopAgentBridge | undefined>(() => getDesktopAgentBridge());
  const [template, setTemplate] = useState<TemplateSnapshot>();
  const [templatePreview, setTemplatePreview] = useState<TemplatePreview>();
  const [rolloutKind, setRolloutKind] = useState<RolloutKind>("site-rebuild");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rolloutPreview, setRolloutPreview] = useState<RolloutPreview>();
  const [rolloutJob, setRolloutJob] = useState<RolloutJob>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const titleId = useId();

  const eligible = useMemo(
    () =>
      projects.filter((record) => record.status === "active" && !isBaseTemplate(record.project)),
    [projects],
  );

  useEffect(() => {
    setSelectedIds((current) => {
      const valid = new Set(eligible.map((record) => record.id));
      const next = current.filter((id) => valid.has(id));
      return next.length > 0 || current.length > 0 ? next : eligible.map((record) => record.id);
    });
  }, [eligible]);

  const call = useCallback(
    async <T,>(method: string, params: unknown): Promise<T> => {
      if (!bridge) throw new Error("Las operaciones globales requieren la aplicación portable.");
      return (await bridge.agentCall({ method, params })) as T;
    },
    [bridge],
  );

  useEffect(() => {
    if (!bridge) return;
    void call<TemplateSnapshot>("templates.get", { templateId: "catalog-modern" })
      .then(setTemplate)
      .catch((reason) => setError(nativeError(reason)));
  }, [bridge, call]);

  const run = useCallback(async (key: string, operation: () => Promise<void>) => {
    setBusy(key);
    setError("");
    try {
      await operation();
    } catch (reason) {
      setError(nativeError(reason));
    } finally {
      setBusy(undefined);
    }
  }, []);

  const previewTemplate = () =>
    void run("template-preview", async () => {
      const next = await call<TemplatePreview>("templates.previewUpgrade", {
        templateId: "catalog-modern",
        ...(template?.version === undefined ? {} : { baseVersion: template.version }),
      });
      setTemplatePreview(next);
    });

  const commitTemplate = () => {
    if (!templatePreview || templatePreview.requiresConfirmation !== "ACTUALIZAR_PLANTILLA") return;
    if (!window.confirm("Esto actualizará Predeterminado y conservará su mismo ID. ¿Continuar?"))
      return;
    void run("template-commit", async () => {
      await call("templates.commitUpgrade", {
        previewId: templatePreview.previewId,
        baseVersion: templatePreview.fromVersion,
        confirmation: "ACTUALIZAR_PLANTILLA",
        idempotencyKey: `studio-template-${templatePreview.previewId}`,
      });
      setTemplatePreview(undefined);
      setTemplate(await call<TemplateSnapshot>("templates.get", { templateId: "catalog-modern" }));
    });
  };

  const previewRollout = () =>
    void run("rollout-preview", async () => {
      const next = await call<RolloutPreview>("rollouts.preview", {
        kind: rolloutKind,
        target: {
          status: "active",
          excludeProtected: true,
          ...(selectedIds.length > 0 ? { storeIds: selectedIds } : {}),
        },
      });
      setRolloutPreview(next);
      setRolloutJob(undefined);
    });

  const commitRollout = () => {
    if (!rolloutPreview) return;
    if (!window.confirm("Se aplicará el rollout sólo a las tiendas listas. ¿Continuar?")) return;
    void run("rollout-commit", async () => {
      const job = await call<RolloutJob>("rollouts.commit", {
        previewId: rolloutPreview.previewId,
        idempotencyKey: `studio-rollout-${rolloutPreview.previewId}`,
        async: false,
      });
      setRolloutJob(job);
    });
  };

  const rollback = (result: RolloutResult) => {
    if (!rolloutPreview || result.status !== "applied") return;
    const expectedVersion = result.site?.version ?? result.result?.version;
    if (expectedVersion === undefined) return;
    if (!window.confirm(`Restaurar el backup de ${result.storeId}?`)) return;
    void run(`rollback-${result.storeId}`, async () => {
      await call("rollouts.rollback", {
        rolloutId: rolloutPreview.previewId,
        storeId: result.storeId,
        expectedVersion,
      });
      const refreshed = await call<{ job?: RolloutJob }>("rollouts.get", {
        rolloutId: rolloutPreview.previewId,
      });
      setRolloutJob(refreshed.job);
    });
  };

  if (!bridge) return null;

  const results = rolloutJob?.result?.results ?? [];
  return (
    <section className="native-operations" aria-labelledby={titleId}>
      <header className="native-operations__header">
        <div>
          <span className="dashboard-cosmic-kicker">Operaciones protegidas</span>
          <h2 id={titleId}>Plantilla, reconstrucciones y migraciones</h2>
          <p>
            Usá previews y backups por tienda. Predeterminado siempre queda fuera de los rollouts.
          </p>
        </div>
        <ShieldCheck aria-hidden size={24} />
      </header>

      {error ? <InlineError>{error}</InlineError> : null}

      <div className="native-operations__grid">
        <article className="native-operations__card">
          <div className="native-operations__card-heading">
            <div>
              <strong>Plantilla protegida</strong>
              <span>Predeterminado · v{template?.version ?? "—"}</span>
            </div>
            <ShieldCheck aria-hidden size={18} />
          </div>
          <p>Versión de plantilla: {template?.templateVersion ?? "—"} · política pinned</p>
          <Button
            variant="secondary"
            icon={GitDiff}
            loading={busy === "template-preview"}
            onClick={previewTemplate}
          >
            Previsualizar upgrade
          </Button>
          {templatePreview ? (
            <div className="native-operations__preview">
              <strong>
                v{templatePreview.fromVersion} → v{templatePreview.toVersion}
              </strong>
              <span>{templatePreview.safeChanges.length} cambios seguros</span>
              {templatePreview.conflicts.length > 0 ? (
                <span className="native-operations__warning">
                  <WarningCircle aria-hidden size={15} /> {templatePreview.conflicts.length}{" "}
                  conflictos
                </span>
              ) : null}
              <Button
                variant="primary"
                icon={CheckCircle}
                disabled={templatePreview.conflicts.length > 0}
                loading={busy === "template-commit"}
                onClick={commitTemplate}
              >
                Confirmar upgrade
              </Button>
            </div>
          ) : null}
        </article>

        <article className="native-operations__card">
          <div className="native-operations__card-heading">
            <div>
              <strong>Rollout global</strong>
              <span>{eligible.length} tiendas activas editables</span>
            </div>
            <ArrowUpRight aria-hidden size={18} />
          </div>
          <div className="native-operations__controls">
            <label>
              Tipo
              <select
                value={rolloutKind}
                onChange={(event) => setRolloutKind(event.target.value as RolloutKind)}
              >
                <option value="site-rebuild">Reconstruir sitios (renderer)</option>
                <option value="project-migration">Migrar proyectos (datos)</option>
              </select>
            </label>
            <div className="native-operations__targets">
              <span>Tiendas objetivo</span>
              {eligible.length === 0 ? <small>No hay tiendas activas editables.</small> : null}
              {eligible.map((record) => (
                <label key={record.id}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(record.id)}
                    onChange={() =>
                      setSelectedIds((current) =>
                        current.includes(record.id)
                          ? current.filter((id) => id !== record.id)
                          : [...current, record.id],
                      )
                    }
                  />
                  {record.name}
                </label>
              ))}
            </div>
          </div>
          <div className="native-operations__actions">
            <Button
              variant="secondary"
              icon={GitDiff}
              loading={busy === "rollout-preview"}
              disabled={selectedIds.length === 0}
              onClick={previewRollout}
            >
              Previsualizar rollout
            </Button>
            {rolloutPreview ? (
              <Button
                variant="primary"
                icon={Play}
                loading={busy === "rollout-commit"}
                onClick={commitRollout}
              >
                Ejecutar rollout
              </Button>
            ) : null}
          </div>
          {rolloutPreview ? (
            <div className="native-operations__preview">
              <strong>{countStatuses(rolloutPreview.stores)}</strong>
              <span>Preview {rolloutPreview.previewId}</span>
            </div>
          ) : null}
          {results.length > 0 ? (
            <ul className="native-operations__results">
              {results.map((result) => (
                <li key={result.storeId}>
                  <span>
                    {result.status === "applied" ? (
                      <CheckCircle aria-hidden />
                    ) : (
                      <WarningCircle aria-hidden />
                    )}
                    {result.storeId} · {result.status}
                  </span>
                  {result.status === "applied" ? (
                    <Button
                      variant="quiet"
                      icon={ArrowCounterClockwise}
                      loading={busy === `rollback-${result.storeId}`}
                      onClick={() => rollback(result)}
                    >
                      Rollback
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      </div>
    </section>
  );
}
