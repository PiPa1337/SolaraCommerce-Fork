export const CODEX_NATIVE_PROVIDER = "codex" as const;
export const CODEX_NATIVE_BACKEND = "native" as const;

export type CollaborationErrorCode =
  | "NATIVE_BACKEND_REQUIRED"
  | "PROVISIONING_PROTOCOL_INVALID"
  | "WORKTREE_PROVISIONING_TIMEOUT"
  | "WORKTREE_PROVISIONING_FAILED";

export type ProvisioningState = "ready" | "pending" | "failed";

export interface TransportCandidate {
  provider: string;
  backend: string;
  model: string;
  payloadEncoding: "plaintext" | "encrypted";
  checkoutPath: string;
  task: string;
}

export interface NativeCodexTaskRequest {
  model: string;
  payloadEncoding: "plaintext" | "encrypted";
  checkoutPath: string;
  task: string;
}

export interface TransportPreflight {
  readonly provider: typeof CODEX_NATIVE_PROVIDER;
  readonly backend: typeof CODEX_NATIVE_BACKEND;
  model: string;
  payloadEncoding: NativeCodexTaskRequest["payloadEncoding"];
  checkoutPath: string;
}

export interface LaunchResponse {
  threadId?: string;
  clientThreadId?: string;
  checkoutPath?: string;
  model?: string;
  result?: unknown;
}

export interface ProvisioningStatus {
  state: ProvisioningState;
  threadId?: string;
  message?: string;
  worktreePath?: string;
}

export interface CodexCollaborationBackend {
  launch(
    request: NativeCodexTaskRequest & { preflight: TransportPreflight },
  ): Promise<LaunchResponse>;
  getProvisioningStatus(clientThreadId: string): Promise<ProvisioningStatus>;
  sendFollowUp(threadId: string, task: string): Promise<unknown>;
}

export interface ProvisioningOptions {
  timeoutMs?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
}

export interface ProvisioningReport {
  state: "ready";
  threadId: string;
  clientThreadId?: string;
  attempts: number;
  elapsedMs: number;
  worktreePath?: string;
}

export interface SubagentRunReport {
  status: "succeeded" | "failed";
  transport: TransportPreflight;
  checkoutPath: string;
  launchAttempted: boolean;
  provisioning: ProvisioningReport | { state: "not-started" | "failed"; detail?: unknown };
  result?: unknown;
  error?: CollaborationErrorRecord;
}

export interface CollaborationErrorRecord {
  code: CollaborationErrorCode | "AGENT_ERROR";
  message: string;
  actionable: string;
  retryable: boolean;
  details?: unknown;
}

export class CollaborationError extends Error {
  readonly code: CollaborationErrorCode;
  readonly actionable: string;
  readonly retryable: boolean;
  readonly details: unknown;

