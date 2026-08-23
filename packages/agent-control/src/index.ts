import { createHash, randomBytes } from "node:crypto";
import { appendFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type AgentOperation,
  AgentOperationSchema,
  type AssetStageParams,
  AssetStageParamsSchema,
  AssetUploadBeginParamsSchema,
  AssetUploadChunkParamsSchema,
  AssetUploadFinishParamsSchema,
  AuditListParamsSchema,
  JobGetParamsSchema,
  PlanCommitParamsSchema,
  PlanCreateParamsSchema,
  PlanDiscardParamsSchema,
  PlanGetParamsSchema,
  PlanHeartbeatParamsSchema,
  ProtocolDescribeParamsSchema,
  StoreGetParamsSchema,
} from "@solara/agent-contracts";
import { reduceProject } from "@solara/core";
import { createProjectArchive, exportProject, readProjectArchive } from "@solara/exporter";
import {
  CategorySchema,
  CollectionSchema,
  type ImageAsset,
  ImageAssetSchema,
  type Product,
  ProductSchema,
  personalizeWhatsAppGreeting,
  type StoreProjectV1,
  StoreProjectV2Schema,
} from "@solara/project-schema";
import { buildCatalogModernProject } from "@solara/project-schema/catalog-modern-template";
// El lock es compartido por el agente y el storage de Studio para coordinar
// procesos separados sin habilitar escritura arbitraria.
// @ts-expect-error módulo .mjs compartido sin d.ts
import { createAgentLockStore } from "../../exporter/scripts/agent-lock.mjs";
// El layout compartido es un módulo Node ESM sin declaraciones; Vite lo
// incorpora al bundle y el contrato runtime se comprueba en los tests portables.
// @ts-expect-error módulo .mjs compartido sin d.ts
import { assertNoReparsePoints } from "../../exporter/scripts/portable-layout.mjs";

interface AgentLocalProjectStorage {
  applicationRoot: string;
  projectsRoot: string;
  ensureRoots(): Promise<void>;
  status(): Promise<{ writable: boolean; [key: string]: unknown }>;
  list(): Promise<unknown>;
  beginSave(meta: {
    projectId: string;
    name: string;
    slug: string;
    projectUpdatedAt: string;
    expectedVersion: number | null;
    actor?: { kind: "agent"; id: string };
  }): Promise<{ transactionId: string; version: number; folder: string }>;
  upload(
    transactionId: string,
    kind: "project" | "site",
    request: AsyncIterable<Uint8Array> & { headers?: Record<string, string> },
  ): Promise<{ bytes: number; sha256: string }>;
  commit(transactionId: string, options?: { protectedSiteKeys?: string[] }): Promise<unknown>;
  abort(transactionId: string): Promise<void>;
  readCurrent(projectId: string): Promise<{ manifest: unknown; bytes: Uint8Array } | undefined>;
}

type AgentError = Error & { code?: string; details?: unknown };

interface PlanDraft {
  planId: string;
  storeId: string;
  baseVersion: number | null;
  project: StoreProjectV1;
  operations: AgentOperation[];
  createdNewStore: boolean;
  createdAt: string;
  expiresAt: string;
  diff: PlanDiff;
  warnings: string[];
  includeDiff: boolean;
  idempotencyKey?: string;
}

interface StagedAsset {
  asset: ImageAsset;
  bytesPath?: string;
}

interface PlanDiff {
  store: { mode: "create" | "update"; storeId: string; name: string };
  identity: string[];
  seo: string[];
  products: { created: string[]; updated: string[]; removed: string[] };
  categories: { created: string[]; updated: string[]; removed: string[] };
  collections: { created: string[]; updated: string[]; removed: string[] };
  assets: { created: string[]; updated: string[]; removed: string[] };
  operationCount: number;
}

interface AgentJob {
  jobId: string;
  kind: "plans.commit";
  planId: string;
  requestId?: string | number;
  status: "queued" | "running" | "succeeded" | "failed";
  createdAt: string;
  updatedAt: string;
  result?: unknown;
  error?: { code: string; message: string; details?: unknown };
}

interface ControllerOptions {
  storage: AgentLocalProjectStorage;
  applicationRoot: string;
  now?: () => Date;
  protectedStoreIds?: Iterable<string>;
  scopes?: Iterable<string>;
  actorId?: string;
}

const MAX_INLINE_ASSET_BYTES = 1_500_000;
const MAX_INBOX_ASSET_BYTES = 20_000_000;
const MAX_UPLOAD_CHUNK_BYTES = 1_000_000;
const PLAN_TTL_MS = 30 * 60 * 1000;

function fail(code: string, message: string, details?: unknown): never {
  const error = new Error(message) as AgentError;
  error.code = code;
  if (details !== undefined) error.details = details;
  throw error;
}

function safeSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return slug || "nueva-tienda";
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`.slice(0, 96);
}

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function siteMap(files: ReadonlyMap<string, string | Uint8Array>): string {
  return JSON.stringify(
    [...files.entries()].map(([path, value]) =>
      typeof value === "string"
        ? { path, encoding: "utf8", data: value }
        : { path, encoding: "base64", data: bytesToBase64(value) },
    ),
  );
}

function bytesStream(
  bytes: Uint8Array,
): AsyncIterable<Uint8Array> & { headers: Record<string, string> } {
  return {
    headers: { "x-solara-sha256": digest(bytes) },
    async *[Symbol.asyncIterator]() {
      yield bytes;
    },
  };
}

function projectIsProtected(project: StoreProjectV1, explicit: Set<string>): boolean {
  return explicit.has(project.id) || project.origin?.seed !== "clean";
}

function summary(project: StoreProjectV1, version: number | null, protectedStore: boolean) {
  return {
    storeId: project.id,
    name: project.name,
    slug: project.slug,
    status: project.status,
    schemaVersion: project.schemaVersion,
    originSeed: project.origin?.seed ?? "unknown",
    protected: protectedStore,
    version,
    counts: {
      products: project.products.length,
      categories: project.categories.length,
      collections: project.collections.length,
      assets: project.assets.length,
    },
    updatedAt: project.updatedAt,
  };
}

function stable(value: unknown): string {
  return JSON.stringify(value);
}

function keyedChanges<T extends { id: string }>(before: T[], after: T[]) {
  const oldById = new Map(before.map((item) => [item.id, item]));
  const newById = new Map(after.map((item) => [item.id, item]));
  return {
    created: after.filter((item) => !oldById.has(item.id)).map((item) => item.id),
    updated: after
      .filter((item) => oldById.has(item.id) && stable(oldById.get(item.id)) !== stable(item))
      .map((item) => item.id),
    removed: before.filter((item) => !newById.has(item.id)).map((item) => item.id),
  };
}

function planDiff(
  before: StoreProjectV1 | undefined,
  after: StoreProjectV1,
  operations: AgentOperation[],
  createdNewStore: boolean,
): PlanDiff {
  return {
    store: {
      mode: createdNewStore ? "create" : "update",
      storeId: after.id,
      name: after.name,
    },
    identity: before && stable(before.identity) !== stable(after.identity) ? ["identity"] : [],
    seo: before && stable(before.seo) !== stable(after.seo) ? ["seo"] : [],
    products: keyedChanges(before?.products ?? [], after.products),
    categories: keyedChanges(before?.categories ?? [], after.categories),
    collections: keyedChanges(before?.collections ?? [], after.collections),
    assets: keyedChanges(before?.assets ?? [], after.assets),
    operationCount: operations.length,
  };
}

function planWarnings(project: StoreProjectV1, diff: PlanDiff): string[] {
  const warnings: string[] = [];
  if (project.products.length === 0) warnings.push("La tienda todavía no tiene productos.");
  if (
    diff.assets.created.length === 0 &&
    project.products.some((product) => product.imageIds.length === 0)
  ) {
    warnings.push("Hay productos sin imagen asociada.");
  }
  if (!project.identity.phone) warnings.push("La tienda todavía no tiene teléfono de WhatsApp.");
  return warnings;
}

function strictBase64(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
    fail("ASSET_BASE64_INVALID", "El asset no contiene base64 válido.");
  const bytes = new Uint8Array(Buffer.from(value, "base64"));
  if (Buffer.from(bytes).toString("base64") !== value) {
    fail("ASSET_BASE64_INVALID", "El asset no contiene base64 válido.");
  }
  return bytes;
}

async function writeAtomic(pathname: string, value: string | Uint8Array): Promise<void> {
  const temporary = `${pathname}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, value);
    await rename(temporary, pathname);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function imageDimensions(mimeType: AssetStageParams["mimeType"], bytes: Uint8Array) {
  const byte = (index: number) => bytes[index] ?? 0;
  if (mimeType === "image/png" && bytes.length >= 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) {
      return { width: view.getUint32(16), height: view.getUint32(20) };
    }
  }
  if (
    mimeType === "image/gif" &&
    bytes.length >= 10 &&
    String.fromCharCode(...bytes.subarray(0, 6)) === "GIF89a"
  ) {
    return { width: byte(6) | (byte(7) << 8), height: byte(8) | (byte(9) << 8) };
  }
  if (
    mimeType === "image/webp" &&
    bytes.length >= 30 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    const kind = String.fromCharCode(...bytes.subarray(12, 16));
    if (kind === "VP8X") {
      return {
        width: 1 + byte(24) + (byte(25) << 8) + (byte(26) << 16),
        height: 1 + byte(27) + (byte(28) << 8) + (byte(29) << 16),
      };
    }
  }
  if (mimeType === "image/jpeg" && bytes.length >= 4 && byte(0) === 0xff && byte(1) === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (byte(offset) !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = byte(offset + 1);
      const length = (byte(offset + 2) << 8) | byte(offset + 3);
      if (length < 2 || offset + length + 2 > bytes.length) break;
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
          marker,
        )
      ) {
        return {
          height: (byte(offset + 5) << 8) | byte(offset + 6),
          width: (byte(offset + 7) << 8) | byte(offset + 8),
        };
      }
      offset += length + 2;
    }
  }
  fail("ASSET_DIMENSIONS_INVALID", "No se pudieron leer las dimensiones reales de la imagen.");
}

