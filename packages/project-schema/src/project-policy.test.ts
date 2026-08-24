import { describe, expect, it } from "vitest";
import { buildCatalogModernProject } from "./catalog-modern-template";
import {
  BASE_TEMPLATE_STORE_ID,
  cloneProjectFromTemplate,
  getStorePolicy,
  isBaseTemplate,
} from "./project-policy";

describe("política de plantilla y clonación", () => {
  it("protege la base y permite una tienda duplicate", () => {
    const base = buildCatalogModernProject({
      seed: "placeholder",
      id: BASE_TEMPLATE_STORE_ID,
    });
    expect(isBaseTemplate(base)).toBe(true);

    const clone = cloneProjectFromTemplate(base, {
      id: "store-clone-policy",
      name: "Clon de prueba",
      slug: "clon-de-prueba",
      idFactory: (prefix, sourceId) => `${prefix}-clone-${sourceId}`,
      now: "2026-08-23T00:00:00.000Z",
    });

    expect(getStorePolicy(clone)).toMatchObject({
      role: "store",
      updatePolicy: "managed",
    });
    expect(clone.origin?.seed).toBe("duplicate");
    expect(clone.products).toHaveLength(base.products.length);
    expect(clone.categories).toHaveLength(base.categories.length);
    expect(clone.products[0]?.id).not.toBe(base.products[0]?.id);
    expect(clone.products[0]?.categoryIds[0]).not.toBe(base.products[0]?.categoryIds[0]);
    expect(clone.products[0]?.imageIds[0]).not.toBe(base.products[0]?.imageIds[0]);
    expect(clone.categories[0]?.productIds).toContain(clone.products[0]?.id);
  });

  it("mantiene protegidos los proyectos legacy y no bloquea clean", () => {
    expect(
      getStorePolicy({
        id: "legacy-demo",
        origin: { templateId: "catalog-modern", templateVersion: 1, seed: "demo" },
      }).role,
    ).toBe("base-template");
    expect(
      getStorePolicy({
        id: "new-clean",
        origin: { templateId: "catalog-modern", templateVersion: 1, seed: "clean" },
      }).role,
    ).toBe("store");
    expect(getStorePolicy({ id: "legacy-without-origin", origin: undefined }).role).toBe("store");
  });
});
