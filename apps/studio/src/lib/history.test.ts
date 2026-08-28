import { createHistory, redo, undo } from "@solara/core";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { describe, expect, it } from "vitest";
import { moveHistory, pushHistorySnapshot } from "./history";

describe("historial del Studio", () => {
  it("conserva el contenido de undo/redo y mantiene updatedAt monotónico", () => {
    const initial = structuredClone(catalogModernStore);
    const changed = structuredClone(initial);
    changed.updatedAt = "2026-08-28T10:00:00.000Z";
    const firstProduct = changed.products[0];
    if (!firstProduct) throw new Error("fixture sin producto");
    firstProduct.title = "Título editado";

    const history = pushHistorySnapshot(createHistory(initial), changed);
    const undone = moveHistory(history, undo);
    expect(undone.present.products[0]?.title).toBe(initial.products[0]?.title);
    expect(Date.parse(undone.present.updatedAt)).toBeGreaterThan(Date.parse(changed.updatedAt));

    const redone = moveHistory(undone, redo);
    expect(redone.present.products[0]?.title).toBe("Título editado");
    expect(Date.parse(redone.present.updatedAt)).toBeGreaterThan(
      Date.parse(undone.present.updatedAt),
    );
  });
});
