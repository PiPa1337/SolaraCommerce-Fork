import { z } from "zod";

export const AGENT_PROTOCOL = "solara-agent" as const;
export const AGENT_PROTOCOL_VERSION = 1 as const;

const SafeIdSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/);
const SlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const IsoDateSchema = z.string().datetime();

export const StoreCreateSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("base-template"), templateId: z.literal("catalog-modern") }),
  z.object({ kind: z.literal("clean") }),
]);

export const ProductVariantInputSchema = z.object({
  title: z.string().min(1).max(160),
  sku: z.string().max(120).default(""),
  priceCents: z.number().int().nonnegative(),
  compareAtPriceCents: z.number().int().nonnegative().optional(),
  available: z.boolean().default(true),
  stockStatus: z.enum(["in_stock", "out_of_stock", "preorder"]).default("in_stock"),
  optionValues: z.record(z.string(), z.string()).default({}),
});

export const AgentOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("store.create"),
    storeId: SafeIdSchema.optional(),
    name: z.string().min(1).max(120),
    brandName: z.string().min(1).max(120).optional(),
    slug: SlugSchema.optional(),
    baseUrl: z.string().url().optional(),
    email: z.string().email().or(z.literal("")).optional(),
    phone: z
      .string()
      .regex(/^\d{0,15}$/)
      .optional(),
    source: StoreCreateSourceSchema.default({
      kind: "base-template",
      templateId: "catalog-modern",
    }),
  }),
  z.object({
    type: z.literal("store.updateIdentity"),
    changes: z.object({
      legalName: z.string().min(1).max(160).optional(),
      brandName: z.string().min(1).max(120).optional(),
      description: z.string().max(2000).optional(),
      email: z.string().email().or(z.literal("")).optional(),
      phone: z.string().max(80).optional(),
      address: z.string().max(500).optional(),
    }),
  }),
  z.object({
    type: z.literal("store.updateSeo"),
    changes: z.object({
      title: z.string().min(1).max(70).optional(),
      description: z.string().min(1).max(180).optional(),
      searchConsoleVerification: z.string().max(500).optional(),
      merchantVerification: z.string().max(500).optional(),
    }),
  }),
  z.object({
    type: z.literal("category.create"),
    categoryId: SafeIdSchema.optional(),
    slug: SlugSchema,
    title: z.string().min(1).max(160),
    description: z.string().max(2000).default(""),
    parentId: SafeIdSchema.optional(),
    imageId: SafeIdSchema.optional(),
  }),
  z.object({
    type: z.literal("collection.create"),
    collectionId: SafeIdSchema.optional(),
    slug: SlugSchema,
    title: z.string().min(1).max(160),
    description: z.string().max(2000).default(""),
    imageId: SafeIdSchema.optional(),
  }),
  z.object({
    type: z.literal("product.create"),
    productId: SafeIdSchema.optional(),
    slug: SlugSchema,
    title: z.string().min(1).max(200),
    description: z.string().max(10000).default(""),
    brand: z.string().max(120).optional(),
    status: z.enum(["active", "hidden", "archived"]).default("active"),
    categoryIds: z.array(SafeIdSchema).default([]),
    collectionIds: z.array(SafeIdSchema).default([]),
    tags: z.array(z.string().min(1).max(80)).default([]),
    imageIds: z.array(SafeIdSchema).default([]),
    variants: z.array(ProductVariantInputSchema).min(1).optional(),
    priceCents: z.number().int().nonnegative().optional(),
    sku: z.string().max(120).optional(),
  }),
  z.object({
    type: z.literal("product.update"),
    productId: SafeIdSchema,
    changes: z.object({
      slug: SlugSchema.optional(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(10000).optional(),
      brand: z.string().max(120).optional(),
      categoryIds: z.array(SafeIdSchema).optional(),
      collectionIds: z.array(SafeIdSchema).optional(),
      tags: z.array(z.string().min(1).max(80)).optional(),
      imageIds: z.array(SafeIdSchema).optional(),
    }),
  }),
  z.object({
    type: z.literal("product.setStatus"),
    productId: SafeIdSchema,
    status: z.enum(["active", "hidden", "archived"]),
  }),
  z.object({
    type: z.literal("store.archive"),
    storeId: SafeIdSchema.optional(),
    confirmation: z.literal("ARCHIVAR_TIENDA"),
  }),
  z.object({
    type: z.literal("asset.attach"),
    assetId: SafeIdSchema,
    target: z.enum(["identity.logo", "seo.favicon", "seo.social", "product"]),
    productId: SafeIdSchema.optional(),
  }),
  z.object({
    type: z.literal("section.updateSettings"),
    sectionId: SafeIdSchema,
    settings: z.record(z.string(), z.unknown()),
  }),
]);

