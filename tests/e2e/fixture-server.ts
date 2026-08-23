import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Archivos servibles bajo /fixtures/ tras la migración webp (9a22a95):
 * solo los 12 productos quedan en disco; hero y galerías viajan embebidos
 * como data URLs dentro del HTML exportado.
 */
export const FIXTURE_PRODUCT_FILES = new Map<string, Uint8Array>(
  Array.from({ length: 12 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return [
      `fixtures/modo-sur-product-${number}.webp`,
      readFileSync(resolve("apps/studio/public/fixtures", `modo-sur-product-${number}.webp`)),
    ] as const;
  }),
);
