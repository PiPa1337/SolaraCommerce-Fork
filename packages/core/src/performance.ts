import { parseProject, type StoreProjectV1 } from "@solara/project-schema";
import { referenceStore } from "@solara/project-schema/fixture";

export function generatePerformanceFixture(productCount = 1_000): StoreProjectV1 {
  if (!Number.isInteger(productCount) || productCount < 0) {
    throw new Error("La cantidad de productos debe ser un entero no negativo.");
  }

  const timestamp = "2026-07-29T12:00:00.000Z";
  const products = Array.from({ length: productCount }, (_, index) => {
    const sequence = String(index + 1).padStart(4, "0");
    const productId = `performance-product-${sequence}`;
    const price = 100_000 + index * 137;
    return {
      id: productId,
      slug: `producto-prueba-${sequence}`,
      title: `Producto de prueba ${sequence}`,
      description: `Producto determinista para medir catálogos grandes, lote ${sequence}.`,
      status: index % 10 === 0 ? "hidden" : "active",
      brand: index % 2 === 0 ? "Tienda Referencia" : "Taller Nadir",
      categoryIds: [index % 2 === 0 ? "category-textiles" : "category-mesa"],
      collectionIds: ["collection-casa-serena"],
      tags: ["rendimiento", `grupo-${index % 10}`],
      imageIds: [index % 2 === 0 ? "asset-manta" : "asset-jarra"],
      variants: [
        {
          id: `${productId}-principal`,
          sku: `PERF-${sequence}-A`,
          title: "Principal",
          optionValues: { Acabado: "Principal" },
          price,
          available: true,
          stockStatus: "in_stock",
          imageId: index % 2 === 0 ? "asset-manta" : "asset-jarra",
        },
        {
          id: `${productId}-alternativa`,
          sku: `PERF-${sequence}-B`,
          title: "Alternativa",
          optionValues: { Acabado: "Alternativa" },
          price: price + 2_500,
          available: index % 7 !== 0,
          stockStatus: index % 7 === 0 ? "out_of_stock" : "in_stock",
          imageId: index % 2 === 0 ? "asset-manta" : "asset-jarra",
        },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });

  return parseProject({
    ...structuredClone(referenceStore),
    id: "store-performance",
    name: "Catálogo de rendimiento",
    slug: "catalogo-rendimiento",
    baseUrl: "https://performance.example",
    createdAt: timestamp,
    updatedAt: timestamp,
    products,
    categories: referenceStore.categories.map((category) => ({
      ...category,
      productIds: products
        .filter((product) => product.categoryIds.includes(category.id))
        .map((product) => product.id),
    })),
    collections: referenceStore.collections.map((collection) => ({
      ...collection,
      productIds: products.map((product) => product.id),
    })),
  });
}