  constructor(
    code: CollaborationErrorCode,
    message: string,
    actionable: string,
    options: { retryable?: boolean; details?: unknown } = {},
  ) {
    super(message);
    this.name = "CollaborationError";
    this.code = code;
    this.actionable = actionable;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

function isNativeCodexTransport(request: TransportCandidate): boolean {
  return request.provider === CODEX_NATIVE_PROVIDER && request.backend === CODEX_NATIVE_BACKEND;
}

export function preflightTransport(request: TransportCandidate): TransportPreflight {
  if (!isNativeCodexTransport(request)) {
    throw new CollaborationError(
      "NATIVE_BACKEND_REQUIRED",
      `El backend ${request.provider}/${request.backend} no es válido para sub-agents de Codex.`,
      `Usá exclusivamente ${CODEX_NATIVE_PROVIDER}/${CODEX_NATIVE_BACKEND}; no existe fallback externo y la tarea no fue lanzada.`,
      {
        details: {
          provider: request.provider,
          backend: request.backend,
          payloadEncoding: request.payloadEncoding,
          launchBlocked: true,
        },
      },
    );
  }
  return {
    provider: CODEX_NATIVE_PROVIDER,
    backend: CODEX_NATIVE_BACKEND,
    model: request.model,
    payloadEncoding: request.payloadEncoding,
    checkoutPath: request.checkoutPath,
  };
}

function asErrorRecord(error: unknown): CollaborationErrorRecord {
  if (error instanceof CollaborationError) {
    return {
      code: error.code,
      message: error.message,
      actionable: error.actionable,
      retryable: error.retryable,
      ...(error.details === undefined ? {} : { details: error.details }),
    };
  }
  return {
    code: "AGENT_ERROR",
    message: error instanceof Error ? error.message : String(error),
    actionable: "Revisá el diagnóstico del backend nativo y volvé a ejecutar el smoke.",
    retryable: false,
  };
}

function elapsed(now: () => number, startedAt: number): number {
  return Math.max(0, now() - startedAt);
}

export async function waitForExecutableThread(
  backend: Pick<CodexCollaborationBackend, "getProvisioningStatus">,
  clientThreadId: string,
  options: ProvisioningOptions = {},
): Promise<ProvisioningReport> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const initialDelayMs = options.initialDelayMs ?? 100;
  const maxDelayMs = options.maxDelayMs ?? 2_000;
  const sleep =
    options.sleep ??
    ((delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  const now = () => Date.now();
  const startedAt = now();
  let delayMs = initialDelayMs;
  let attempts = 0;
  let lastError: unknown;

  while (elapsed(now, startedAt) <= timeoutMs) {
    attempts += 1;
    try {
      const status = await backend.getProvisioningStatus(clientThreadId);
      if (status.state === "ready") {
        if (!status.threadId) {
          throw new CollaborationError(
            "PROVISIONING_PROTOCOL_INVALID",
            "El provisioning informó estado listo pero no devolvió threadId.",
            "Corregí el backend para devolver threadId antes de enviar follow-ups.",
            { details: { clientThreadId, status } },
          );
        }
        return {
          state: "ready",
          threadId: status.threadId,
          clientThreadId,
          attempts,
          elapsedMs: elapsed(now, startedAt),
          ...(status.worktreePath ? { worktreePath: status.worktreePath } : {}),
        };
      }
      if (status.state === "failed") {
        throw new CollaborationError(
          "WORKTREE_PROVISIONING_FAILED",
          status.message ?? `El worktree quedó en estado fallido para ${clientThreadId}.`,
          "Revisá el diagnóstico de provisioning y reintentá con un worktree válido; no se envió ningún follow-up.",
          { details: { clientThreadId, status, attempts } },
        );
      }
    } catch (error) {
      if (error instanceof CollaborationError) throw error;
      lastError = error;
    }
    const remainingMs = timeoutMs - elapsed(now, startedAt);
    if (remainingMs <= 0) break;
    await sleep(Math.min(delayMs, remainingMs));
    delayMs = Math.min(maxDelayMs, Math.max(initialDelayMs, delayMs * 2));
  }

  throw new CollaborationError(
    "WORKTREE_PROVISIONING_TIMEOUT",
    `El worktree no estuvo listo dentro de ${timeoutMs} ms para ${clientThreadId}.`,
    "Esperá a que termine el provisioning o revisá el host; no se envió ningún follow-up.",
    {
      retryable: true,
      details: {
        clientThreadId,
        attempts,
        timeoutMs,
        lastError: lastError instanceof Error ? lastError.message : lastError,
      },
    },
  );
}

export async function runSubagentTask(
  backend: CodexCollaborationBackend,
  request: TransportCandidate,
  options: ProvisioningOptions & { followUps?: string[] } = {},
): Promise<SubagentRunReport> {
  const transport = preflightTransport(request);
  let launchAttempted = false;
  try {
    launchAttempted = true;
    const launched = await backend.launch({
      model: request.model,
      payloadEncoding: request.payloadEncoding,
      checkoutPath: request.checkoutPath,
      task: request.task,
      preflight: transport,
    });
    let provisioning: ProvisioningReport;
    if (launched.threadId) {
      provisioning = {
        state: "ready",
        threadId: launched.threadId,
        attempts: 1,
        elapsedMs: 0,
        ...(launched.clientThreadId ? { clientThreadId: launched.clientThreadId } : {}),
        ...(launched.checkoutPath ? { worktreePath: launched.checkoutPath } : {}),
      };
    } else if (launched.clientThreadId) {
      provisioning = await waitForExecutableThread(backend, launched.clientThreadId, options);
    } else {
      throw new CollaborationError(
        "PROVISIONING_PROTOCOL_INVALID",
        "El lanzamiento no devolvió threadId ni clientThreadId.",
        "Corregí la respuesta del backend antes de reintentar; no es seguro enviar follow-ups.",
      );
    }
    let result: unknown = launched.result;
    for (const followUp of options.followUps ?? []) {
      result = await backend.sendFollowUp(provisioning.threadId, followUp);
    }
    return {
      status: "succeeded",
      transport,
      checkoutPath: request.checkoutPath,
      launchAttempted,
      provisioning,
      ...(result === undefined ? {} : { result }),
    };
  } catch (error) {
    return {
      status: "failed",
      transport,
      checkoutPath: request.checkoutPath,
      launchAttempted,
      provisioning: launchAttempted
        ? { state: "failed", detail: asErrorRecord(error) }
        : { state: "not-started" },
      error: asErrorRecord(error),
    };
  }
}

export const READ_ONLY_SITE_OPTIMIZER_SMOKE_TASK =
  "Ejecutá únicamente el equivalente read-only de scripts/site-optimizer-check.test.ts sobre fixtures; no edites archivos, no escribas reportes y devolvé evidencia de ejecución.";

export interface SiteOptimizerSmokeResult {
  executed: boolean;
  readOnly: boolean;
  check: "site-optimizer";
  summary: {
    modernActiveProducts: number;
    scaleCategoryRoutes: number;
    cleanActiveProducts: number;
  };
}

export function assertSiteOptimizerSmokeResult(value: unknown): SiteOptimizerSmokeResult {
  if (!value || typeof value !== "object") throw new Error("El sub-agent no devolvió resultado.");
  const result = value as Partial<SiteOptimizerSmokeResult>;
  if (result.executed !== true || result.readOnly !== true || result.check !== "site-optimizer") {
    throw new Error("La delegación no demostró ejecución read-only del smoke de site-optimizer.");
  }
  if (!result.summary || typeof result.summary !== "object") {
    throw new Error("El smoke no devolvió el resumen esperado.");
  }
  return value as SiteOptimizerSmokeResult;
}
