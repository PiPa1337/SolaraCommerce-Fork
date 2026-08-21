import { describe, expect, it } from "vitest";
import { catalogModernStore } from "./catalog-modern-fixture";
import { referenceStore } from "./fixture";
import { type StoreProjectV2, StoreProjectV2Schema } from "./index";

function clone(): StoreProjectV2 {
  return structuredClone(referenceStore);
}
function cloneModern(): StoreProjectV2 {
  return structuredClone(catalogModernStore as unknown as StoreProjectV2);
}

describe("mutation-killers: schema", () => {
  it("rechaza ciclo de categorias A->B->A", () => {
    const p = cloneModern();
    const a = p.categories.find((c) => !c.parentId)!;
    // self-cycle evita el límite de profundidad y fuerza detección de ciclo
    (a as any).parentId = a.id;
    expect(() => StoreProjectV2Schema.parse(p)).toThrow(/ciclo/i);
  });
  it("rechaza jerarquia con 3 niveles (solo 1 nivel permitido)", () => {
    const p = cloneModern();
    const root = p.categories.find((c) => !c.parentId)!;
    const child = p.categories.find((c) => c.parentId === root.id)!;
    const grandchild: any = structuredClone(child);
    grandchild.id = "category-grandchild-mut";
    grandchild.slug = "grandchild-mut";
    grandchild.parentId = child.id;
    grandchild.productIds = [];
    p.categories.push(grandchild);
    expect(() => StoreProjectV2Schema.parse(p)).toThrow(/nivel/i);
  });
  it("rechaza productIds que no coinciden con asignaciones", () => {
    const p = clone();
    const cat = p.categories[0]!;
    cat.productIds = [];
    expect(() => StoreProjectV2Schema.parse(p)).toThrow(/no coincide/i);
  });
  it("valida productIds incluye productos de subcategorias", () => {
    const p = cloneModern();
    const root = p.categories.find((c) => !c.parentId)!;
    const child = p.categories.find((c) => c.parentId === root.id);
    if (!child) throw new Error("sin subcategoria");
    const prod = p.products.find((pr) => pr.categoryIds.includes(child.id));
    if (!prod) throw new Error("sin producto en child");
    root.productIds = root.productIds.filter((id) => id !== prod.id);
    expect(() => StoreProjectV2Schema.parse(p)).toThrow(/no coincide/i);
  });
  it("rechaza dinero fraccionario en price", () => {
    const p = clone();
    (p.products[0]?.variants[0] as any).price = 1999.99;
    expect(() => StoreProjectV2Schema.parse(p)).toThrow();
  });
  it("rechaza slug reservado CON", () => {
    const p = clone();
    p.categories[0]!.slug = "con" as any;
    expect(() => StoreProjectV2Schema.parse(p)).toThrow(/reservado/i);
  });
  it("rechaza IDs de variante duplicados", () => {
    const p = clone();
    const v0 = p.products[0]?.variants[0]!;
    const v1 = p.products[1]?.variants[0]!;
    v1.id = v0.id as any;
    expect(() => StoreProjectV2Schema.parse(p)).toThrow(/variante/i);
  });
  it("rechaza navegacion a destino interno inexistente", () => {
    const p = clone();
    p.navigation.items[0]!.href = "/categorias/no-existe-xyz/";
    expect(() => StoreProjectV2Schema.parse(p)).toThrow(/destino/i);
  });
});
