/**
 * Contrato persistido de una tienda. Zod es la autoridad para IDs, referencias,
 * jerarquía, assets, páginas y schemaVersion; exporter, core y Studio importan
 * estos tipos para evitar modelos paralelos.
 */
import { z } from "zod";

const brandedId = <Brand extends string>(_brand: Brand) => z.string().min(1).brand<Brand>();

export const StoreIdSchema = brandedId("StoreId");
export const ProductIdSchema = brandedId("ProductId");
export const VariantIdSchema = brandedId("VariantId");
export const CategoryIdSchema = brandedId("CategoryId");
export const CollectionIdSchema = brandedId("CollectionId");
export const SectionIdSchema = brandedId("SectionId");
export const AssetIdSchema = brandedId("AssetId");
export const MoneySchema = z.number().int().nonnegative().brand<"Money">();
const WINDOWS_RESERVED_SLUGS = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
]);

export const SlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((value) => !WINDOWS_RESERVED_SLUGS.has(value.toLowerCase()), {
    message:
      "El slug usa un nombre reservado del sistema (Windows). Elegí otro nombre para la ruta.",
  })
  .brand<"Slug">();

export type StoreId = z.infer<typeof StoreIdSchema>;
export type ProductId = z.infer<typeof ProductIdSchema>;
export type VariantId = z.infer<typeof VariantIdSchema>;
export type CategoryId = z.infer<typeof CategoryIdSchema>;
export type CollectionId = z.infer<typeof CollectionIdSchema>;
export type SectionId = z.infer<typeof SectionIdSchema>;
export type AssetId = z.infer<typeof AssetIdSchema>;
export type Money = z.infer<typeof MoneySchema>;
export type Slug = z.infer<typeof SlugSchema>;

export const ImageAssetSchema = z.object({
  kind: z.literal("image").default("image"),
  id: AssetIdSchema,
  name: z.string().min(1),
  alt: z.string(),
  mimeType: z.string().min(1),
  source: z.string().min(1),
  fallbackSource: z.string().min(1).optional(),
  responsiveSources: z
    .array(
      z.object({
        width: z.number().int().positive(),
        source: z.string().min(1),
      }),
    )
    .optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  hash: z.string().min(1),
});

export const VideoAssetSchema = z.object({
  kind: z.literal("video"),
  id: AssetIdSchema,
  name: z.string().min(1),
  alt: z.string().default(""),
  mimeType: z.enum(["video/mp4", "video/webm"]),
  source: z.string().min(1),
  posterAssetId: AssetIdSchema.optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  durationSeconds: z.number().positive().max(60),
  hash: z.string().min(1),
});

export const MediaAssetSchema = z.union([ImageAssetSchema, VideoAssetSchema]);

export const NavigationItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  href: z.string().optional(),
  children: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1).max(80),
        href: z.string().optional(),
      }),
    )
    .max(12)
    .optional(),
});

export const NavigationConfigSchema = z.object({
  catalogLabel: z.string().min(1).max(40).default("Colecciones"),
  items: z.array(NavigationItemSchema).max(20).default([]),
  mode: z.enum(["automatic", "curated"]).default("curated"),
  showHome: z.boolean().default(true),
  showContact: z.boolean().default(true),
  showAbout: z.boolean().default(true),
  showSearch: z.boolean().default(true),
  showCart: z.boolean().default(true),
});

export const EditablePageSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["home", "about", "contact"]),
  slug: SlugSchema,
  title: z.string().min(1),
  seoTitle: z.string().min(1).max(70),
  seoDescription: z.string().min(1).max(180),
  sections: z.array(z.lazy(() => StoreSectionSchema)).default([]),
});

