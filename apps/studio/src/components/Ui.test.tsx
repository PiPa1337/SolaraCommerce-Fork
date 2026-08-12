import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Field } from "./Ui";

describe("Field", () => {
  it("conserva la ayuda y el error en aria-describedby junto a una referencia existente", () => {
    const markup = renderToStaticMarkup(
      <Field label="Título" hint="Hasta 70 caracteres" error="El título es obligatorio">
        <input aria-describedby="external-description" />
      </Field>,
    );
    const describedBy = markup.match(/aria-describedby="([^"]+)"/)?.[1]?.split(" ") ?? [];

    expect(describedBy).toHaveLength(3);
    expect(describedBy[0]).toBe("external-description");
    expect(markup).toContain(`id="${describedBy[1]}">Hasta 70 caracteres`);
    expect(markup).toContain(`id="${describedBy[2]}"`);
    expect(markup).toContain("El título es obligatorio");
    expect(markup).toContain('aria-invalid="true"');
  });
});
