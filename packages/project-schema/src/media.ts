/**
 * Schemas de assets multimedia. Extraídos de index.ts como parte de la
 * división por dominio (2026-08-21). Dependen sólo de IDs branded.
 */
import { z } from "zod";
import { AssetIdSchema } from "./ids.js";

/**
 * Receta compartida por Studio, el agente y el sitio exportado. La variante
 * intermedia cubre tablet y mobile; la máxima queda para desktop.
 */
export const RESPONSIVE_IMAGE_WIDTHS = [768, 1800] as const;
export const RESPONSIVE_IMAGE_INTERMEDIATE_WIDTH = 768;
export const RESPONSIVE_IMAGE_MAX_WIDTH = 1800;

export interface ResponsiveImageSource {
  width: number;
  source: string;
}

export function responsiveImageWidths(
  sourceWidth: number,
  maxWidth = RESPONSIVE_IMAGE_MAX_WIDTH,
): number[] {
  const safeSourceWidth = Math.max(1, Math.floor(sourceWidth));
  const safeMaxWidth = Math.max(1, Math.min(Math.floor(maxWidth), RESPONSIVE_IMAGE_MAX_WIDTH));
  const width = Math.min(safeSourceWidth, safeMaxWidth);
  return [
    ...new Set([...RESPONSIVE_IMAGE_WIDTHS.filter((candidate) => candidate < width), width]),
  ].sort((left, right) => left - right);
}

/** Conserva sólo la mejor fuente disponible y el punto más cercano a 768px. */
export function compactResponsiveSources(
  sources: readonly ResponsiveImageSource[] | undefined,
  sourceWidth: number,
  primary?: ResponsiveImageSource,
): ResponsiveImageSource[] | undefined {
  if (sources === undefined) return undefined;
  if (sources.length === 0) return [];

  const byWidth = new Map<number, ResponsiveImageSource>();
  for (const source of sources) {
    if (
      Number.isInteger(source.width) &&
      source.width > 0 &&
      source.width <= sourceWidth &&
      source.source
    ) {
      byWidth.set(source.width, source);
    }
  }
  if (primary && Number.isInteger(primary.width) && primary.width > 0) {
    byWidth.set(primary.width, primary);
  }

  const candidates = [...byWidth.values()].sort((left, right) => left.width - right.width);
  if (candidates.length <= 1) return candidates;

  const high = candidates[candidates.length - 1];
  if (!high) return [];
  const lower = candidates.slice(0, -1);
  const intermediate = lower.reduce((best, candidate) => {
    const candidateDistance = Math.abs(candidate.width - RESPONSIVE_IMAGE_INTERMEDIATE_WIDTH);
    const bestDistance = Math.abs(best.width - RESPONSIVE_IMAGE_INTERMEDIATE_WIDTH);
    return candidateDistance < bestDistance ||
      (candidateDistance === bestDistance && candidate.width > best.width)
      ? candidate
      : best;
  });
  return [intermediate, high];
}

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
