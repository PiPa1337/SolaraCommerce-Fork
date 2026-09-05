/**
 * Modelo puro del editor de producto (F5 — auditoría de controles 2026-08-10):
 * validación de slug/título/precios/opciones, duplicado de variantes y el
 * comportamiento documentado de SKU vacío/duplicado (SCH2 diferido).
 */
import { type Product, ProductSchema, type Variant, VariantSchema } from "@solara/project-schema";
import { describe, expect, it } from "vitest";
import {
  createBlankVariant,
  duplicateVariant,
  optionsText,
  PRODUCT_STATUS_OPTIONS,
  parseOptions,
  productActivationRequirements,
  slugErrorFor,
  slugify,
  validateProductVideos,
  VARIANT_STOCK_OPTIONS,
  validateDraft,
} from "./productEditorModel";

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "producto-test" as Product["id"],
    slug: "producto-test" as Product["slug"],
    title: "Producto de prueba",
    description: "",
    status: "active",
    brand: "",
    categoryIds: [],
    collectionIds: [],
    tags: [],
    imageIds: [],
    videoIds: [],
    variants: [
      {
        id: "variant-test" as Variant["id"],
        sku: "SKU-UNO",
        title: "Única",
        optionValues: {},
        price: 12500 as Variant["price"],
        available: true,
        stockStatus: "in_stock",
      },
    ],
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    ...overrides,
  };
}

function baseVariant(overrides: Partial<Variant> = {}): Variant {
  return {
    id: "variant-fuente" as Variant["id"],
    sku: "SKU-ORIGEN",
    title: "Negro / M",
    optionValues: { Color: "Negro", Talle: "M" },
    price: 2950000 as Variant["price"],
    compareAtPrice: 3600000 as Variant["price"],
    available: true,
    stockStatus: "in_stock",
    gtin: "7791234567890",
    mpn: "MPN-1",
    imageId: "asset-img" as Variant["imageId"],
    ...overrides,
  };
}

