import { describe, expect, it } from "vitest";
import {
  canvasEntityAttributes,
  canvasEntityEditId,
  canvasImageAttributes,
  canvasTextAttributes,
} from "./index.js";

describe("canvas binding helpers", () => {
  it("emite atributos data-canvas sólo en modo editor", () => {
    const editor = { editorMode: true, sectionId: "sec-1" };
    const production = { editorMode: false, sectionId: "sec-1" };
    expect(canvasTextAttributes(editor, "title")).toBe(' data-canvas-edit="ce-sec-1-title"');
    expect(canvasTextAttributes(production, "title")).toBe("");
    expect(canvasImageAttributes(editor, "poster")).toBe(' data-canvas-image="ce-sec-1-poster"');
    expect(canvasImageAttributes(production, "poster")).toBe("");
  });

  it("incluye maxlength y escapa el itemId del repeater", async () => {
    const { canvasRepeaterAttributes } = await import("./index.js");
    const editor = { editorMode: true, sectionId: "sec-2" };
    expect(canvasTextAttributes(editor, "title", 120)).toBe(
      ' data-canvas-edit="ce-sec-2-title" data-canvas-maxlength="120"',
    );
    expect(canvasRepeaterAttributes(editor, "slides", 'item"><script>')).toBe(
      ' data-canvas-repeater="ce-sec-2-slides" data-canvas-item="item&quot;&gt;&lt;script&gt;"',
    );
  });

  it("genera IDs deterministas y sin rutas internas del proyecto", () => {
    const editor = { editorMode: true, sectionId: "modo-section-hero" };
    const id = canvasTextAttributes(editor, "title");
    expect(id).toBe(' data-canvas-edit="ce-modo-section-hero-title"');
    expect(id).not.toContain("/");
  });

  it("emite bindings de entidades con IDs estables y sin paths persistidos", () => {
    const editor = { editorMode: true, sectionId: "section-products" };
    const editId = canvasEntityEditId(
      editor.sectionId,
      "product-title",
      "product",
      "product-001",
      "title",
    );
    expect(editId).toBe("ce-section-products-product-title-product-product-001-title");
    expect(canvasEntityAttributes(editor, "product-title", "product", "product-001", "title")).toBe(
      ` data-canvas-edit="${editId}" data-canvas-entity-kind="product" data-canvas-entity-id="product-001" data-canvas-field="title"`,
    );
    expect(
      canvasEntityAttributes(
        editor,
        "product-image",
        "product",
        "product-001",
        "imageIds",
        "image",
      ),
    ).toContain(
      'data-canvas-image="ce-section-products-product-image-product-product-001-imageIds"',
    );
  });
});
