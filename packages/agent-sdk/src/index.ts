import type {
  AgentResponse,
  AssetStageParams,
  AssetUploadBeginParams,
  AssetUploadChunkParams,
  AssetUploadFinishParams,
  AuditListParams,
  JobGetParams,
  PlanCommitParams,
  PlanCreateParams,
  PlanDiscardParams,
  PlanGetParams,
  PlanHeartbeatParams,
  StoreGetParams,
} from "@solara/agent-contracts";

export interface AgentTransport {
  request(method: string, params?: unknown): Promise<unknown>;
}

export class AgentClient {
  constructor(private readonly transport: AgentTransport) {}

  health<T = unknown>(): Promise<T> {
    return this.transport.request("health") as Promise<T>;
  }
  describeProtocol<T = unknown>(): Promise<T> {
    return this.transport.request("protocol.describe", {}) as Promise<T>;
  }
  listStores<T = unknown>(): Promise<T> {
    return this.transport.request("stores.list") as Promise<T>;
  }
  getStore<T = unknown>(params: StoreGetParams): Promise<T> {
    return this.transport.request("stores.get", params) as Promise<T>;
  }
  createPlan<T = unknown>(params: PlanCreateParams): Promise<T> {
    return this.transport.request("plans.create", params) as Promise<T>;
  }
  getPlan<T = unknown>(params: PlanGetParams): Promise<T> {
    return this.transport.request("plans.get", params) as Promise<T>;
  }
  commitPlan<T = unknown>(params: PlanCommitParams): Promise<T> {
    return this.transport.request("plans.commit", params) as Promise<T>;
  }
  discardPlan<T = unknown>(params: PlanDiscardParams): Promise<T> {
    return this.transport.request("plans.discard", params) as Promise<T>;
  }
  heartbeatPlan<T = unknown>(params: PlanHeartbeatParams): Promise<T> {
    return this.transport.request("plans.heartbeat", params) as Promise<T>;
  }
  getJob<T = unknown>(params: JobGetParams): Promise<T> {
    return this.transport.request("jobs.get", params) as Promise<T>;
  }
  listAudit<T = unknown>(params: AuditListParams = { limit: 50 }): Promise<T> {
    return this.transport.request("audit.list", params) as Promise<T>;
  }
  stageAsset<T = unknown>(params: AssetStageParams): Promise<T> {
    return this.transport.request("assets.stage", params) as Promise<T>;
  }
  beginAssetUpload<T = unknown>(params: AssetUploadBeginParams): Promise<T> {
    return this.transport.request("assets.upload.begin", params) as Promise<T>;
  }
  uploadAssetChunk<T = unknown>(params: AssetUploadChunkParams): Promise<T> {
    return this.transport.request("assets.upload.chunk", params) as Promise<T>;
  }
  finishAssetUpload<T = unknown>(params: AssetUploadFinishParams): Promise<T> {
    return this.transport.request("assets.upload.finish", params) as Promise<T>;
  }

  async createStore<TPlan = unknown, TCommit = unknown>(
    params: PlanCreateParams,
    idempotencyKey?: string,
  ): Promise<{ plan: TPlan; commit: TCommit }> {
    const plan = await this.createPlan<TPlan>({
      ...params,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
    const planId = (plan as { planId?: string }).planId;
    if (!planId) throw new Error("El transporte no devolvió planId.");
    const commit = await this.commitPlan<TCommit>({
      planId,
      async: false,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
    return { plan, commit };
  }

  async waitForJob<T = unknown>(
    jobId: string,
    options: { intervalMs?: number; timeoutMs?: number } = {},
  ): Promise<T> {
    const intervalMs = options.intervalMs ?? 250;
    const timeoutMs = options.timeoutMs ?? 120_000;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const job = await this.getJob<{ status: string; result?: T; error?: { message: string } }>({
        jobId,
      });
      if (job.status === "succeeded") return job.result as T;
      if (job.status === "failed") throw new Error(job.error?.message ?? "El trabajo falló.");
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error("El trabajo superó el timeout de espera.");
  }
}

export function createResponseTransport(
  send: (method: string, params?: unknown) => Promise<AgentResponse>,
): AgentTransport {
  return { request: send };
}
