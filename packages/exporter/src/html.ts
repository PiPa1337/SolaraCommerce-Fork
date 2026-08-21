/**
 * Helpers de escape HTML/XML y serialización segura para <script>.
 * Extraídos de index.ts como parte de la división por responsabilidad
 * (2026-08-21). Sin dependencias del proyecto.
 */

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

export const escapeAttribute = escapeHtml;

export function escapeXml(value: string): string {
  return escapeHtml(value);
}

export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