export const CommerceTemplatesSchema = z.object({
  designFamily: z
    .enum(["legacy-editorial-v1", "catalog-modern-v1", "catalog-modern-v2"])
    .optional(),
  category: z
    .object({ productsPerPage: z.number().int().min(1).max(48).default(24) })
    .default({ productsPerPage: 24 }),
  search: z.object({ enabled: z.boolean().default(true) }).default({ enabled: true }),
  product: z.object({ showRelated: z.boolean().default(true) }).default({ showRelated: true }),
  cart: z.object({ enabled: z.boolean().default(true) }).default({ enabled: true }),
  checkout: z.object({ enabled: z.boolean().default(true) }).default({ enabled: true }),
});

export const SiteShellSchema = z.object({
  announcement: z.boolean().default(true),
  header: z.boolean().default(true),
  footer: z.boolean().default(true),
  cart: z.boolean().default(true),
});

export const ProjectOriginSchema = z
  .object({
    templateId: z.literal("catalog-modern"),
    templateVersion: z.number().int().positive(),
    seed: z.enum(["clean", "demo", "duplicate"]),
  })
  .optional();

export const VariantSchema = z.object({
  id: VariantIdSchema,
  sku: z.string(),
  title: z.string().min(1),
  optionValues: z.record(z.string(), z.string()),
  price: MoneySchema,
  compareAtPrice: MoneySchema.optional(),
  available: z.boolean(),
  stockStatus: z.enum(["in_stock", "out_of_stock", "preorder"]),
  gtin: z.string().optional(),
  mpn: z.string().optional(),
  availabilityDate: z.string().datetime().optional(),
  imageId: AssetIdSchema.optional(),
});

export const ProductReviewSchema = z.object({
  id: z.string().min(1),
  authorName: z.string().min(1).max(120),
  title: z.string().max(160).optional(),
  body: z.string().min(1).max(1000),
  rating: z.number().int().min(1).max(5),
  publishedAt: z.string().datetime(),
  verifiedPurchase: z.boolean(),
  origin: z.enum(["example", "merchant"]),
  visible: z.boolean(),
});

