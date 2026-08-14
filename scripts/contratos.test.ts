import { expect, test } from "vitest";
import { getModuleDefinition } from "../packages/modules/src/index";
import { catalogModernStore } from "../packages/project-schema/src/catalog-modern-fixture";
import { referenceStore } from "../packages/project-schema/src/fixture";
import { StoreProjectV2Schema } from "../packages/project-schema/src/index";

test("N5 F6: todos los moduleIds de las secciones existen en el registry", () => {
  for (const [name, project] of Object.entries({
    reference: referenceStore,
    catalogModern: catalogModernStore,
  })) {
    const parsed = StoreProjectV2Schema.parse(project);
    const moduleIds = [
      ...parsed.sections.map((section) => section.moduleId),
      ...parsed.pages.flatMap((page) => page.sections.map((section) => section.moduleId)),
    ];
    const unknown = [...new Set(moduleIds)].filter((id) => {
      try {
        getModuleDefinition(id);
        return false;
      } catch {
        return true;
      }
    });
    expect(unknown, `${name}: módulos sin definición: ${unknown.join(", ")}`).toEqual([]);
  }
});
