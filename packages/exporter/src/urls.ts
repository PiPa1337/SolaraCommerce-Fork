/**
 * Helpers de URL: normalización de baseUrl, prefijado de subcarpeta y
 * construcción de URLs absolutas/relativas. Extraídos de index.ts como parte
 * de la división por responsabilidad (2026-08-21).
 */
import type { StoreProjectV1 } from "@solara/project-schema";

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function baseUrlPathname(baseUrl: string): string {
  try {
    return new URL(baseUrl).pathname.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

/** Prefija una ruta root-absoluta con la subcarpeta de la baseUrl si existe. */
export function assetHref(project: StoreProjectV1, path: string): string {
  const prefix = baseUrlPathname(project.baseUrl);
  return prefix ? `${prefix}${path}` : path;
}

/**
 * Prefija los enlaces internos root-absolutos de un documento con la
 * subcarpeta de la baseUrl (paginación, breadcrumbs, cards, navegación de
 * datos del proyecto, forms, imágenes y videos). Cubre exporter y módulos en
 * un único punto y no duplica rutas ya prefijadas.
 */
export function prefixDocumentHrefs(project: StoreProjectV1, document: string): string {
  const prefix = baseUrlPathname(project.baseUrl);
  if (!prefix) return document;
  // La posición del lookahead ya está después de la barra inicial: el prefijo
  // se compara sin esa barra (p.ej. "tienda/" para baseUrl "/tienda"). El
  // espacio previo evita prefijar atributos compuestos como data-base-href.
  const escapedPrefix = prefix.slice(1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return document.replace(
    new RegExp(`(\\s)(href|action|src|poster)="/(?!/|${escapedPrefix}/)`, "g"),
    `$1$2="${prefix}/`,
  );
}

export function absoluteUrl(project: StoreProjectV1, path: string): string {
  return `${normalizeBaseUrl(project.baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;
}

export function absoluteResourceUrl(project: StoreProjectV1, value: string): string {
  return /^https?:\/\//i.test(value) ? value : absoluteUrl(project, value);
}

/**
 * Recursos servidos por el propio sitio deben seguir siendo relativos en el
 * HTML. La baseUrl puede ser todavía el dominio de ejemplo mientras se
 * trabaja localmente; usarla para el preload dispararía una petición externa
 * fallida aunque el `<img>` relativo sí pudiera cargar.
 */
export function resourceHref(project: StoreProjectV1, value: string): string {
  return /^https?:\/\//i.test(value) ? value : assetHref(project, value);
}