export const ProductSchema = z.object({
  id: ProductIdSchema,
  slug: SlugSchema,
  title: z.string().min(1),
  description: z.string(),
  richDescription: z.string().optional(),
  status: z.enum(["active", "hidden", "archived"]),
  brand: z.string(),
  categoryIds: z.array(CategoryIdSchema),
  collectionIds: z.array(CollectionIdSchema),
  tags: z.array(z.string()),
  imageIds: z.array(AssetIdSchema),
  variants: z.array(VariantSchema).min(1),
  reviews: z.array(ProductReviewSchema).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CategorySchema = z.object({
  id: CategoryIdSchema,
  slug: SlugSchema,
  title: z.string().min(1),
  description: z.string(),
  imageId: AssetIdSchema.optional(),
  parentId: CategoryIdSchema.optional(),
  productIds: z.array(ProductIdSchema),
});

export const CollectionSchema = z.object({
  id: CollectionIdSchema,
  slug: SlugSchema,
  title: z.string().min(1),
  description: z.string(),
  imageId: AssetIdSchema.optional(),
  productIds: z.array(ProductIdSchema),
});

export const MotionPresetSchema = z.enum([
  "none",
  "fade",
  "fade-up",
  "slide",
  "scale",
  "stagger",
  "parallax",
  "scroll-progress",
  "layer-stack",
]);

export const MotionSettingsSchema = z.object({
  preset: MotionPresetSchema,
  intensity: z.number().min(0).max(10),
  direction: z.enum(["up", "down", "left", "right"]),
  distance: z.number().min(0).max(160),
  duration: z.number().min(0).max(5),
  delay: z.number().min(0).max(5),
  stagger: z.number().min(0).max(2),
  easing: z.string().min(1),
  entryPoint: z.number().min(0).max(1),
  once: z.boolean(),
});

export const StoreSectionSchema = z.object({
  id: SectionIdSchema,
  slot: z.enum([
    "announcement",
    "header",
    "hero",
    "catalog",
    "product",
    "content",
    "trust",
    "cart",
    "footer",
  ]),
  moduleId: z.string().min(1),
  enabled: z.boolean(),
  settings: z.record(z.string(), z.unknown()),
  motion: MotionSettingsSchema,
});

export const ThemeSchema = z.object({
  colorMode: z.enum(["auto", "light", "dark"]),
  colors: z.object({
    background: z.string(),
    surface: z.string(),
    text: z.string(),
    muted: z.string(),
    accent: z.string(),
    accentText: z.string(),
    border: z.string(),
  }),
  typography: z.object({
    display: z.string(),
    body: z.string(),
    scale: z.number().min(0.8).max(1.4),
  }),
  spacingScale: z.number().min(0.75).max(1.5),
  radius: z.number().min(0).max(40),
  container: z.number().int().min(960).max(1800),
});

export const CommercePolicySchema = z.object({
  summary: z.string(),
  details: z.string(),
  countries: z.array(z.string().length(2)),
  handlingDaysMin: z.number().int().nonnegative(),
  handlingDaysMax: z.number().int().nonnegative(),
  transitDaysMin: z.number().int().nonnegative(),
  transitDaysMax: z.number().int().nonnegative(),
  returnDays: z.number().int().nonnegative(),
});

const StoreProjectV2ShapeSchema = z.object({
  schemaVersion: z.literal(2),
  id: StoreIdSchema,
  name: z.string().min(1),
  slug: SlugSchema,
  status: z.enum(["active", "archived"]),
  locale: z.literal("es-AR"),
  currency: z.literal("ARS"),
  baseUrl: z.string().url(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  origin: ProjectOriginSchema,
  identity: z.object({
    legalName: z.string().min(1),
    brandName: z.string().min(1),
    description: z.string(),
    logoAssetId: AssetIdSchema.optional(),
    email: z.string().email().or(z.literal("")),
    phone: z.string(),
    address: z.string(),
  }),
  whatsapp: z.object({
    phone: z.string().regex(/^\d{8,15}$/),
    greeting: z.string(),
    includeSku: z.boolean(),
  }),
  seo: z.object({
    title: z.string().min(1).max(70),
    description: z.string().min(1).max(180),
    searchConsoleVerification: z.string(),
    merchantVerification: z.string(),
    socialImageId: AssetIdSchema.optional(),
  }),
  theme: ThemeSchema,
  navigation: NavigationConfigSchema.default({
    catalogLabel: "Colecciones",
    items: [],
    mode: "curated",
    showHome: true,
    showContact: true,
    showAbout: true,
    showSearch: true,
    showCart: true,
  }),
  siteShell: SiteShellSchema.default({
    announcement: true,
    header: true,
    footer: true,
    cart: true,
  }),
  pages: z.array(EditablePageSchema).default([]),
  commerceTemplates: CommerceTemplatesSchema.default({
    category: { productsPerPage: 24 },
    search: { enabled: true },
    product: { showRelated: true },
    cart: { enabled: true },
    checkout: { enabled: true },
  }),
  policies: z.object({
    shipping: CommercePolicySchema,
    returns: CommercePolicySchema,
    privacy: z.string(),
    terms: z.string(),
  }),
  products: z.array(ProductSchema),
  categories: z.array(CategorySchema),
  collections: z.array(CollectionSchema),
  assets: z.array(ImageAssetSchema),
  videos: z.array(VideoAssetSchema).default([]),
  sections: z.array(StoreSectionSchema),
});

function addDuplicateIssues(
  values: readonly string[],
  path: Array<string | number>,
  label: string,
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      context.addIssue({
        code: "custom",
        message: `${label} duplicado: ${value}.`,
        path: [...path, index],
      });
    }
    seen.add(value);
  });
}

function addMissingReferenceIssue(
  exists: boolean,
  path: Array<string | number>,
  label: string,
  value: string,
  context: z.RefinementCtx,
): void {
  if (exists) return;
  context.addIssue({
    code: "custom",
    message: `${label} inexistente: ${value}.`,
    path,
  });
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightMembers = new Set(right);
  return left.every((value) => rightMembers.has(value));
}