describe("slugify", () => {
  it("normaliza título a minúsculas con guiones y sin acentos", () => {
    expect(slugify("Remera H4AUDIT")).toBe("remera-h4audit");
    expect(slugify("Lámpara Horizonte")).toBe("lampara-horizonte");
    expect(slugify("  Título con  dobles espacios  ")).toBe("titulo-con-dobles-espacios");
  });

  it("devuelve vacío para entradas sin caracteres válidos", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("slugErrorFor", () => {
  it("reporta slug duplicado con el mensaje inline estable", () => {
    expect(slugErrorFor("remera-esencial-de-algodon", ["remera-esencial-de-algodon"])).toBe(
      "Ya existe otro producto con este slug.",
    );
  });

  it("acepta un slug único válido y rechaza formatos inválidos", () => {
    expect(slugErrorFor("remera-esencial-de-algodon", [])).toBeUndefined();
    expect(slugErrorFor("", [])).toContain("Escribí un slug");
    expect(slugErrorFor("Con Mayúscula", [])).toContain("Solo minúsculas");
    expect(slugErrorFor("a".repeat(121), [])).toContain("120 caracteres");
  });
});

describe("validateDraft", () => {
  it("marca el slug duplicado y el título vacío", () => {
    const errors = validateDraft(baseProduct({ title: "  " }), {}, ["producto-test"]);
    expect(errors.title).toContain("título");
    expect(errors.slugError).toBe("Ya existe otro producto con este slug.");
    expect(errors.slugAvailable).toBe(false);
  });

  it("marca slug único como disponible", () => {
    const errors = validateDraft(baseProduct(), {}, []);
    expect(errors.slugError).toBeUndefined();
    expect(errors.slugAvailable).toBe(true);
  });

  it("valida precio entero no negativo y opciones repetidas en variantes", () => {
    const errors = validateDraft(
      baseProduct({
        variants: [
          { ...baseVariant(), price: 12.5 as Variant["price"] },
          { ...baseVariant({ id: "variant-b" as Variant["id"], title: "  " }) },
        ],
      }),
      { "variant-b": "Color=Rojo, Color=Azul" },
      [],
    );
    expect(errors.variantErrors[0]?.price).toContain("entero en centavos");
    expect(errors.variantErrors[0]?.compareAtPrice).toBeUndefined();
    expect(errors.variantErrors[1]?.title).toContain("nombre para la variante");
    expect(errors.variantErrors[1]?.options).toContain("está repetida");
  });

  it("acepta SKU vacío y SKU duplicados sin feedback (SCH2 diferido)", () => {
    const errors = validateDraft(
      baseProduct({
        variants: [
          { ...baseVariant(), sku: "" },
          { ...baseVariant({ id: "variant-b" as Variant["id"], sku: "SKU-ORIGEN" }) },
        ],
      }),
      {},
      [],
    );
    expect(errors.variantErrors[0]).toEqual({
      title: undefined,
      price: undefined,
      compareAtPrice: undefined,
      options: undefined,
    });
    expect(errors.variantErrors[1]).toEqual({
      title: undefined,
      price: undefined,
      compareAtPrice: undefined,
      options: undefined,
    });
  });

  it("valida el precio anterior sin cambiar la regla del precio actual", () => {
    const errors = validateDraft(
      baseProduct({
        variants: [{ ...baseVariant(), compareAtPrice: 12.5 as Variant["price"] }],
      }),
      {},
      [],
    );
    expect(errors.variantErrors[0]?.compareAtPrice).toContain("precio anterior");

    const valid = validateDraft(
      baseProduct({
        variants: [{ ...baseVariant(), compareAtPrice: undefined }],
      }),
      {},
      [],
    );
    expect(valid.variantErrors[0]?.compareAtPrice).toBeUndefined();
  });
});

describe("productActivationRequirements", () => {
  it("exige contenido público mínimo antes de activar", () => {
    expect(productActivationRequirements(baseProduct())).toEqual([
      "una descripción",
      "al menos una imagen",
    ]);
    expect(
      productActivationRequirements(
        baseProduct({
          description: "Descripción",
          imageIds: ["asset-test" as Product["imageIds"][number]],
        }),
      ),
    ).toEqual([]);
  });

  it("detecta variantes sin precio positivo", () => {
    expect(
      productActivationRequirements(
        baseProduct({
          description: "Descripción",
          imageIds: ["asset-test" as Product["imageIds"][number]],
          variants: [{ ...baseProduct().variants[0], price: 0 as Variant["price"] }],
        }),
      ),
    ).toEqual(["un precio mayor a cero"]);
  });
});

describe("duplicateVariant", () => {
  it("conserva SKU, precios, opciones, stock y códigos; sólo cambia id y título", () => {
    const source = baseVariant();
    const copy = duplicateVariant(source);

    expect(copy.id).not.toBe(source.id);
    expect(copy.id).toMatch(/^variant-/);
    expect(copy.title).toBe("Negro / M copia");
    expect(copy.sku).toBe("SKU-ORIGEN");
    expect(copy.price).toBe(2950000);
    expect(copy.compareAtPrice).toBe(3600000);
    expect(copy.optionValues).toEqual({ Color: "Negro", Talle: "M" });
    expect(copy.available).toBe(true);
    expect(copy.stockStatus).toBe("in_stock");
    expect(copy.gtin).toBe("7791234567890");
    expect(copy.mpn).toBe("MPN-1");
    expect(copy.imageId).toBe("asset-img");
  });
});

describe("createBlankVariant", () => {
  it("crea una variante nueva en blanco vendible", () => {
    const blank = createBlankVariant();
    expect(blank.id).toMatch(/^variant-/);
    expect(blank.sku).toBe("");
    expect(blank.title).toBe("Nueva variante");
    expect(blank.optionValues).toEqual({});
    expect(blank.price).toBe(0);
    expect(blank.available).toBe(true);
    expect(blank.stockStatus).toBe("in_stock");
  });
});

describe("parseOptions / optionsText", () => {
  it("redondea texto y opciones sin pérdida", () => {
    const text = optionsText({ Color: "Azul", Talle: "M" });
    expect(text).toBe("Color=Azul, Talle=M");
    expect(parseOptions(text)).toEqual({ Color: "Azul", Talle: "M" });
  });

  it("rechaza formato incompleto y nombres repetidos", () => {
    expect(() => parseOptions("Color=Azul, Color=Rojo")).toThrow("está repetida");
    expect(() => parseOptions("Color=")).toThrow("formato Nombre=Valor");
    expect(() => parseOptions("=Azul")).toThrow("formato Nombre=Valor");
  });
});

describe("contrato con el schema del editor (T9)", () => {
  it("expone exactamente los estados y stocks que valida el schema", () => {
    expect(PRODUCT_STATUS_OPTIONS).toEqual(ProductSchema.shape.status.options);
    expect(VARIANT_STOCK_OPTIONS).toEqual(VariantSchema.shape.stockStatus.options);
  });

  it("el payload de guardado conserva los ids del draft y los campos del schema", () => {    const draft = baseProduct({ brand: "  Marca con espacios  " });
    const parsed = ProductSchema.parse({
      ...draft,
      slug: draft.slug.trim(),
      title: draft.title.trim(),
      brand: draft.brand.trim(),
      tags: [...new Set(["destacado", "destacado", "nuevo"])],
      variants: draft.variants.map((variant) => ({
        ...variant,
        title: variant.title.trim(),
        sku: variant.sku.trim(),
        optionValues: parseOptions(optionsText(variant.optionValues)),
        gtin: variant.gtin?.trim() || undefined,
        mpn: variant.mpn?.trim() || undefined,
      })),
    });
    expect(parsed.id).toBe(draft.id);
    expect(parsed.brand).toBe("Marca con espacios");
    expect(parsed.tags).toEqual(["destacado", "nuevo"]);
    expect(parsed.variants.map((variant) => variant.id)).toEqual(
      draft.variants.map((variant) => variant.id),
    );
  });
});

describe("validateProductVideos", () => {
  it("rechaza más de 3 videos", () => {
    expect(validateProductVideos(["a", "b", "c", "d"])).toMatch(/máximo 3/i);
    expect(validateProductVideos(["a", "b"])).toBeUndefined();
    expect(validateProductVideos(undefined)).toBeUndefined();
  });
});
