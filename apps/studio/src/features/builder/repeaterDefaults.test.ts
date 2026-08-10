import type { RepeaterItemField } from "@solara/modules";
import { catalogModernModules, type RegisteredModule } from "@solara/modules";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { describe, expect, it } from "vitest";
import { defaultRepeaterItem } from "./repeaterDefaults";

function repeaterFields(
  module: RegisteredModule,
): { fields: readonly RepeaterItemField[]; key: string }[] {
  return module.settingsFields
    .filter((field) => field.type === "repeater")
    .map((field) => ({ fields: field.fields, key: field.key }));
}

describe("defaultRepeaterItem", () => {
  it("siempre genera un id válido aunque settingsFields no lo declare", () => {
    const project = structuredClone(catalogModernStore);
    for (const module of catalogModernModules) {
      for (const { fields, key } of repeaterFields(module)) {
        const item = defaultRepeaterItem(fields, project);
        expect(item.id, `${module.manifest.id}.${key}`).toMatch(/^item-.+/);
      }
    }
  });

  it("el ítem generado pasa el schema del módulo junto a los defaults", () => {
    const project = structuredClone(catalogModernStore);
    for (const module of catalogModernModules) {
      for (const repeater of module.settingsFields) {
        if (repeater.type !== "repeater") continue;
        const defaults = module.settingsSchema.parse({});
        const item = defaultRepeaterItem(repeater.fields, project, repeater.itemLabelKey);
        const result = module.settingsSchema.safeParse({
          ...defaults,
          [repeater.key]: [item],
        });
        expect(result.success, module.manifest.id).toBe(true);
      }
    }
  });

  it("duplicar un ítem con id nuevo conserva un set válido", () => {
    const project = structuredClone(catalogModernStore);
    const testimonials = catalogModernModules.find(
      (module) => module.manifest.id === "catalog-testimonials",
    );
    if (!testimonials) throw new Error("Falta el módulo catalog-testimonials");
    const repeater = testimonials.settingsFields.find((field) => field.type === "repeater");
    if (!repeater || repeater.type !== "repeater") {
      throw new Error("catalog-testimonials sin repeater");
    }
    const items = [
      defaultRepeaterItem(repeater.fields, project, repeater.itemLabelKey),
      defaultRepeaterItem(repeater.fields, project, repeater.itemLabelKey),
    ];
    const duplicated = [...items.slice(0, 1), { ...items[0], id: "item-dup" }, ...items.slice(1)];
    const defaults = testimonials.settingsSchema.parse({});
    const result = testimonials.settingsSchema.safeParse({
      ...defaults,
      items: duplicated,
    });
    expect(result.success).toBe(true);
  });

  it("eliminar un ítem conserva los restantes válidos", () => {
    const project = structuredClone(catalogModernStore);
    const testimonials = catalogModernModules.find(
      (module) => module.manifest.id === "catalog-testimonials",
    );
    if (!testimonials) throw new Error("Falta el módulo catalog-testimonials");
    const repeater = testimonials.settingsFields.find((field) => field.type === "repeater");
    if (!repeater || repeater.type !== "repeater") {
      throw new Error("catalog-testimonials sin repeater");
    }
    const items = [
      defaultRepeaterItem(repeater.fields, project, repeater.itemLabelKey),
      defaultRepeaterItem(repeater.fields, project, repeater.itemLabelKey),
    ];
    const withoutFirst = items.slice(1);
    const defaults = testimonials.settingsSchema.parse({});
    const result = testimonials.settingsSchema.safeParse({
      ...defaults,
      items: withoutFirst,
    });
    expect(result.success).toBe(true);
  });
});
