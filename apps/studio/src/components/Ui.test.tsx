import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, Field } from "./Ui";

describe("Button", () => {
  it("conserva sus clases base al recibir una clase adicional", () => {
    const markup = renderToStaticMarkup(
      <Button variant="danger" className="dashboard-store-detail__danger">
        Archivar
      </Button>,
    );

    expect(markup).toContain(
      'class="button button--danger button--md dashboard-store-detail__danger"',
    );
  });
});

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

  it("permite asociar un control anidado al error con un id estable", () => {
    const markup = renderToStaticMarkup(
      <Field label="Color" error="El color no es válido" errorId="color-error">
        <span>
          <input aria-describedby="color-error" />
        </span>
      </Field>,
    );

    expect(markup).toContain('aria-describedby="color-error"');
    expect(markup).toContain('id="color-error"');
    expect(markup).toContain("El color no es válido");
  });
});
