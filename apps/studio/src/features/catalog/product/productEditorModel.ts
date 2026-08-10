/**
 * Modelo puro del editor de producto: validación del draft, slug y variantes.
 * Se mantiene fuera del componente para permitir tests unitarios sin React.
 */
import type { Product, Variant } from "@solara/project-schema";

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Slug local desde el título: minúsculas, números y guiones (NFD quita acentos). */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function slugErrorFor(slug: string, existingSlugs: string[]): string | undefined {
  if (!slug) return "Escribí un slug o se generará desde el título.";
  if (slug.length > 120) return "El slug no puede superar los 120 caracteres.";
  if (!SLUG_PATTERN.test(slug)) {
    return "Solo minúsculas, números y guiones (ejemplo: lampara-horizonte).";
  }
  if (existingSlugs.includes(slug)) return "Ya existe otro producto con este slug.";
  return undefined;
}

export interface VariantFieldErrors {
  title: string | undefined;
  price: string | undefined;
  options: string | undefined;
}

export interface DraftErrors {
  title: string | undefined;
  slugError: string | undefined;
  slugAvailable: boolean;
  variantErrors: VariantFieldErrors[];
}

export function optionsText(options: Record<string, string>): string {
  return Object.entries(options)
    .map(([name, value]) => `${name}=${value}`)
    .join(", ");
}

export function parseOptions(value: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of value
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean)) {
    const separator = item.indexOf("=");
    if (separator <= 0 || separator === item.length - 1) {
      throw new Error(`La opción "${item}" debe usar el formato Nombre=Valor.`);
    }
    const name = item.slice(0, separator).trim();
    const optionValue = item.slice(separator + 1).trim();
    if (name in result) throw new Error(`La opción "${name}" está repetida.`);
    result[name] = optionValue;
  }
  return result;
}

export function validateDraft(
  draft: Product,
  optionValues: Record<string, string>,
  existingSlugs: string[],
): DraftErrors {
  const slug = draft.slug.trim();
  const slugError = slugErrorFor(slug, existingSlugs);
  const variantErrors = draft.variants.map((variant) => {
    const fieldErrors: VariantFieldErrors = {
      title: undefined,
      price: undefined,
      options: undefined,
    };
    if (!variant.title.trim()) fieldErrors.title = "Escribí un nombre para la variante.";
    if (!Number.isInteger(variant.price) || variant.price < 0) {
      fieldErrors.price = "El precio debe ser un número entero en centavos, mayor o igual a 0.";
    }
    try {
      parseOptions(optionValues[variant.id] ?? "");
    } catch (reason) {
      fieldErrors.options =
        reason instanceof Error ? reason.message : "Las opciones de la variante no son válidas.";
    }
    return fieldErrors;
  });
  return {
    title: draft.title.trim() ? undefined : "Escribí un título para el producto.",
    slugError,
    slugAvailable: slug !== "" && slugError === undefined,
    variantErrors,
  };
}

/** Variante nueva en blanco (botón "Agregar variante"). */
export function createBlankVariant(): Variant {
  return {
    id: `variant-${crypto.randomUUID()}` as Variant["id"],
    sku: "",
    title: "Nueva variante",
    optionValues: {},
    price: 0 as Variant["price"],
    available: true,
    stockStatus: "in_stock",
  };
}

/**
 * Duplicado de una variante: conserva SKU, precios, opciones y stock; sólo
 * cambia id y título (sufijo " copia"). El SKU duplicado se acepta sin
 * feedback (SCH2 diferido: unicidad de SKU requiere cambio de schema).
 */
export function duplicateVariant(source: Variant): Variant {
  return {
    ...structuredClone(source),
    id: `variant-${crypto.randomUUID()}` as Variant["id"],
    title: `${source.title} copia`,
  };
}
