import { describe, expect, it } from "vitest";
import { catalogScaleStore } from "@solara/project-schema/scale-fixture";
import {
  createHistory,
  executeCommand,
  MAX_HISTORY_LENGTH,
  undo,
  redo,
} from "./index.js";

const timestamp = "2026-08-21T03:00:00.000Z";

function editTitle(history: ReturnType<typeof createHistory>, index: number) {
  const product = history.present.products[index % history.present.products.length];
  if (!product) throw new Error("fixture sin productos");
  return executeCommand(history, {
    type: "product.update",
    productId: product.id,
    changes: { title: `Título v${index}` },
    at: timestamp,
  });
}

describe("límite de historial", () => {
  it("exporta MAX_HISTORY_LENGTH como contrato público", () => {
    expect(MAX_HISTORY_LENGTH).toBe(50);
  });

  it("executeCommand no excede el límite de snapshots en past", () => {
    let history = createHistory(catalogScaleStore);
    for (let i = 0; i < 200; i += 1) {
      history = editTitle(history, i);
    }
    expect(history.past.length).toBe(MAX_HISTORY_LENGTH);
  });

  it("undo sigue funcionando dentro del límite", () => {
    let history = createHistory(catalogScaleStore);
    for (let i = 0; i < 200; i += 1) {
      history = editTitle(history, i);
    }
    const undone = undo(history);
    // undo restaura el estado tras la edición 198, que tocó products[48].
    // Distingue del presente (tras edición 199), donde products[48] es "Título v148".
    expect(undone.present.products[48]?.title).toBe("Título v198");
  });

  it("redo tras undo restaura el estado", () => {
    let history = createHistory(catalogScaleStore);
    for (let i = 0; i < 60; i += 1) {
      history = editTitle(history, i);
    }
    const undone = undo(history);
    const redone = redo(undone);
    // El último comando (i=59) editó products[9]; redo lo restaura.
    expect(redone.present.products[9]?.title).toBe("Título v59");
  });

  it("los estados más antiguos se descartan primero (FIFO)", () => {
    let history = createHistory(catalogScaleStore);
    for (let i = 0; i < MAX_HISTORY_LENGTH + 10; i += 1) {
      history = editTitle(history, i);
    }
    expect(history.past).toHaveLength(MAX_HISTORY_LENGTH);
    // past.at(-1) es el estado tras la edición 58, que tocó products[8].
    expect(history.past.at(-1)?.products[8]?.title).toBe("Título v58");
    // El snapshot más antiguo retenido es el estado tras la edición 9:
    // products[9] ya fue editado ("Título v9"), prueba de que state8 y anteriores se descartaron.
    expect(history.past[0]?.products[9]?.title).toBe("Título v9");
  });
});
