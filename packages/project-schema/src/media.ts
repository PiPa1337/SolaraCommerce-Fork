/**
 * Schemas de assets multimedia. Extraídos de index.ts como parte de la
 * división por dominio (2026-08-21). Dependen sólo de IDs branded.
 */
import { z } from "zod";
import { AssetIdSchema } from "./ids.js";

export const ImageAssetSchema = z.object({
  kind: z.literal("image").default("image"),
  id: AssetIdSchema,
  name: z.string().min(1),
  alt: z.string(),
  mimeType: z.string().min(1),
  source: z.string().min(1),
  fallbackSource: z.string().min(1).optional(),
  responsiveSources: z
    .array(
      z.object({
        width: z.number().int().positive(),
        source: z.string().min(1),
      }),
    )
    .optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  hash: z.string().min(1),
});

export const VideoAssetSchema = z.object({
  kind: z.literal("video"),
  id: AssetIdSchema,
  name: z.string().min(1),
  alt: z.string().default(""),
  mimeType: z.enum(["video/mp4", "video/webm"]),
  source: z.string().min(1),
  posterAssetId: AssetIdSchema.optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  durationSeconds: z.number().positive().max(60),
  hash: z.string().min(1),
});

export const MediaAssetSchema = z.union([ImageAssetSchema, VideoAssetSchema]);
