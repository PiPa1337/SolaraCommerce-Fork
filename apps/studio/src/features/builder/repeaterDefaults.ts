import type { RepeaterItemField } from "@solara/modules";
import type { StoreProjectV1 } from "@solara/project-schema";

/**
 * Genera un ítem por defecto para un repeater de settingsFields. Siempre
 * incluye un `id` válido, lo declare o no settingsFields: los esquemas de los
 * módulos (testimonios, bento, slides) lo exigen y el inspector sólo commitea
 * valores que pasan el schema.
 */
export function defaultRepeaterItem(
  fields: readonly RepeaterItemField[],
  project: StoreProjectV1,
  itemLabelKey?: string,
): Record<string, unknown> {
  return {
    id: `item-${crypto.randomUUID()}`,
    ...Object.fromEntries(
      fields.map((field) => [
        field.key,
        field.type === "boolean"
          ? false
          : field.type === "number"
            ? (field.min ?? 0)
            : field.type === "select"
              ? (field.options?.[0]?.value ?? "")
              : field.key === "id"
                ? `item-${crypto.randomUUID()}`
                : field.key === itemLabelKey || field.key === "title"
                  ? "Nuevo elemento"
                  : field.key === "author"
                    ? "Nueva persona"
                    : field.key === "body"
                      ? "Texto editable"
                      : field.key === "categoryId"
                        ? (project.categories[0]?.id ?? "")
                        : field.key === "actionLabel"
                          ? "Ver más"
                          : field.key === "actionHref"
                            ? "/"
                            : field.type === "asset"
                              ? ""
                              : field.type === "url"
                                ? "/"
                                : "Texto editable",
      ]),
    ),
  };
}
