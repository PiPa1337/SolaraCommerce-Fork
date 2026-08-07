import { describe, expect, it } from "vitest";
import { catalogModernStore } from "./catalog-modern-fixture";
import { referenceStore } from "./fixture";
import { catalogScaleStore } from "./scale-fixture";

function serializedBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

describe("presupuesto de fixtures locales", () => {
  it("mide la fixture visual demo y fija un techo de 8 MiB", () => {
    const bytes = serializedBytes(catalogModernStore);
    console.info(`catalogModernStore: ${(bytes / 1024).toFixed(1)} KiB`);
    expect(bytes).toBeLessThan(8 * 1024 * 1024);
  });

  it("mide la fixture de escala y fija un techo de 8 MiB", () => {
    const bytes = serializedBytes(catalogScaleStore);
    console.info(`catalogScaleStore: ${(bytes / 1024).toFixed(1)} KiB`);
    expect(bytes).toBeLessThan(8 * 1024 * 1024);
  });

  it("mide la fixture pequeña de referencia y fija un techo de 1 MiB", () => {
    const bytes = serializedBytes(referenceStore);
    console.info(`referenceStore: ${(bytes / 1024).toFixed(1)} KiB`);
    expect(bytes).toBeLessThan(1024 * 1024);
  });
});
