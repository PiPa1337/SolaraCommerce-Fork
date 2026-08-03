import { referenceStore } from "./fixture";
import { StoreProjectV2Schema } from "./index";

const fixedDate = "2026-07-29T12:00:00.000Z";

const roots = [
  {
    id: "category-casa",
    slug: "casa",
    title: "Casa",
    description: "Objetos para habitar con calma.",
  },
  {
    id: "category-cocina",
    slug: "cocina",
    title: "Cocina",
    description: "Piezas para preparar y compartir.",
  },
  {
    id: "category-bano",
    slug: "bano",
    title: "Baño",
    description: "Texturas para empezar y terminar el día.",
  },
  {
    id: "category-dormitorio",
    slug: "dormitorio",
    title: "Dormitorio",
    description: "Capas suaves para descansar.",
  },
  {
    id: "category-exterior",
    slug: "exterior",
    title: "Exterior",
    description: "Objetos para estar afuera.",
  },
  {
    id: "category-oficina",
    slug: "oficina",
    title: "Oficina",
    description: "Herramientas para trabajar mejor.",
  },
  {
    id: "category-regalos",
    slug: "regalos",
    title: "Regalos",
    description: "Detalles elegidos para compartir.",
  },
  {
    id: "category-aromas",
    slug: "aromas",
    title: "Aromas",
    description: "Rituales sencillos para todos los días.",
  },
  {
    id: "category-organizacion",
    slug: "organizacion",
    title: "Organización",
    description: "Orden útil para la vida diaria.",
  },
  {
    id: "category-novedades",
    slug: "novedades",
    title: "Novedades",
    description: "Lo nuevo de Casa Luma.",
  },
] as const;

const childGroups = {
  "category-casa": [
    {
      id: "category-textiles",
      slug: "textiles",
      title: "Textiles",
      description: "Capas suaves para el uso diario.",
    },
    {
      id: "category-decoracion",
      slug: "decoracion",
      title: "Decoración",
      description: "Piezas que le dan carácter a cada ambiente.",
    },
    {
      id: "category-iluminacion",
      slug: "iluminacion",
      title: "Iluminación",
      description: "Luz cálida para bajar el ritmo.",
    },
  ],
  "category-cocina": [
    {
      id: "category-ceramica",
      slug: "ceramica",
      title: "Cerámica",
      description: "Piezas hechas para usar y volver a elegir.",
    },
    {
      id: "category-mesa",
      slug: "mesa",
      title: "Mesa",
      description: "Objetos útiles para compartir.",
    },
    {
      id: "category-accesorios",
      slug: "accesorios",
      title: "Accesorios",
      description: "Pequeños detalles para cocinar mejor.",
    },
  ],
} as const;

const imageIds = ["asset-manta", "asset-jarra", "asset-hero"] as const;

function categoryIdsForRoot(rootId: string, localIndex: number): string[] {
  const children = childGroups[rootId as keyof typeof childGroups];
  if (!children) return [rootId];
  return [children[localIndex % children.length]?.id ?? children[0].id];
}

function categoryScopeIds(
  categories: readonly { id: string; parentId?: string }[],
  id: string,
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  categories.forEach((category) => {
    if (!category.parentId) return;
    childrenByParent.set(category.parentId, [
      ...(childrenByParent.get(category.parentId) ?? []),
      category.id,
    ]);
  });
  const scope = new Set<string>([id]);
  const visit = (parentId: string): void => {
    (childrenByParent.get(parentId) ?? []).forEach((childId) => {
      scope.add(childId);
      visit(childId);
    });
  };
  visit(id);
  return scope;
}

const categories = [
  ...roots.map((root) => ({ ...root, imageId: "asset-hero", productIds: [] as string[] })),
  ...Object.entries(childGroups).flatMap(([parentId, children]) =>
    children.map((child) => ({
      ...child,
      parentId,
      imageId: "asset-manta",
      productIds: [] as string[],
    })),
  ),
];