interface CategoryRelation {
  id: string;
  parentId?: string | undefined;
}

function categoryRelationsById(
  categories: readonly CategoryRelation[],
): Map<string, CategoryRelation> {
  return new Map(categories.map((category) => [category.id, category]));
}

function categoryDescendantIds(
  categories: readonly CategoryRelation[],
  categoryId: string,
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const children = childrenByParent.get(category.parentId) ?? [];
    children.push(category.id);
    childrenByParent.set(category.parentId, children);
  }

  const descendants: string[] = [];
  const visited = new Set<string>([categoryId]);
  const visit = (parentId: string): void => {
    for (const childId of childrenByParent.get(parentId) ?? []) {
      if (visited.has(childId)) continue;
      visited.add(childId);
      descendants.push(childId);
      visit(childId);
    }
  };
  visit(categoryId);
  return descendants;
}

function categoryAncestorIds(
  categories: readonly CategoryRelation[],
  categoryId: string,
): string[] {
  const byId = categoryRelationsById(categories);
  const ancestors: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(categoryId)?.parentId;
  while (current) {
    if (seen.has(current)) break;
    seen.add(current);
    ancestors.unshift(current);
    current = byId.get(current)?.parentId;
  }
  return ancestors;
}

function categoryScopeIds(
  categories: readonly CategoryRelation[],
  categoryId: string,
): Set<string> {
  return new Set([categoryId, ...categoryDescendantIds(categories, categoryId)]);
}

function categoryProductIds(
  categories: readonly CategoryRelation[],
  products: readonly { id: string; categoryIds: readonly string[] }[],
  categoryId: string,
): string[] {
  const scope = categoryScopeIds(categories, categoryId);
  return products
    .filter((product) => product.categoryIds.some((id) => scope.has(id)))
    .map((product) => product.id);
}

