/**
 * IDs branded y Money. Extraídos de index.ts como base sin dependencias
 * circulares: media.ts y otros módulos de dominio importan desde acá.
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
