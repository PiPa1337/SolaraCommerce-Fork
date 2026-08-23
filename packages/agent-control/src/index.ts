import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type AgentOperation,
  AgentOperationSchema,
  type AssetStageParams,
  AssetStageParamsSchema,
  PlanCommitParamsSchema,
  PlanCreateParamsSchema,
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
// El layout compartido es un módulo Node ESM sin declaraciones; Vite lo
// incorpora al bundle y el contrato runtime se comprueba en los tests portables.
// @ts-expect-error módulo .mjs compartido sin d.ts
import { assertNoReparsePoints } from "../../exporter/scripts/portable-layout.mjs";

interface AgentLocalProjectStorage {
  applicationRoot: string;
  projectsRoot: string;
  ensureRoots(): Promise<void>;
  list(): Promise<unknown>;
  beginSave(meta: {
    projectId: string;
    name: string;
    slug: string;
    projectUpdatedAt: string;
    expectedVersion: number | null;
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
  idempotencyKey?: string;
}

interface StagedAsset {
  asset: ImageAsset;
}

interface ControllerOptions {
  storage: AgentLocalProjectStorage;
  applicationRoot: string;
  now?: () => Date;
  protectedStoreIds?: Iterable<string>;
}

const MAX_INLINE_ASSET_BYTES = 1_500_000;
const MAX_INBOX_ASSET_BYTES = 20_000_000;

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
  private readonly committed = new Map<string, unknown>();
  private readonly protectedStoreIds: Set<string>;
  private readonly now: () => Date;
  private readonly inboxRoot: string;

  constructor(private readonly options: ControllerOptions) {
    this.protectedStoreIds = new Set(options.protectedStoreIds ?? []);
    this.now = options.now ?? (() => new Date());
    this.inboxRoot = join(options.applicationRoot, "agent-inbox");
  }

  async health() {
    await this.options.storage.ensureRoots();
    return { protocol: "solara-agent", version: 1, writable: true, schemaVersion: 2 };
  }

  async listStores() {
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
          return {
            ...item,
            protected: project
              ? projectIsProtected(project, this.protectedStoreIds)
              : this.protectedStoreIds.has(projectId),
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
    const params = StoreGetParamsSchema.parse(rawParams);
    const current = await this.options.storage.readCurrent(params.storeId);
    if (!current) fail("STORE_NOT_FOUND", `No existe la tienda ${params.storeId}.`);
    const project = readProjectArchive(Buffer.from(current.bytes).toString("utf8"));
    const protectedStore = projectIsProtected(project, this.protectedStoreIds);
    const result = summary(
      project,
      Number((current.manifest as { current?: { version?: number } })?.current?.version ?? 0),
      protectedStore,
    );
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
    const params = AssetStageParamsSchema.parse(rawParams);
    await mkdir(this.inboxRoot, { recursive: true });
    await assertNoReparsePoints(this.options.applicationRoot, this.inboxRoot);
    let bytes: Uint8Array;
    if (params.source.kind === "base64") {
      if (params.source.data.length > 8_000_000)
        fail("ASSET_TOO_LARGE", "El base64 supera el límite de transporte.");
      try {
        bytes = new Uint8Array(Buffer.from(params.source.data, "base64"));
      } catch {
        fail("ASSET_BASE64_INVALID", "El asset no contiene base64 válido.");
      }
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
    validateImageSignature(params.mimeType, bytes);
    const dimensions = imageDimensions(params.mimeType, bytes);
    if (dimensions.width <= 0 || dimensions.height <= 0)
      fail("ASSET_DIMENSIONS_INVALID", "Las dimensiones del asset no son válidas.");
    const assetId = makeId("asset-agent");
    const asset = ImageAssetSchema.parse({
      kind: "image",
      id: assetId,
      name: params.name,
      alt: params.alt,
      mimeType: params.mimeType,
      source: `data:${params.mimeType};base64,${bytesToBase64(bytes)}`,
      width: dimensions.width,
      height: dimensions.height,
      hash: digest(bytes),
    });
    this.stagedAssets.set(assetId, { asset });
    return {
      assetId,
      bytes: bytes.byteLength,
      sha256: asset.hash,
      width: asset.width,
      height: asset.height,
    };
  }

  async createPlan(rawParams: unknown) {
    const params = PlanCreateParamsSchema.parse(rawParams);
    const operations = params.operations.map((operation: AgentOperation) =>
      AgentOperationSchema.parse(operation),
    );
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
    const project = this.applyOperations(base, isNew ? operations.slice(1) : operations);
    const planId = makeId("plan-agent");
    const plan: PlanDraft = {
      planId,
      storeId: project.id,
      baseVersion,
      project,
      operations,
      createdNewStore: isNew,
      ...(params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : {}),
    };
    this.plans.set(planId, plan);
    return {
      planId,
      ...summary(project, baseVersion, false),
      baseVersion,
      nextVersion: (baseVersion ?? 0) + 1,
      operationCount: operations.length,
      createdNewStore: isNew,
      auditHint: "El commit revalida schema, índices y exportación antes de publicar.",
    };
  }

  async commitPlan(rawParams: unknown) {
    const params = PlanCommitParamsSchema.parse(rawParams);
    const plan = this.plans.get(params.planId);
    if (!plan) fail("PLAN_NOT_FOUND", "El plan no existe, ya fue consumido o expiró.");
    const idempotencyKey = params.idempotencyKey ?? plan.idempotencyKey;
    if (idempotencyKey && this.committed.has(idempotencyKey))
      return this.committed.get(idempotencyKey);
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
      if (idempotencyKey) this.committed.set(idempotencyKey, result);
      this.plans.delete(plan.planId);
      return result;
    } catch (error) {
      await this.options.storage.abort(tx.transactionId).catch(() => undefined);
      throw error;
    }
  }

  private applyOperations(base: StoreProjectV1, rawOperations: AgentOperation[]): StoreProjectV1 {
    const stagedForPlan = rawOperations
      .filter(
        (operation): operation is Extract<AgentOperation, { type: "asset.attach" }> =>
          operation.type === "asset.attach",
      )
      .map((operation) => this.stagedAssets.get(operation.assetId)?.asset)
      .filter((asset): asset is ImageAsset => asset !== undefined);
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
          const staged = this.stagedAssets.get(operation.assetId);
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
): Promise<unknown> {
  switch (method) {
    case "health":
      return controller.health();
    case "stores.list":
      return controller.listStores();
    case "stores.get":
      return controller.getStore(params);
    case "plans.create":
      return controller.createPlan(params);
    case "plans.commit":
      return controller.commitPlan(params);
    case "assets.stage":
      return controller.stageAsset(params);
    default:
      fail("METHOD_NOT_FOUND", `Método de agente desconocido: ${method}.`);
  }
}