export const PlanCreateParamsSchema = z.object({
  storeId: SafeIdSchema.optional(),
  baseVersion: z.number().int().nonnegative().nullable().optional(),
  idempotencyKey: z.string().min(8).max(160).optional(),
  includeDiff: z.boolean().default(true),
  operations: z.array(AgentOperationSchema).min(1).max(500),
});

export const PlanCommitParamsSchema = z.object({
  planId: SafeIdSchema,
  idempotencyKey: z.string().min(8).max(160).optional(),
  async: z.boolean().default(false),
});

export const StoreGetParamsSchema = z.object({
  storeId: SafeIdSchema,
  include: z.enum(["summary", "catalog"]).default("summary"),
});

export const AssetStageParamsSchema = z.object({
  name: z.string().min(1).max(160),
  alt: z.string().max(500).default(""),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("base64"), data: z.string().min(1).max(8_000_000) }),
    z.object({ kind: z.literal("inbox"), filename: z.string().min(1).max(160) }),
  ]),
});

export const AgentScopeSchema = z.enum([
  "read",
  "plans:write",
  "commit",
  "assets:write",
  "audit:read",
  "template:read",
  "template:write",
  "rollouts:read",
  "rollouts:write",
]);

export const PlanGetParamsSchema = z.object({
  planId: SafeIdSchema,
  includeProject: z.boolean().default(false),
});

export const PlanDiscardParamsSchema = z.object({
  planId: SafeIdSchema,
});

export const PlanHeartbeatParamsSchema = z.object({
  planId: SafeIdSchema,
});

export const JobGetParamsSchema = z.object({
  jobId: SafeIdSchema,
});

export const AuditListParamsSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
});

export const AssetUploadBeginParamsSchema = z.object({
  name: z.string().min(1).max(160),
  alt: z.string().max(500).default(""),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  expectedBytes: z.number().int().positive().max(20_000_000).optional(),
});

export const AssetUploadChunkParamsSchema = z.object({
  uploadId: SafeIdSchema,
  sequence: z.number().int().nonnegative(),
  data: z.string().min(1).max(1_400_000),
});

export const AssetUploadFinishParamsSchema = z.object({
  uploadId: SafeIdSchema,
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
});

export const ProtocolDescribeParamsSchema = z.object({});

export const TemplateGetParamsSchema = z.object({
  templateId: z.literal("catalog-modern").default("catalog-modern"),
});

export const TemplatePreviewUpgradeParamsSchema = z.object({
  templateId: z.literal("catalog-modern").default("catalog-modern"),
  baseVersion: z.number().int().nonnegative().optional(),
});

export const TemplateCommitUpgradeParamsSchema = z.object({
  previewId: SafeIdSchema,
  baseVersion: z.number().int().nonnegative(),
  confirmation: z.literal("ACTUALIZAR_PLANTILLA"),
  idempotencyKey: z.string().min(8).max(160).optional(),
});

export const RolloutTargetSchema = z.object({
  status: z.literal("active").default("active"),
  excludeProtected: z.boolean().default(true),
  storeIds: z.array(SafeIdSchema).max(500).optional(),
});

export const RolloutPreviewParamsSchema = z.object({
  kind: z.enum(["site-rebuild", "project-migration"]),
  migrationId: z.string().min(1).max(160).optional(),
  target: RolloutTargetSchema.default({ status: "active", excludeProtected: true }),
});

export const RolloutCommitParamsSchema = z.object({
  previewId: SafeIdSchema,
  idempotencyKey: z.string().min(8).max(160).optional(),
  async: z.boolean().default(true),
});

