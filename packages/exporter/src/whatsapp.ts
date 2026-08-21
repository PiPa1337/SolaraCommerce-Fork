/**
 * Helpers de WhatsApp y copy público. Extraídos de index.ts como parte de la
 * división por responsabilidad (2026-08-21).
 */

import type { StoreProjectV1 } from "@solara/project-schema";
import { CATALOG_MODERN_PLACEHOLDER_PHONE } from "@solara/project-schema";

export function publicWhatsAppPhone(project: StoreProjectV1): string {
  const phone = project.whatsapp.phone.trim();
  if (!phone || phone === CATALOG_MODERN_PLACEHOLDER_PHONE) return "";
  return phone;
}

export function buildWhatsAppLink(project: StoreProjectV1, message: string): string {
  const phone = publicWhatsAppPhone(project).replace(/\D/g, "");
  if (!phone) return "";
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function interpolatePublicCopy(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}
