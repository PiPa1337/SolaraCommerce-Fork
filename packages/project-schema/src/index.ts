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
export const SlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
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
  imageId: AssetIdSchema.optional(),
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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CategorySchema = z.object({
  id: CategoryIdSchema,
  slug: SlugSchema,
  title: z.string().min(1),
  description: z.string(),
  imageId: AssetIdSchema.optional(),
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

export const StoreProjectV1Schema = z.object({
  schemaVersion: z.literal(1),
  id: StoreIdSchema,
  name: z.string().min(1),
  slug: SlugSchema,
  status: z.enum(["active", "archived"]),
  locale: z.literal("es-AR"),
  currency: z.literal("ARS"),
  baseUrl: z.string().url(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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
  sections: z.array(StoreSectionSchema),
});

export type ImageAsset = z.infer<typeof ImageAssetSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Collection = z.infer<typeof CollectionSchema>;
export type MotionSettings = z.infer<typeof MotionSettingsSchema>;
export type StoreSection = z.infer<typeof StoreSectionSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type StoreProjectV1 = z.infer<typeof StoreProjectV1Schema>;

export function parseProject(input: unknown): StoreProjectV1 {
  return StoreProjectV1Schema.parse(input);
}

export function migrateProject(input: unknown): StoreProjectV1 {
  if (typeof input !== "object" || input === null) {
    throw new Error("El proyecto no tiene un formato válido.");
  }

  const version = "schemaVersion" in input ? input.schemaVersion : undefined;
  if (version !== 1) {
    throw new Error(`Versión de proyecto incompatible: ${String(version)}.`);
  }

  return parseProject(input);
}
