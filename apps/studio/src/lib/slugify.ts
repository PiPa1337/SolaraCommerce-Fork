/**
 * Slug canónico del Studio: minúsculas, números y guiones, sin acentos (NFD).
 * Devuelve "" para entradas sin caracteres válidos; el llamador decide el
 * fallback. El límite de 120 caracteres coincide con SlugSchema del schema.
 */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
