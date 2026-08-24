import { z } from "zod";

const CycleIdSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/);

export const QaRunExportParamsSchema = z.object({
  storeId: CycleIdSchema,
  mode: z.enum(["draft", "production"]).default("draft"),
});

export const QaRunGatesParamsSchema = z.object({
  suite: z.enum(["quick", "full", "affected"]).default("quick"),
  filter: z.string().max(200).optional(),
});

export const QaDetectFlakyParamsSchema = z.object({
  testFile: z.string().min(1).max(300),
  runs: z.number().int().min(2).max(20).default(5),
});

export const QaWriteTestParamsSchema = z.object({
  filePath: z.string().regex(/^packages\/[\w-]+\/src\/[\w-]+\.test\.(ts|mjs)$/),
  content: z.string().min(1).max(50_000),
});

export const QaReadBacklogParamsSchema = z.object({}).strict().default({});

export const QaLogProgressParamsSchema = z.object({
  entry: z.string().min(1).max(500),
});

export const QaUpdateStateParamsSchema = z.object({
  patch: z.record(z.string(), z.unknown()),
});

export const QaSuggestFixParamsSchema = z.object({
  cycleId: CycleIdSchema,
  testResult: z.object({
    file: z.string(),
    error: z.string().optional(),
    passed: z.boolean(),
  }),
});