export const RolloutGetParamsSchema = z.object({
  rolloutId: SafeIdSchema,
});

export const RolloutRollbackParamsSchema = z.object({
  rolloutId: SafeIdSchema,
  storeId: SafeIdSchema,
  expectedVersion: z.number().int().nonnegative(),
});

export const StoreRestoreParamsSchema = z.object({
  storeId: SafeIdSchema,
  expectedVersion: z.number().int().nonnegative().optional(),
});

export const AgentRequestSchema = z.object({
  protocol: z.literal(AGENT_PROTOCOL).optional(),
  version: z.literal(AGENT_PROTOCOL_VERSION).optional(),
  id: z.union([z.string().min(1), z.number().int()]),
  method: z.string().min(1),
  params: z.unknown().optional(),
});

export const AgentErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
});

export const AgentResponseSchema = z.object({
  protocol: z.literal(AGENT_PROTOCOL),
  version: z.literal(AGENT_PROTOCOL_VERSION),
  id: z.union([z.string().min(1), z.number().int()]),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: AgentErrorSchema.optional(),
});

export type AgentOperation = z.infer<typeof AgentOperationSchema>;
export type PlanCreateParams = z.infer<typeof PlanCreateParamsSchema>;
export type PlanCommitParams = z.infer<typeof PlanCommitParamsSchema>;
export type PlanGetParams = z.infer<typeof PlanGetParamsSchema>;
export type PlanDiscardParams = z.infer<typeof PlanDiscardParamsSchema>;
export type PlanHeartbeatParams = z.infer<typeof PlanHeartbeatParamsSchema>;
export type JobGetParams = z.infer<typeof JobGetParamsSchema>;
export type AuditListParams = z.infer<typeof AuditListParamsSchema>;
export type StoreGetParams = z.infer<typeof StoreGetParamsSchema>;
export type AssetStageParams = z.infer<typeof AssetStageParamsSchema>;
export type AssetUploadBeginParams = z.infer<typeof AssetUploadBeginParamsSchema>;
export type AssetUploadChunkParams = z.infer<typeof AssetUploadChunkParamsSchema>;
export type AssetUploadFinishParams = z.infer<typeof AssetUploadFinishParamsSchema>;
export type TemplateGetParams = z.infer<typeof TemplateGetParamsSchema>;
export type TemplatePreviewUpgradeParams = z.infer<typeof TemplatePreviewUpgradeParamsSchema>;
export type TemplateCommitUpgradeParams = z.infer<typeof TemplateCommitUpgradeParamsSchema>;
export type RolloutPreviewParams = z.infer<typeof RolloutPreviewParamsSchema>;
export type RolloutCommitParams = z.infer<typeof RolloutCommitParamsSchema>;
export type RolloutGetParams = z.infer<typeof RolloutGetParamsSchema>;
export type RolloutRollbackParams = z.infer<typeof RolloutRollbackParamsSchema>;
export type StoreRestoreParams = z.infer<typeof StoreRestoreParamsSchema>;
export type AgentScope = z.infer<typeof AgentScopeSchema>;
export type AgentRequest = z.infer<typeof AgentRequestSchema>;
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export function protocolError(
  id: string | number,
  code: string,
  message: string,
  details?: unknown,
): AgentResponse {
  return {
    protocol: AGENT_PROTOCOL,
    version: AGENT_PROTOCOL_VERSION,
    id,
    ok: false,
    error: { code, message, ...(details === undefined ? {} : { details }) },
  };
}

export function protocolOk(id: string | number, result: unknown): AgentResponse {
  return { protocol: AGENT_PROTOCOL, version: AGENT_PROTOCOL_VERSION, id, ok: true, result };
}

export const AgentProtocolJsonSchema = {
  protocol: AGENT_PROTOCOL,
  version: AGENT_PROTOCOL_VERSION,
  scopes: AgentScopeSchema.options,
  methods: [
    "health",
    "protocol.describe",
    "stores.list",
    "stores.get",
    "stores.restore",
    "templates.get",
    "templates.previewUpgrade",
    "templates.commitUpgrade",
    "rollouts.preview",
    "rollouts.commit",
    "rollouts.get",
    "rollouts.rollback",
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
} as const;

void IsoDateSchema;