function validateImageSignature(mimeType: AssetStageParams["mimeType"], bytes: Uint8Array): void {
  const starts = (values: number[]) => values.every((value, index) => bytes[index] === value);
  const valid =
    (mimeType === "image/png" && starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (mimeType === "image/jpeg" && starts([0xff, 0xd8, 0xff])) ||
    (mimeType === "image/gif" &&
      (starts([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        starts([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))) ||
    (mimeType === "image/webp" &&
      starts([0x52, 0x49, 0x46, 0x46]) &&
      String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP");
  if (!valid) fail("ASSET_SIGNATURE_INVALID", "El contenido no coincide con el MIME declarado.");
}

function createCleanProject(
  operation: Extract<AgentOperation, { type: "store.create" }>,
  storeId: string,
  now: Date,
): StoreProjectV1 {
  const slug = operation.slug ?? safeSlug(operation.name);
  const brandName = operation.brandName ?? operation.name;
  const base = buildCatalogModernProject({
    seed: "clean",
    id: storeId,
    name: operation.name,
    slug,
    baseUrl: operation.baseUrl ?? `https://${slug}.example`,
    brandName,
  });
  const timestamp = now.toISOString();
  return StoreProjectV2Schema.parse({
    ...base,
    createdAt: timestamp,
    updatedAt: timestamp,
    identity: {
      ...base.identity,
      legalName: brandName,
      brandName,
      ...(operation.email === undefined ? {} : { email: operation.email }),
      ...(operation.phone === undefined ? {} : { phone: operation.phone }),
    },
    whatsapp: {
      ...base.whatsapp,
      ...(operation.phone === undefined ? {} : { phone: operation.phone }),
      greeting: `Hola ${brandName}, quiero hacer este pedido:`,
    },
    seo: { ...base.seo, title: brandName },
  });
}

export class AgentController {
  private readonly plans = new Map<string, PlanDraft>();
  private readonly stagedAssets = new Map<string, StagedAsset>();
  private readonly jobs = new Map<string, AgentJob>();
  private readonly protectedStoreIds: Set<string>;
  private readonly scopes: Set<string>;
  private readonly now: () => Date;
  private readonly inboxRoot: string;
  private readonly agentRoot: string;
  private readonly plansRoot: string;
  private readonly committedRoot: string;
  private readonly assetsRoot: string;
  private readonly uploadsRoot: string;
  private readonly jobsRoot: string;
  private readonly auditPath: string;
  private readonly actorId: string;
  private readonly agentLocks;
  private initialized?: Promise<void>;
  private requestId: string | number | undefined;

  constructor(private readonly options: ControllerOptions) {
    this.protectedStoreIds = new Set(options.protectedStoreIds ?? []);
    this.scopes = new Set(
      options.scopes ?? ["read", "plans:write", "commit", "assets:write", "audit:read"],
    );
    this.now = options.now ?? (() => new Date());
    this.inboxRoot = join(options.applicationRoot, "agent-inbox");
    this.agentRoot = join(options.applicationRoot, ".solara-runtime", "agent");
    this.plansRoot = join(this.agentRoot, "plans");
    this.committedRoot = join(this.agentRoot, "committed");
    this.assetsRoot = join(this.agentRoot, "assets");
    this.uploadsRoot = join(this.agentRoot, "uploads");
    this.jobsRoot = join(this.agentRoot, "jobs");
    this.auditPath = join(this.agentRoot, "audit.jsonl");
    this.actorId = options.actorId ?? makeId("agent-session");
    this.agentLocks = createAgentLockStore({
      applicationRoot: options.applicationRoot,
      now: this.now,
    });
  }

  async ready(): Promise<void> {
    if (!this.initialized) this.initialized = this.initialize();
    await this.initialized;
  }

  setRequestContext(requestId: string | number | undefined): void {
    this.requestId = requestId;
  }

  private async initialize(): Promise<void> {
    await this.options.storage.ensureRoots();
    await mkdir(this.agentRoot, { recursive: true });
    await mkdir(this.plansRoot, { recursive: true });
    await mkdir(this.committedRoot, { recursive: true });
    await mkdir(this.assetsRoot, { recursive: true });
    await mkdir(this.uploadsRoot, { recursive: true });
    await mkdir(this.jobsRoot, { recursive: true });
    await assertNoReparsePoints(this.options.applicationRoot, this.agentRoot);
    await this.loadPlans();
    await this.loadJobs();
  }

  private requireScope(scope: string): void {
    if (!this.scopes.has(scope))
      fail("PERMISSION_DENIED", `El proceso del agente no tiene el scope ${scope}.`, { scope });
  }

  private async audit(
    event: string,
    details: Record<string, unknown> = {},
    requestId = this.requestId,
  ): Promise<void> {
    try {
      await appendFile(
        this.auditPath,
        `${JSON.stringify({
          at: this.now().toISOString(),
          actorId: this.actorId,
          ...(requestId === undefined ? {} : { requestId }),
          event,
          ...details,
        })}\n`,
        "utf8",
      );
    } catch (error) {
      process.stderr.write(
        `Solara agent: no se pudo escribir auditoría: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  }

  private planPath(planId: string): string {
    return join(this.plansRoot, `${planId}.json`);
  }

  private committedPath(idempotencyKey: string): string {
    return join(this.committedRoot, `${digest(new TextEncoder().encode(idempotencyKey))}.json`);
  }

  private jobPath(jobId: string): string {
    return join(this.jobsRoot, `${jobId}.json`);
  }

  private async persistPlan(plan: PlanDraft): Promise<void> {
    await writeAtomic(this.planPath(plan.planId), `${JSON.stringify(plan, null, 2)}\n`);
  }

  private async deletePlan(plan: PlanDraft): Promise<void> {
    this.plans.delete(plan.planId);
    await rm(this.planPath(plan.planId), { force: true });
    await this.agentLocks.release(plan.storeId, plan.planId);
  }

  private async loadPlans(): Promise<void> {
    const entries = await readdir(this.plansRoot, { withFileTypes: true });
    for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(".json"))) {
      try {
        const plan = JSON.parse(
          await readFile(join(this.plansRoot, entry.name), "utf8"),
        ) as PlanDraft;
        if (!plan.planId || Date.parse(plan.expiresAt) <= this.now().getTime()) {
          await rm(join(this.plansRoot, entry.name), { force: true });
          continue;
        }
        this.plans.set(plan.planId, plan);
        await this.agentLocks.claim(plan.storeId, plan.planId, {
          planId: plan.planId,
          storeId: plan.storeId,
        });
      } catch {
        // Un plan corrupto queda disponible en recovery del runtime, no se ejecuta.
      }
    }
  }

  private async persistJob(job: AgentJob): Promise<void> {
    this.jobs.set(job.jobId, job);
    await writeAtomic(this.jobPath(job.jobId), `${JSON.stringify(job, null, 2)}\n`);
  }

  private async loadJobs(): Promise<void> {
    const entries = await readdir(this.jobsRoot, { withFileTypes: true });
    for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(".json"))) {
      try {
        const job = JSON.parse(await readFile(join(this.jobsRoot, entry.name), "utf8")) as AgentJob;
        if (job.status === "queued" || job.status === "running") {
          job.status = "failed";
          job.error = {
            code: "AGENT_RESTARTED",
            message: "El agente se reinició antes de completar este trabajo.",
          };
          job.updatedAt = this.now().toISOString();
          await writeAtomic(join(this.jobsRoot, entry.name), `${JSON.stringify(job, null, 2)}\n`);
        }
        this.jobs.set(job.jobId, job);
      } catch {
        // Un trabajo corrupto no debe impedir iniciar el host.
      }
    }
  }

  private planResponse(plan: PlanDraft, includeProject = false, includeDiff = true) {
    return {
      planId: plan.planId,
      ...summary(plan.project, plan.baseVersion, false),
      baseVersion: plan.baseVersion,
      nextVersion: (plan.baseVersion ?? 0) + 1,
      operationCount: plan.operations.length,
      createdNewStore: plan.createdNewStore,
      createdAt: plan.createdAt,
      expiresAt: plan.expiresAt,
      ...(includeDiff ? { diff: plan.diff } : {}),
      warnings: plan.warnings,
      requiresCommitApproval: true,
      ...(includeProject ? { project: plan.project } : {}),
    };
  }

  private async ensurePlanFresh(plan: PlanDraft): Promise<void> {
    if (Date.parse(plan.expiresAt) <= this.now().getTime()) {
      await this.deletePlan(plan);
      fail("PLAN_EXPIRED", "El plan expiró; generá uno nuevo.");
    }
  }

  async health() {
    await this.ready();
    this.requireScope("read");
    await this.options.storage.ensureRoots();
    const status = await this.options.storage.status();
    return {
      protocol: "solara-agent",
      version: 1,
      writable: status.writable,
      schemaVersion: 2,
      scopes: [...this.scopes],
      actorId: this.actorId,
      features: {
        durablePlans: true,
        dryRunDiff: true,
        cooperativeLocks: true,
        durableJobs: true,
        streamedAssets: true,
      },
    };
  }

  async describeProtocol(rawParams: unknown = {}) {
    ProtocolDescribeParamsSchema.parse(rawParams);
    await this.ready();
    this.requireScope("read");
    return {
      protocol: "solara-agent",
      version: 1,
      scopes: [...this.scopes],
      methods: [
        "health",
        "protocol.describe",
        "stores.list",
        "stores.get",
        "plans.create",
        "plans.get",
        "plans.commit",
        "plans.discard",
        "plans.heartbeat",
        "jobs.get",
        "audit.list",
        "assets.stage",
        "assets.upload.begin",
        "assets.upload.chunk",
        "assets.upload.finish",
      ],
      operationTypes: [
        "store.create",
        "store.updateIdentity",
        "store.updateSeo",
        "category.create",
        "collection.create",
        "product.create",
        "product.update",
        "product.setStatus",
        "asset.attach",
      ],
      limits: {
        maxOperationsPerPlan: 500,
        maxInlineAssetBytes: MAX_INLINE_ASSET_BYTES,
        maxStreamedAssetBytes: MAX_INBOX_ASSET_BYTES,
        planTtlMs: PLAN_TTL_MS,
      },
      safety: {
        arbitraryPatch: false,
        arbitraryShell: false,
        arbitraryHtml: false,
        protectedDemosWritable: false,
      },
    };
  }

  async listStores() {
    await this.ready();
    this.requireScope("read");
    const listing = (await this.options.storage.list()) as {
      projects?: Array<Record<string, unknown>>;
      recovery?: unknown[];
    };
    const projects = await Promise.all(
      (listing.projects ?? []).map(async (item) => {
        const projectId = typeof item.projectId === "string" ? item.projectId : undefined;
        if (!projectId) return { ...item, protected: false };
        try {
          const current = await this.options.storage.readCurrent(projectId);
          const project = current
            ? readProjectArchive(Buffer.from(current.bytes).toString("utf8"))
            : undefined;
          const lock = await this.agentLocks.read(projectId);
          return {
            ...item,
            protected: project
              ? projectIsProtected(project, this.protectedStoreIds)
              : this.protectedStoreIds.has(projectId),
            agentLock: lock ? { expiresAt: lock.expiresAt, planId: lock.planId } : null,
          };
        } catch {
          return { ...item, protected: this.protectedStoreIds.has(projectId) };
        }
      }),
    );
    return {
      projects,
      recovery: listing.recovery ?? [],
    };
  }

  async getStore(rawParams: unknown) {
    await this.ready();
    this.requireScope("read");
    const params = StoreGetParamsSchema.parse(rawParams);
    const current = await this.options.storage.readCurrent(params.storeId);
    if (!current) fail("STORE_NOT_FOUND", `No existe la tienda ${params.storeId}.`);
    const project = readProjectArchive(Buffer.from(current.bytes).toString("utf8"));
    const protectedStore = projectIsProtected(project, this.protectedStoreIds);
    const agentLock = await this.agentLocks.read(params.storeId);
    const result = summary(
      project,
      Number((current.manifest as { current?: { version?: number } })?.current?.version ?? 0),
      protectedStore,
    );
    Object.assign(result, {
      agentLock: agentLock ? { expiresAt: agentLock.expiresAt, planId: agentLock.planId } : null,
    });
    if (params.include === "catalog") {
      return {
        ...result,
        catalog: {
          products: project.products.slice(0, 500),
          categories: project.categories.slice(0, 500),
          collections: project.collections.slice(0, 500),
        },
      };
    }
    return result;
  }

  async stageAsset(rawParams: unknown) {
    await this.ready();
    this.requireScope("assets:write");
    const params = AssetStageParamsSchema.parse(rawParams);
    await mkdir(this.inboxRoot, { recursive: true });
    await assertNoReparsePoints(this.options.applicationRoot, this.inboxRoot);
    let bytes: Uint8Array;
    if (params.source.kind === "base64") {
      if (params.source.data.length > 8_000_000)
        fail("ASSET_TOO_LARGE", "El base64 supera el límite de transporte.");
      bytes = strictBase64(params.source.data);
      if (bytes.byteLength > MAX_INLINE_ASSET_BYTES)
        fail("ASSET_USE_INBOX", "Para assets grandes usá agent-inbox y source.kind=inbox.");
    } else {
      const filename = params.source.filename;
      if (
        filename !== filename.replace(/[\\/]/g, "") ||
        !/^[^<>:"/\\|?*]+$/.test(filename) ||
        filename === "." ||
        filename === ".."
      ) {
        fail("ASSET_PATH_INVALID", "El nombre del asset no puede salir de agent-inbox.");
      }
      const path = join(this.inboxRoot, filename);
      bytes = new Uint8Array(await readFile(path));
      if (bytes.byteLength > MAX_INBOX_ASSET_BYTES)
        fail("ASSET_TOO_LARGE", "El asset supera el límite permitido.");
    }
    const result = await this.stageBytes(params, bytes);
    await this.audit("asset.staged", { assetId: result.assetId, bytes: result.bytes });
    return result;
  }

  private async stageBytes(
    params: { name: string; alt: string; mimeType: AssetStageParams["mimeType"] },
    bytes: Uint8Array,
  ) {
    if (bytes.byteLength > MAX_INBOX_ASSET_BYTES)
      fail("ASSET_TOO_LARGE", "El asset supera el límite permitido.");
    validateImageSignature(params.mimeType, bytes);
    const dimensions = imageDimensions(params.mimeType, bytes);
    if (dimensions.width <= 0 || dimensions.height <= 0)
      fail("ASSET_DIMENSIONS_INVALID", "Las dimensiones del asset no son válidas.");
    const assetId = makeId("asset-agent");
    const hash = digest(bytes);
    const asset = ImageAssetSchema.parse({
      kind: "image",
      id: assetId,
      name: params.name,
      alt: params.alt,
      mimeType: params.mimeType,
      source: `data:${params.mimeType};base64,${bytesToBase64(bytes)}`,
      width: dimensions.width,
      height: dimensions.height,
      hash,
    });
    const bytesPath = join(this.assetsRoot, `${assetId}.bin`);
    const metadataPath = join(this.assetsRoot, `${assetId}.json`);
    await writeAtomic(bytesPath, bytes);
    await writeAtomic(
      metadataPath,
      `${JSON.stringify({ ...asset, source: undefined }, (_, value) => (value === undefined ? undefined : value), 2)}\n`,
    );
    this.stagedAssets.set(assetId, { asset, bytesPath });
    return {
      assetId,
      bytes: bytes.byteLength,
      sha256: asset.hash,
      width: asset.width,
      height: asset.height,
    };
  }

  private async readStagedAsset(assetId: string): Promise<StagedAsset | undefined> {
    const cached = this.stagedAssets.get(assetId);
    if (cached) return cached;
    const metadataPath = join(this.assetsRoot, `${assetId}.json`);
    const bytesPath = join(this.assetsRoot, `${assetId}.bin`);
    try {
      const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as ImageAsset & {
        source?: string;
      };
      const bytes = new Uint8Array(await readFile(bytesPath));
      const asset = ImageAssetSchema.parse({
        ...metadata,
        source: `data:${metadata.mimeType};base64,${bytesToBase64(bytes)}`,
      });
      const staged = { asset, bytesPath };
      this.stagedAssets.set(assetId, staged);
      return staged;
    } catch {
      return undefined;
    }
  }

  async beginAssetUpload(rawParams: unknown) {
    await this.ready();
    this.requireScope("assets:write");
    const params = AssetUploadBeginParamsSchema.parse(rawParams);
    const uploadId = makeId("upload-agent");
    const metadataPath = join(this.uploadsRoot, `${uploadId}.json`);
    const partPath = join(this.uploadsRoot, `${uploadId}.part`);
    await writeAtomic(
      metadataPath,
      `${JSON.stringify({
        uploadId,
        name: params.name,
        alt: params.alt,
        mimeType: params.mimeType,
        expectedBytes: params.expectedBytes,
        receivedBytes: 0,
        nextSequence: 0,
        createdAt: this.now().toISOString(),
      })}\n`,
    );
    await writeAtomic(partPath, new Uint8Array());
    return { uploadId, nextSequence: 0, receivedBytes: 0, maxBytes: MAX_INBOX_ASSET_BYTES };
  }

  async uploadAssetChunk(rawParams: unknown) {
    await this.ready();
    this.requireScope("assets:write");
    const params = AssetUploadChunkParamsSchema.parse(rawParams);
    const metadataPath = join(this.uploadsRoot, `${params.uploadId}.json`);
    const partPath = join(this.uploadsRoot, `${params.uploadId}.part`);
    let metadata: {
      uploadId: string;
      expectedBytes?: number;
      receivedBytes: number;
      nextSequence: number;
    };
    try {
      metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    } catch {
      fail("UPLOAD_NOT_FOUND", "La carga de asset no existe o expiró.");
    }
    if (params.sequence !== metadata.nextSequence)
      fail("UPLOAD_SEQUENCE_INVALID", `Se esperaba el chunk ${metadata.nextSequence}.`);
    const bytes = strictBase64(params.data);
    if (bytes.byteLength > MAX_UPLOAD_CHUNK_BYTES)
      fail("UPLOAD_CHUNK_TOO_LARGE", "El chunk supera el límite permitido.");
    const receivedBytes = metadata.receivedBytes + bytes.byteLength;
    if (receivedBytes > MAX_INBOX_ASSET_BYTES)
      fail("ASSET_TOO_LARGE", "El asset supera el límite permitido.");
    if (metadata.expectedBytes !== undefined && receivedBytes > metadata.expectedBytes)
      fail("UPLOAD_SIZE_INVALID", "La carga supera expectedBytes.");
    await appendFile(partPath, bytes);
    const next = {
      ...metadata,
      receivedBytes,
      nextSequence: metadata.nextSequence + 1,
    };
    await writeAtomic(metadataPath, `${JSON.stringify(next)}\n`);
    return {
      uploadId: params.uploadId,
      nextSequence: next.nextSequence,
      receivedBytes,
      progress: metadata.expectedBytes ? receivedBytes / metadata.expectedBytes : null,
    };
  }

  async finishAssetUpload(rawParams: unknown) {
    await this.ready();
    this.requireScope("assets:write");
    const params = AssetUploadFinishParamsSchema.parse(rawParams);
    const metadataPath = join(this.uploadsRoot, `${params.uploadId}.json`);
    const partPath = join(this.uploadsRoot, `${params.uploadId}.part`);
    let metadata: {
      name: string;
      alt: string;
      mimeType: AssetStageParams["mimeType"];
      expectedBytes?: number;
      receivedBytes: number;
    };
    try {
      metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    } catch {
      fail("UPLOAD_NOT_FOUND", "La carga de asset no existe o expiró.");
    }
    if (metadata.expectedBytes !== undefined && metadata.receivedBytes !== metadata.expectedBytes)
      fail("UPLOAD_INCOMPLETE", "La carga no coincide con expectedBytes.");
    const bytes = new Uint8Array(await readFile(partPath));
    const hash = digest(bytes);
    if (params.sha256 && params.sha256.toLowerCase() !== hash)
      fail("ASSET_HASH_INVALID", "El SHA-256 del asset no coincide.");
    const result = await this.stageBytes(metadata, bytes);
    await rm(metadataPath, { force: true });
    await rm(partPath, { force: true });
    await this.audit("asset.upload.finished", {
      uploadId: params.uploadId,
      assetId: result.assetId,
      bytes: result.bytes,
    });
    return result;
  }

  async createPlan(rawParams: unknown) {
    await this.ready();
    this.requireScope("plans:write");
    const params = PlanCreateParamsSchema.parse(rawParams);
    const operations = params.operations.map((operation: AgentOperation) =>
      AgentOperationSchema.parse(operation),
    );
    if (params.idempotencyKey) {
      const existing = [...this.plans.values()].find(
        (plan) => plan.idempotencyKey === params.idempotencyKey,
      );
      if (existing) {
        await this.ensurePlanFresh(existing);
        return this.planResponse(existing);
      }
      const committed = await this.readCommitted(params.idempotencyKey);
      if (committed) return { status: "committed", ...committed };
    }
    const first = operations[0];
    if (!first) fail("PLAN_INVALID", "El plan requiere al menos una operación.");
    const createOperation = first.type === "store.create" ? first : undefined;
    const isNew = createOperation !== undefined;
    if (
      isNew &&
      operations.some((operation, index) => operation.type === "store.create" && index !== 0)
    ) {
      fail(
        "PLAN_INVALID",
        "Una planificación nueva sólo puede crear una tienda y debe hacerlo primero.",
      );
    }
    const storeId = isNew ? (createOperation.storeId ?? makeId("store-agent")) : params.storeId;
    if (!storeId)
      fail("STORE_ID_REQUIRED", "Las operaciones sobre una tienda existente requieren storeId.");
    if (!isNew && params.baseVersion === undefined)
      fail("VERSION_REQUIRED", "Las tiendas existentes requieren baseVersion entero.");
    const current = isNew ? undefined : await this.options.storage.readCurrent(storeId);
    if (!isNew && !current) fail("STORE_NOT_FOUND", `No existe la tienda ${storeId}.`);
    const baseVersion =
      params.baseVersion ??
      (current
        ? Number((current.manifest as { current?: { version?: number } })?.current?.version ?? 0)
        : null);
    if (!isNew && !Number.isInteger(baseVersion))
      fail("VERSION_REQUIRED", "Las tiendas existentes requieren baseVersion entero.");
    if (isNew && baseVersion !== null && baseVersion !== 0)
      fail("VERSION_INVALID", "Una tienda nueva debe usar baseVersion null o 0.");
    let base: StoreProjectV1;
    if (isNew) {
      base = createCleanProject(createOperation, storeId, this.now());
    } else {
      if (!current) fail("STORE_NOT_FOUND", `No existe la tienda ${storeId}.`);
      base = readProjectArchive(Buffer.from(current.bytes).toString("utf8"));
      if (projectIsProtected(base, this.protectedStoreIds))
        fail(
          "PROTECTED_STORE",
          "La tienda de demo está protegida. Creá una tienda nueva para modificarla.",
        );
    }
    const project = await this.applyOperations(base, isNew ? operations.slice(1) : operations);
    const planId = makeId("plan-agent");
    const createdAt = this.now().toISOString();
    const plan: PlanDraft = {
      planId,
      storeId: project.id,
      baseVersion,
      project,
      operations,
      createdNewStore: isNew,
      createdAt,
      expiresAt: new Date(this.now().getTime() + PLAN_TTL_MS).toISOString(),
      diff: planDiff(isNew ? undefined : base, project, operations, isNew),
      warnings: planWarnings(
        project,
        planDiff(isNew ? undefined : base, project, operations, isNew),
      ),
      includeDiff: params.includeDiff,
      ...(params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : {}),
    };
    try {
      await this.agentLocks.claim(plan.storeId, plan.planId, {
        planId: plan.planId,
        storeId: plan.storeId,
      });
      this.plans.set(planId, plan);
      await this.persistPlan(plan);
      await this.audit("plan.created", {
        planId,
        storeId: plan.storeId,
        operationCount: operations.length,
        createdNewStore: isNew,
      });
    } catch (error) {
      await this.agentLocks.release(plan.storeId, plan.planId);
      throw error;
    }
    return this.planResponse(plan, false, params.includeDiff);
  }

  async getPlan(rawParams: unknown) {
    await this.ready();
    this.requireScope("read");
    const params = PlanGetParamsSchema.parse(rawParams);
    const plan = this.plans.get(params.planId);
    if (!plan) fail("PLAN_NOT_FOUND", "El plan no existe o expiró.");
    await this.ensurePlanFresh(plan);
    await this.agentLocks.heartbeat(plan.storeId, plan.planId);
    return this.planResponse(plan, params.includeProject);
  }

  async discardPlan(rawParams: unknown) {
    await this.ready();
    this.requireScope("plans:write");
    const params = PlanDiscardParamsSchema.parse(rawParams);
    const plan = this.plans.get(params.planId);
    if (!plan) fail("PLAN_NOT_FOUND", "El plan no existe o expiró.");
    await this.ensurePlanFresh(plan);
    await this.deletePlan(plan);
    await this.audit("plan.discarded", { planId: plan.planId, storeId: plan.storeId });
    return { planId: plan.planId, discarded: true };
  }

  async heartbeatPlan(rawParams: unknown) {
    await this.ready();
    this.requireScope("plans:write");
    const params = PlanHeartbeatParamsSchema.parse(rawParams);
    const plan = this.plans.get(params.planId);
    if (!plan) fail("PLAN_NOT_FOUND", "El plan no existe o expiró.");
    await this.ensurePlanFresh(plan);
    const lock = await this.agentLocks.heartbeat(plan.storeId, plan.planId);
    return { planId: plan.planId, expiresAt: lock.expiresAt };
  }

  async commitPlan(rawParams: unknown) {
    await this.ready();
    this.requireScope("commit");
    const params = PlanCommitParamsSchema.parse(rawParams);
    if (params.idempotencyKey) {
      const committed = await this.readCommitted(params.idempotencyKey);
      if (committed) return committed;
    }
    if (params.async) {
      const existingJob = [...this.jobs.values()].find(
        (job) => job.planId === params.planId && ["queued", "running"].includes(job.status),
      );
      if (existingJob) return this.jobResponse(existingJob);
      const job: AgentJob = {
        jobId: makeId("job-agent"),
        kind: "plans.commit",
        planId: params.planId,
        ...(this.requestId === undefined ? {} : { requestId: this.requestId }),
        status: "queued",
        createdAt: this.now().toISOString(),
        updatedAt: this.now().toISOString(),
      };
      await this.persistJob(job);
      void this.runCommitJob(job, params);
      return this.jobResponse(job);
    }
    return this.commitPlanNow(params, this.requestId);
  }

  private async commitPlanNow(rawParams: unknown, requestId = this.requestId) {
    const params = PlanCommitParamsSchema.parse(rawParams);
    const plan = this.plans.get(params.planId);
    if (!plan) fail("PLAN_NOT_FOUND", "El plan no existe, ya fue consumido o expiró.");
    await this.ensurePlanFresh(plan);
    const idempotencyKey = params.idempotencyKey ?? plan.idempotencyKey;
    if (idempotencyKey) {
      const committed = await this.readCommitted(idempotencyKey);
      if (committed) return committed;
    }
    await this.agentLocks.heartbeat(plan.storeId, plan.planId);
    await this.audit(
      "plan.commit.started",
      { planId: plan.planId, storeId: plan.storeId },
      requestId,
    );
    const current = await this.options.storage.readCurrent(plan.storeId);
    const currentVersion = current
      ? Number((current.manifest as { current?: { version?: number } })?.current?.version ?? 0)
      : null;
    if (plan.createdNewStore ? current : currentVersion !== plan.baseVersion) {
      fail("VERSION_CONFLICT", "La tienda cambió desde la creación del plan; generá uno nuevo.", {
        expected: plan.baseVersion,
        actual: currentVersion,
      });
    }
    const validated = StoreProjectV2Schema.parse(plan.project);
    let exportResult: ReturnType<typeof exportProject> | undefined;
    let exportWarning: string | undefined;
    try {
      exportResult = exportProject(validated, { mode: "production" });
    } catch (error) {
      exportWarning = error instanceof Error ? error.message : String(error);
      exportResult = exportProject(validated, { mode: "draft" });
    }
    const archive = new TextEncoder().encode(createProjectArchive(validated));
    const tx = await this.options.storage.beginSave({
      projectId: validated.id,
      name: validated.name,
      slug: validated.slug,
      projectUpdatedAt: validated.updatedAt,
      expectedVersion: plan.baseVersion,
      actor: { kind: "agent", id: plan.planId },
    });
    try {
      await this.options.storage.upload(tx.transactionId, "project", bytesStream(archive));
      if (!exportWarning && exportResult) {
        const map = new TextEncoder().encode(siteMap(exportResult.files));
        await this.options.storage.upload(tx.transactionId, "site", bytesStream(map));
      }
      const receipt = await this.options.storage.commit(tx.transactionId);
      const result = {
        receipt,
        storeId: validated.id,
        version: tx.version,
        status: exportWarning ? "site-outdated" : "synced",
        audit: exportResult?.audit ?? [],
        ...(exportWarning ? { exportWarning } : {}),
      };
      if (idempotencyKey)
        await writeAtomic(
          this.committedPath(idempotencyKey),
          `${JSON.stringify(result, null, 2)}\n`,
        );
      await this.audit(
        "plan.commit.succeeded",
        {
          planId: plan.planId,
          storeId: validated.id,
          version: tx.version,
          status: result.status,
        },
        requestId,
      );
      await this.deletePlan(plan);
      return result;
    } catch (error) {
      await this.options.storage.abort(tx.transactionId).catch(() => undefined);
      await this.audit(
        "plan.commit.failed",
        {
          planId: plan.planId,
          storeId: plan.storeId,
          error: agentError(error),
        },
        requestId,
      );
      throw error;
    }
  }

  private async readCommitted(idempotencyKey: string): Promise<unknown | undefined> {
    try {
      return JSON.parse(await readFile(this.committedPath(idempotencyKey), "utf8"));
    } catch {
      return undefined;
    }
  }

  private jobResponse(job: AgentJob) {
    return {
      jobId: job.jobId,
      kind: job.kind,
      planId: job.planId,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      ...(job.result === undefined ? {} : { result: job.result }),
      ...(job.error === undefined ? {} : { error: job.error }),
    };
  }

  private async runCommitJob(job: AgentJob, params: unknown): Promise<void> {
    const running = {
      ...job,
      status: "running" as const,
      updatedAt: this.now().toISOString(),
    };
    await this.persistJob(running);
    Object.assign(job, running);
    try {
      const result = await this.commitPlanNow(params, job.requestId);
      const succeeded = {
        ...job,
        result,
        status: "succeeded" as const,
        updatedAt: this.now().toISOString(),
      };
      await this.persistJob(succeeded);
      Object.assign(job, succeeded);
    } catch (error) {
      const failed = {
        ...job,
        status: "failed" as const,
        error: agentError(error),
        updatedAt: this.now().toISOString(),
      };
      await this.persistJob(failed);
      Object.assign(job, failed);
    }
  }

  async getJob(rawParams: unknown) {
    await this.ready();
    this.requireScope("read");
    const params = JobGetParamsSchema.parse(rawParams);
    const job = this.jobs.get(params.jobId);
    if (!job) fail("JOB_NOT_FOUND", "El trabajo no existe o expiró.");
    return this.jobResponse(job);
  }

  async listAudit(rawParams: unknown = { limit: 50 }) {
    await this.ready();
    this.requireScope("audit:read");
    const params = AuditListParamsSchema.parse(rawParams);
    try {
      const lines = (await readFile(this.auditPath, "utf8")).trim().split(/\r?\n/).filter(Boolean);
      return { entries: lines.slice(-params.limit).map((line) => JSON.parse(line)) };
    } catch {
      return { entries: [] };
    }
  }

  private async applyOperations(
    base: StoreProjectV1,
    rawOperations: AgentOperation[],
  ): Promise<StoreProjectV1> {
    const stagedForPlan = (
      await Promise.all(
        rawOperations
          .filter(
            (operation): operation is Extract<AgentOperation, { type: "asset.attach" }> =>
              operation.type === "asset.attach",
          )
          .map(async (operation) => (await this.readStagedAsset(operation.assetId))?.asset),
      )
    ).filter((asset): asset is ImageAsset => asset !== undefined);
    const stagedIds = new Set(stagedForPlan.map((asset) => asset.id));
    let project =
      stagedForPlan.length === 0
        ? base
        : StoreProjectV2Schema.parse({
            ...base,
            assets: [
              ...base.assets,
              ...stagedForPlan.filter(
                (asset) =>
                  !base.assets.some(
                    (candidate) => candidate.id === asset.id && stagedIds.has(candidate.id),
                  ),
              ),
            ],
          });
    for (const rawOperation of rawOperations) {
      const operation = AgentOperationSchema.parse(rawOperation);
      const at = this.now().toISOString();
      switch (operation.type) {
        case "store.create": {
          fail(
            "PLAN_INVALID",
            "store.create sólo puede ser la primera operación de un plan nuevo.",
          );
          break;
        }
        case "store.updateIdentity": {
          const identity = {
            ...project.identity,
            ...operation.changes,
            brandName: operation.changes.brandName ?? project.identity.brandName,
          };
          const whatsappPhone =
            operation.changes.phone?.replace(/\D/g, "") ?? project.whatsapp.phone;
          project = StoreProjectV2Schema.parse({
            ...project,
            identity,
            whatsapp: {
              ...project.whatsapp,
              ...(whatsappPhone.length >= 8 && whatsappPhone.length <= 15
                ? { phone: whatsappPhone }
                : {}),
              greeting: personalizeWhatsAppGreeting(project.whatsapp.greeting, identity.brandName),
            },
            updatedAt: at,
          });
          break;
        }
        case "store.updateSeo":
          project = StoreProjectV2Schema.parse({
            ...project,
            seo: { ...project.seo, ...operation.changes },
            updatedAt: at,
          });
          break;
        case "category.create": {
          const category = CategorySchema.parse({
            id: operation.categoryId ?? makeId("category-agent"),
            slug: operation.slug,
            title: operation.title,
            description: operation.description,
            ...(operation.parentId ? { parentId: operation.parentId } : {}),
            ...(operation.imageId ? { imageId: operation.imageId } : {}),
            productIds: [],
          });
          project = reduceProject(project, { type: "category.create", category, at });
          break;
        }
        case "collection.create": {
          const collection = CollectionSchema.parse({
            id: operation.collectionId ?? makeId("collection-agent"),
            slug: operation.slug,
            title: operation.title,
            description: operation.description,
            ...(operation.imageId ? { imageId: operation.imageId } : {}),
            productIds: [],
          });
          project = reduceProject(project, { type: "collection.create", collection, at });
          break;
        }
        case "product.create": {
          const productId = operation.productId ?? makeId("product-agent");
          const rawVariants = operation.variants ?? [
            {
              title: "Única",
              sku: operation.sku ?? productId.slice(-12),
              priceCents: operation.priceCents ?? 0,
              available: true,
              stockStatus: "in_stock" as const,
              optionValues: {},
            },
          ];
          const product: Product = ProductSchema.parse({
            id: productId,
            slug: operation.slug,
            title: operation.title,
            description: operation.description,
            status: operation.status,
            brand: operation.brand ?? project.identity.brandName,
            categoryIds: operation.categoryIds,
            collectionIds: operation.collectionIds,
            tags: operation.tags,
            imageIds: operation.imageIds,
            variants: rawVariants.map((variant, index) => ({
              id: makeId(`variant-agent-${index}`),
              title: variant.title,
              sku: variant.sku,
              optionValues: variant.optionValues,
              price: variant.priceCents,
              ...(variant.compareAtPriceCents === undefined
                ? {}
                : { compareAtPrice: variant.compareAtPriceCents }),
              available: variant.available,
              stockStatus: variant.stockStatus,
            })),
            createdAt: at,
            updatedAt: at,
          });
          project = reduceProject(project, { type: "product.create", product, at });
          break;
        }
        case "product.update":
          project = reduceProject(project, {
            type: "product.update",
            productId: operation.productId as Product["id"],
            changes: operation.changes as never,
            at,
          });
          break;
        case "product.setStatus":
          project = reduceProject(project, {
            type: "products.setStatus",
            productIds: [operation.productId as Product["id"]],
            status: operation.status,
            at,
          });
          break;
        case "asset.attach": {
          const staged = await this.readStagedAsset(operation.assetId);
          const assetExists = project.assets.some((asset) => asset.id === operation.assetId);
          if (!assetExists && !staged)
            fail(
              "ASSET_NOT_STAGED",
              `El asset ${operation.assetId} no está staged en esta sesión.`,
            );
          let assets = project.assets;
          if (!assetExists) {
            if (!staged)
              fail(
                "ASSET_NOT_STAGED",
                `El asset ${operation.assetId} no está staged en esta sesión.`,
              );
            assets = [...project.assets, staged.asset];
          }
          if (operation.target === "product") {
            if (!operation.productId)
              fail("PRODUCT_ID_REQUIRED", "Un asset de producto requiere productId.");
            const product = project.products.find((item) => item.id === operation.productId);
            if (!product)
              fail("PRODUCT_NOT_FOUND", `No existe el producto ${operation.productId}.`);
            project = StoreProjectV2Schema.parse({
              ...project,
              assets,
              products: project.products.map((item) =>
                item.id === operation.productId
                  ? { ...item, imageIds: [...new Set([...item.imageIds, operation.assetId])] }
                  : item,
              ),
              updatedAt: at,
            });
          } else {
            project = StoreProjectV2Schema.parse({
              ...project,
              assets,
              identity:
                operation.target === "identity.logo"
                  ? { ...project.identity, logoAssetId: operation.assetId }
                  : project.identity,
              seo: {
                ...project.seo,
                ...(operation.target === "seo.favicon"
                  ? { faviconAssetId: operation.assetId }
                  : {}),
                ...(operation.target === "seo.social" ? { socialImageId: operation.assetId } : {}),
              },
              updatedAt: at,
            });
          }
          break;
        }
      }
    }
    return StoreProjectV2Schema.parse(project);
  }
}

export function createAgentController(options: ControllerOptions): AgentController {
  return new AgentController(options);
}

export function agentError(error: unknown): { code: string; message: string; details?: unknown } {
  const candidate = error as AgentError;
  return {
    code: candidate?.code ?? "AGENT_ERROR",
    message: error instanceof Error ? error.message : String(error),
    ...(candidate?.details === undefined ? {} : { details: candidate.details }),
  };
}

export async function dispatchAgentMethod(
  controller: AgentController,
  method: string,
  params: unknown,
  requestId?: string | number,
): Promise<unknown> {
  controller.setRequestContext(requestId);
  try {
    switch (method) {
      case "health":
        return await controller.health();
      case "protocol.describe":
        return await controller.describeProtocol(params);
      case "stores.list":
        return await controller.listStores();
      case "stores.get":
        return await controller.getStore(params);
      case "plans.create":
        return await controller.createPlan(params);
      case "plans.get":
        return await controller.getPlan(params);
      case "plans.commit":
        return await controller.commitPlan(params);
      case "plans.discard":
        return await controller.discardPlan(params);
      case "plans.heartbeat":
        return await controller.heartbeatPlan(params);
      case "jobs.get":
        return await controller.getJob(params);
      case "audit.list":
        return await controller.listAudit(params);
      case "assets.stage":
        return await controller.stageAsset(params);
      case "assets.upload.begin":
        return await controller.beginAssetUpload(params);
      case "assets.upload.chunk":
        return await controller.uploadAssetChunk(params);
      case "assets.upload.finish":
        return await controller.finishAssetUpload(params);
      default:
        fail("METHOD_NOT_FOUND", `Método de agente desconocido: ${method}.`);
    }
  } finally {
    controller.setRequestContext(undefined);
  }
}
