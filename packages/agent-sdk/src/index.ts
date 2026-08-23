import type {
  AgentResponse,
  AssetStageParams,
  PlanCommitParams,
  PlanCreateParams,
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
  listStores<T = unknown>(): Promise<T> {
    return this.transport.request("stores.list") as Promise<T>;
  }
  getStore<T = unknown>(params: StoreGetParams): Promise<T> {
    return this.transport.request("stores.get", params) as Promise<T>;
  }
  createPlan<T = unknown>(params: PlanCreateParams): Promise<T> {
    return this.transport.request("plans.create", params) as Promise<T>;
  }
  commitPlan<T = unknown>(params: PlanCommitParams): Promise<T> {
    return this.transport.request("plans.commit", params) as Promise<T>;
  }
  stageAsset<T = unknown>(params: AssetStageParams): Promise<T> {
    return this.transport.request("assets.stage", params) as Promise<T>;
  }
}

export function createResponseTransport(
  send: (method: string, params?: unknown) => Promise<AgentResponse>,
): AgentTransport {
  return { request: send };
}