const products = roots.flatMap((root, rootIndex) =>
  Array.from({ length: 5 }, (_, localIndex) => {
    const productNumber = rootIndex * 5 + localIndex + 1;
    const productId = `scale-product-${String(productNumber).padStart(2, "0")}`;
    const imageId = imageIds[(productNumber - 1) % imageIds.length];
    const primaryCategoryIds = categoryIdsForRoot(root.id, localIndex);
    const categoryIds =
      root.id === "category-novedades" || productNumber > 30
        ? primaryCategoryIds
        : [...primaryCategoryIds, "category-novedades"];
    const hasSecondVariant = productNumber % 5 === 0;
    const basePrice = 1200000 + productNumber * 25000;
    const variants = [
      {
        id: `scale-variant-${String(productNumber).padStart(2, "0")}-a`,
        sku: `CL-SCL-${String(productNumber).padStart(3, "0")}-A`,
        title: "Natural",
        optionValues: { Color: "Natural" },
        price: basePrice,
        compareAtPrice: productNumber % 4 === 0 ? basePrice + 150000 : undefined,
        available: true,
        stockStatus: "in_stock" as const,
        mpn: `CL-${String(productNumber).padStart(4, "0")}`,
        imageId,
      },
      ...(hasSecondVariant
        ? [
            {
              id: `scale-variant-${String(productNumber).padStart(2, "0")}-b`,
              sku: `CL-SCL-${String(productNumber).padStart(3, "0")}-B`,
              title: "Musgo",
              optionValues: { Color: "Musgo" },
              price: basePrice + 50000,
              available: productNumber % 10 !== 0,
              stockStatus: (productNumber % 10 === 0 ? "out_of_stock" : "in_stock") as
                | "in_stock"
                | "out_of_stock",
              mpn: `CL-${String(productNumber).padStart(4, "0")}-B`,
              imageId,
            },
          ]
        : []),
    ];

    return {
      id: productId,
      slug: `pieza-escala-${String(productNumber).padStart(2, "0")}`,
      title: `Pieza de escala ${String(productNumber).padStart(2, "0")}`,
      description: `Producto de prueba ${productNumber} para validar navegación, búsqueda y grillas de catálogo.`,
      status: "active" as const,
      brand: productNumber % 2 === 0 ? "Casa Luma" : "Taller Nadir",
      categoryIds,
      collectionIds: ["collection-casa-serena"],
      tags: ["escala", productNumber % 2 === 0 ? "casa" : "uso-diario"],
      imageIds: [imageId],
      variants,
      createdAt: fixedDate,
      updatedAt: fixedDate,
    };
  }),
);

const categoryProductIds = (categoryId: string): string[] => {
  const scope = categoryScopeIds(categories, categoryId);
  return products
    .filter((product) => product.categoryIds.some((id) => scope.has(id)))
    .map((product) => product.id);
};

const finalizedCategories = categories.map((category) => ({
  ...category,
  productIds: categoryProductIds(category.id),
}));

const navigationItems = roots.map((root) => ({
  id: `nav-${root.id.replace("category-", "")}`,
  label: root.title,
  href: `/categorias/${root.slug}/`,
  ...(childGroups[root.id as keyof typeof childGroups]
    ? {
        children: childGroups[root.id as keyof typeof childGroups].map((child) => ({
          id: `nav-${child.id.replace("category-", "")}`,
          label: child.title,
          href: `/categorias/${child.slug}/`,
        })),
      }
    : {}),
}));

export const catalogScaleStore = StoreProjectV2Schema.parse({
  ...structuredClone(referenceStore),
  id: "store-casa-luma-scale",
  name: "Casa Luma Escala",
  slug: "casa-luma-escala",
  baseUrl: "https://casa-luma-scale.example",
  updatedAt: fixedDate,
  identity: {
    ...referenceStore.identity,
    brandName: "Casa Luma Escala",
    legalName: "Casa Luma Escala SRL",
  },
  navigation: {
    ...referenceStore.navigation,
    catalogLabel: "Categorías",
    items: navigationItems,
  },
  products,
  categories: finalizedCategories,
  collections: referenceStore.collections.map((collection) => ({
    ...collection,
    productIds: products.map((product) => product.id),
  })),
});