export const StoreProjectV2Schema = StoreProjectV2ShapeSchema.superRefine((project, context) => {
  addDuplicateIssues(
    project.products.map((product) => product.id),
    ["products"],
    "ID de producto",
    context,
  );
  addDuplicateIssues(
    project.products.map((product) => product.slug),
    ["products"],
    "Slug de producto",
    context,
  );
  addDuplicateIssues(
    project.categories.map((category) => category.id),
    ["categories"],
    "ID de categoría",
    context,
  );
  addDuplicateIssues(
    project.categories.map((category) => category.slug),
    ["categories"],
    "Slug de categoría",
    context,
  );
  addDuplicateIssues(
    project.collections.map((collection) => collection.id),
    ["collections"],
    "ID de colección",
    context,
  );
  addDuplicateIssues(
    project.collections.map((collection) => collection.slug),
    ["collections"],
    "Slug de colección",
    context,
  );
  addDuplicateIssues(
    project.assets.map((asset) => asset.id),
    ["assets"],
    "ID de recurso",
    context,
  );
  addDuplicateIssues(
    project.videos.map((asset) => asset.id),
    ["videos"],
    "ID de video",
    context,
  );
  const editablePageSections = project.pages.flatMap((page) => page.sections);
  addDuplicateIssues(
    [...project.sections, ...editablePageSections].map((section) => section.id),
    ["sections"],
    "ID de sección",
    context,
  );

  const variantIds = project.products.flatMap((product) =>
    product.variants.map((variant) => variant.id),
  );
  addDuplicateIssues(variantIds, ["products"], "ID de variante", context);

  const categoryIds = new Set(project.categories.map((category) => category.id));
  const collectionIds = new Set(project.collections.map((collection) => collection.id));
  const assetIds = new Set<string>(project.assets.map((asset) => asset.id));
  const mediaIds = new Set([...assetIds, ...project.videos.map((asset) => asset.id)]);

  project.categories.forEach((category, categoryIndex) => {
    if (category.parentId === undefined) return;
    if (!categoryIds.has(category.parentId)) {
      context.addIssue({
        code: "custom",
        message: `El padre de la categoría ${category.id} no existe: ${category.parentId}.`,
        path: ["categories", categoryIndex, "parentId"],
      });
      return;
    }

    const visited = new Set<string>([category.id]);
    let currentId: string | undefined = category.parentId;
    let depth = 1;
    while (currentId) {
      if (visited.has(currentId)) {
        context.addIssue({
          code: "custom",
          message: `La jerarquía de categorías contiene un ciclo en ${category.id}.`,
          path: ["categories", categoryIndex, "parentId"],
        });
        break;
      }
      visited.add(currentId);
      const parent = project.categories.find((candidate) => candidate.id === currentId);
      if (!parent?.parentId) break;
      depth += 1;
      if (depth > 1) {
        context.addIssue({
          code: "custom",
          message: "Las categorías sólo pueden tener un nivel de subcategorías.",
          path: ["categories", categoryIndex, "parentId"],
        });
        break;
      }
      currentId = parent.parentId;
    }
  });

  project.products.forEach((product, productIndex) => {
    addDuplicateIssues(
      product.categoryIds,
      ["products", productIndex, "categoryIds"],
      `Categoría del producto ${product.id}`,
      context,
    );
    addDuplicateIssues(
      product.collectionIds,
      ["products", productIndex, "collectionIds"],
      `Colección del producto ${product.id}`,
      context,
    );
    addDuplicateIssues(
      product.imageIds,
      ["products", productIndex, "imageIds"],
      `Imagen del producto ${product.id}`,
      context,
    );

    product.categoryIds.forEach((categoryId, referenceIndex) => {
      addMissingReferenceIssue(
        categoryIds.has(categoryId),
        ["products", productIndex, "categoryIds", referenceIndex],
        `Categoría del producto ${product.id}`,
        categoryId,
        context,
      );
    });
    product.collectionIds.forEach((collectionId, referenceIndex) => {
      addMissingReferenceIssue(
        collectionIds.has(collectionId),
        ["products", productIndex, "collectionIds", referenceIndex],
        `Colección del producto ${product.id}`,
        collectionId,
        context,
      );
    });
    product.imageIds.forEach((assetId, referenceIndex) => {
      addMissingReferenceIssue(
        assetIds.has(assetId),
        ["products", productIndex, "imageIds", referenceIndex],
        `Imagen del producto ${product.id}`,
        assetId,
        context,
      );
    });
    product.variants.forEach((variant, variantIndex) => {
      if (variant.imageId === undefined) return;
      addMissingReferenceIssue(
        assetIds.has(variant.imageId),
        ["products", productIndex, "variants", variantIndex, "imageId"],
        `Imagen de la variante ${variant.id}`,
        variant.imageId,
        context,
      );
    });

    if (Date.parse(product.createdAt) > Date.parse(product.updatedAt)) {
      context.addIssue({
        code: "custom",
        message: `El producto ${product.id} tiene updatedAt anterior a createdAt.`,
        path: ["products", productIndex, "updatedAt"],
      });
    }
  });

  project.videos.forEach((video, videoIndex) => {
    if (video.posterAssetId !== undefined) {
      addMissingReferenceIssue(
        assetIds.has(video.posterAssetId),
        ["videos", videoIndex, "posterAssetId"],
        `Poster del video ${video.id}`,
        video.posterAssetId,
        context,
      );
    }
  });

  const validateSectionMedia = (
    section: z.infer<typeof StoreSectionSchema>,
    path: Array<string | number>,
  ): void => {
    const settings = section.settings;
    for (const key of ["imageId", "posterAssetId"]) {
      const value = settings[key];
      if (typeof value === "string" && value.length > 0) {
        addMissingReferenceIssue(
          assetIds.has(value),
          [...path, "settings", key],
          `Recurso de la sección ${section.id}`,
          value,
          context,
        );
      }
    }
    const videoId = settings.videoAssetId;
    if (typeof videoId === "string" && videoId.length > 0) {
      addMissingReferenceIssue(
        project.videos.some((video) => video.id === videoId),
        [...path, "settings", "videoAssetId"],
        `Video de la sección ${section.id}`,
        videoId,
        context,
      );
    }
    const slides = settings.slides;
    if (Array.isArray(slides)) {
      slides.forEach((slide, slideIndex) => {
        if (typeof slide !== "object" || slide === null) return;
        const imageId = (slide as { imageId?: unknown }).imageId;
        if (typeof imageId !== "string" || imageId.length === 0) return;
        addMissingReferenceIssue(
          assetIds.has(imageId),
          [...path, "settings", "slides", slideIndex, "imageId"],
          `Imagen del slide de la sección ${section.id}`,
          imageId,
          context,
        );
      });
    }
  };

  project.sections.forEach((section, sectionIndex) => {
    validateSectionMedia(section, ["sections", sectionIndex]);
  });
  project.pages.forEach((page, pageIndex) => {
    page.sections.forEach((section, sectionIndex) => {
      validateSectionMedia(section, ["pages", pageIndex, "sections", sectionIndex]);
    });
  });

  const validateNavigation = (
    items: readonly z.infer<typeof NavigationItemSchema>[],
    path: Array<string | number>,
  ): void => {
    const ids = items.map((item) => item.id);
    addDuplicateIssues(ids, path, "ID de navegación", context);
    items.forEach((item, index) => {
      const validateHref = (href: string | undefined, hrefPath: Array<string | number>): void => {
        if (!href) return;
        const internal = href.startsWith("/") && !href.startsWith("//");
        let allowed = internal;
        if (!allowed) {
          try {
            allowed = ["http:", "https:", "mailto:", "tel:"].includes(new URL(href).protocol);
          } catch {
            allowed = false;
          }
        }
        if (!allowed) {
          context.addIssue({
            code: "custom",
            message: "La navegación contiene un enlace inseguro.",
            path: hrefPath,
          });
        }
      };
      validateHref(item.href, [...path, index, "href"]);
      for (const [childIndex, child] of (item.children ?? []).entries()) {
        validateHref(child.href, [...path, index, "children", childIndex, "href"]);
      }
    });
  };
  validateNavigation(project.navigation.items, ["navigation", "items"]);

  const knownPageSlugs = new Set<string>(project.pages.map((page) => page.slug));
  const knownCategorySlugs = new Set<string>(project.categories.map((category) => category.slug));
  const knownCollectionSlugs = new Set<string>(
    project.collections.map((collection) => collection.slug),
  );
  const knownProductSlugs = new Set<string>(
    project.products
      .filter((product) => product.status === "active")
      .map((product) => product.slug),
  );
  const validInternalDestination = (href: string): boolean => {
    if (!href.startsWith("/") || href.startsWith("//")) return true;
    const pathname = href.split(/[?#]/, 1)[0] ?? "/";
    if (pathname === "/" || pathname === "/contacto/" || pathname === "/nosotros/") return true;
    if (pathname === "/buscar/") return project.commerceTemplates.search.enabled;
    if (pathname === "/carrito/") return project.commerceTemplates.cart.enabled;
    if (pathname === "/compra/") return project.commerceTemplates.checkout.enabled;
    if (["/envios/", "/devoluciones/", "/privacidad/", "/terminos/"].includes(pathname))
      return true;
    const categoryMatch = /^\/categorias\/([^/]+)\/$/.exec(pathname);
    if (categoryMatch?.[1] && knownCategorySlugs.has(categoryMatch[1])) return true;
    const collectionMatch = /^\/colecciones\/([^/]+)\/$/.exec(pathname);
    if (collectionMatch?.[1] && knownCollectionSlugs.has(collectionMatch[1])) return true;
    const productMatch = /^\/productos\/([^/]+)\/$/.exec(pathname);
    if (productMatch?.[1] && knownProductSlugs.has(productMatch[1])) {
      const variantId = new URLSearchParams(href.split("?")[1] ?? "").get("variant");
      if (!variantId) return true;
      const product = project.products.find((candidate) => candidate.slug === productMatch[1]);
      return Boolean(product?.variants.some((variant) => variant.id === variantId));
    }
    return pathname === "/paginas/" || [...knownPageSlugs].some((slug) => pathname === `/${slug}/`);
  };
  const allNavigationIds = project.navigation.items.flatMap((item) => [
    item.id,
    ...(item.children ?? []).map((child) => child.id),
  ]);
  addDuplicateIssues(allNavigationIds, ["navigation", "items"], "ID de navegación", context);
  const validateNavigationTargets = (
    items: readonly z.infer<typeof NavigationItemSchema>[],
    path: Array<string | number>,
  ): void => {
    items.forEach((item, index) => {
      if (item.href?.startsWith("/") && !validInternalDestination(item.href)) {
        context.addIssue({
          code: "custom",
          message: "El destino interno de navegación no existe en el proyecto.",
          path: [...path, index, "href"],
        });
      }
      if (item.children) validateNavigationTargets(item.children, [...path, index, "children"]);
    });
  };
  validateNavigationTargets(project.navigation.items, ["navigation", "items"]);

  if (project.pages.filter((page) => page.kind === "home").length !== 1) {
    context.addIssue({
      code: "custom",
      message: "El proyecto debe tener exactamente una página home.",
      path: ["pages"],
    });
  }
  addDuplicateIssues(
    project.pages.map((page) => page.id),
    ["pages"],
    "ID de página",
    context,
  );
  addDuplicateIssues(
    project.pages.map((page) => page.slug),
    ["pages"],
    "Slug de página",
    context,
  );

  project.categories.forEach((category, categoryIndex) => {
    addDuplicateIssues(
      category.productIds,
      ["categories", categoryIndex, "productIds"],
      `Producto de la categoría ${category.id}`,
      context,
    );
    const expected = categoryProductIds(project.categories, project.products, category.id);
    if (!sameMembers(category.productIds, expected)) {
      context.addIssue({
        code: "custom",
        message: `La categoría ${category.id} no coincide con las asignaciones de productos.`,
        path: ["categories", categoryIndex, "productIds"],
      });
    }
    if (category.imageId !== undefined) {
      addMissingReferenceIssue(
        assetIds.has(category.imageId),
        ["categories", categoryIndex, "imageId"],
        `Imagen de la categoría ${category.id}`,
        category.imageId,
        context,
      );
    }
  });

  project.collections.forEach((collection, collectionIndex) => {
    addDuplicateIssues(
      collection.productIds,
      ["collections", collectionIndex, "productIds"],
      `Producto de la colección ${collection.id}`,
      context,
    );
    const expected = project.products
      .filter((product) => product.collectionIds.includes(collection.id))
      .map((product) => product.id);
    if (!sameMembers(collection.productIds, expected)) {
      context.addIssue({
        code: "custom",
        message: `La colección ${collection.id} no coincide con las asignaciones de productos.`,
        path: ["collections", collectionIndex, "productIds"],
      });
    }
    if (collection.imageId !== undefined) {
      addMissingReferenceIssue(
        assetIds.has(collection.imageId),
        ["collections", collectionIndex, "imageId"],
        `Imagen de la colección ${collection.id}`,
        collection.imageId,
        context,
      );
    }
  });

  if (project.identity.logoAssetId !== undefined) {
    addMissingReferenceIssue(
      mediaIds.has(project.identity.logoAssetId),
      ["identity", "logoAssetId"],
      "Logo",
      project.identity.logoAssetId,
      context,
    );
  }
  if (project.seo.socialImageId !== undefined) {
    addMissingReferenceIssue(
      mediaIds.has(project.seo.socialImageId),
      ["seo", "socialImageId"],
      "Imagen social",
      project.seo.socialImageId,
      context,
    );
  }
  if (Date.parse(project.createdAt) > Date.parse(project.updatedAt)) {
    context.addIssue({
      code: "custom",
      message: "El proyecto tiene updatedAt anterior a createdAt.",
      path: ["updatedAt"],
    });
  }
});

export type ImageAsset = z.infer<typeof ImageAssetSchema>;
export type VideoAsset = z.infer<typeof VideoAssetSchema>;
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
export type NavigationItem = z.infer<typeof NavigationItemSchema>;
export type NavigationConfig = z.infer<typeof NavigationConfigSchema>;
export type EditablePage = z.infer<typeof EditablePageSchema>;
export type CommerceTemplates = z.infer<typeof CommerceTemplatesSchema>;
export type SiteShell = z.infer<typeof SiteShellSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type ProductReview = z.infer<typeof ProductReviewSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Collection = z.infer<typeof CollectionSchema>;
export type MotionSettings = z.infer<typeof MotionSettingsSchema>;
export type StoreSection = z.infer<typeof StoreSectionSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type ProjectOrigin = z.infer<typeof ProjectOriginSchema>;
export type StoreProjectV2 = z.infer<typeof StoreProjectV2Schema>;
// Alias temporal para los paquetes existentes; el contrato persistido ya es v2.
export type StoreProjectV1 = StoreProjectV2;
export const StoreProjectV1Schema = StoreProjectV2Schema;

/** Devuelve la cadena raíz-padre sin mutar el proyecto. */
export function getCategoryAncestors(
  project: Pick<StoreProjectV2, "categories">,
  categoryId: CategoryId,
): Category[] {
  const byId = new Map<string, Category>(
    project.categories.map((category) => [category.id, category]),
  );
  return categoryAncestorIds(project.categories, categoryId)
    .map((id) => byId.get(id))
    .filter((category): category is Category => Boolean(category));
}

export function getCategoryDescendants(
  project: Pick<StoreProjectV2, "categories">,
  categoryId: CategoryId,
): Category[] {
  const byId = new Map<string, Category>(
    project.categories.map((category) => [category.id, category]),
  );
  return categoryDescendantIds(project.categories, categoryId)
    .map((id) => byId.get(id))
    .filter((category): category is Category => Boolean(category));
}

/**
 * Resolves direct products plus descendants for a parent category. This is the
 * shared rule used by breadcrumbs, search, exporter and Studio counts.
 */
export function getCategoryProductIds(
  project: Pick<StoreProjectV2, "categories" | "products">,
  categoryId: CategoryId,
): ProductId[] {
  return categoryProductIds(project.categories, project.products, categoryId) as ProductId[];
}

export function getCategoryBreadcrumb(
  project: Pick<StoreProjectV2, "categories">,
  categoryId: CategoryId,
): Category[] {
  const category = project.categories.find((candidate) => candidate.id === categoryId);
  return category ? [...getCategoryAncestors(project, categoryId), category] : [];
}

export {
  aboutDefaultExperience,
  aboutDefaultHistoryParagraphs,
  aboutDefaultPrinciples,
  aboutDefaultProcess,
  aboutDefaultStats,
  aboutDefaultTeam,
  defaultAboutV2Sections,
} from "./catalog-modern-about";
export {
  contactDefaultFaqItems,
  contactDefaultHelpItems,
  contactDefaultPurchaseItems,
  contactDefaultQuickLinks,
  contactDefaultReasons,
  defaultContactV2Sections,
} from "./catalog-modern-contact";
export * from "./catalog-modern-guidance";

/** Valida una entrada desconocida y agrega contexto al error de schema. */
export function parseProject(input: unknown): StoreProjectV2 {
  return StoreProjectV2Schema.parse(input);
}

export function migrateProject(input: unknown): StoreProjectV2 {
  if (typeof input !== "object" || input === null) {
    throw new Error("El proyecto no tiene un formato válido.");
  }

  const version = "schemaVersion" in input ? input.schemaVersion : undefined;
  if (version !== 2) {
    throw new Error(`Versión de proyecto incompatible: ${String(version)}.`);
  }

  return parseProject(input);
}
