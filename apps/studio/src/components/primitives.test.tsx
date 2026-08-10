/**
 * Contrato de las primitivas puras (barrido A26): Toggle, Badge, StatusBadge,
 * Tooltip, ProgressBar, Pagination y SegmentedControl. Las partes interactivas
 * (click, hover, teclado) se cubren en tests/e2e/ui-sweep-a26.spec.ts; aquí se
 * fija el markup accesible, el mapeo de tonos y el cálculo de rangos con
 * renderToStaticMarkup (entorno node, sin DOM).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Badge,
  Pagination,
  ProgressBar,
  SegmentedControl,
  StatusBadge,
  Toggle,
  Tooltip,
} from "./primitives";

function occurrences(markup: string, needle: string): number {
  return markup.split(needle).length - 1;
}

/** Botones de página de la paginación (no confundir con el fieldset .ui-pagination__pages). */
function pageButtons(markup: string): number {
  return (markup.match(/class="ui-pagination__page(?: |")/g) ?? []).length;
}

/** Elemento <button> completo que contiene el texto dado. */
function buttonAround(markup: string, text: string): string {
  const at = markup.indexOf(text);
  const start = markup.lastIndexOf("<button", at);
  const end = markup.indexOf("</button>", at) + "</button>".length;
  return markup.slice(start, end);
}

describe("Toggle", () => {
  it("es un botón con role switch y aria-checked reflejando el estado", () => {
    const on = renderToStaticMarkup(<Toggle checked onChange={() => undefined} label="Publicar" />);
    expect(on).toContain('role="switch"');
    expect(on).toContain('aria-checked="true"');
    expect(on).toContain("ui-toggle");
    expect(on).toContain("ui-toggle--md");
  });

  it("asocia la etiqueta con aria-labelledby y soporta deshabilitado y tamaño sm", () => {
    const markup = renderToStaticMarkup(
      <Toggle
        checked={false}
        onChange={() => undefined}
        label="Deshabilitado"
        disabled
        size="sm"
      />,
    );
    expect(markup).toContain("aria-labelledby");
    expect(markup).toContain("ui-toggle__label");
    expect(markup).toContain("Deshabilitado");
    expect(markup).toContain("disabled");
    expect(markup).toContain("ui-toggle--sm");
    expect(markup).toContain('aria-checked="false"');
  });

  it("sin etiqueta no declara aria-labelledby (el llamador da el nombre)", () => {
    const markup = renderToStaticMarkup(<Toggle checked onChange={() => undefined} />);
    expect(markup).not.toContain("aria-labelledby");
    expect(markup).toContain("ui-toggle__track");
    expect(markup).toContain("ui-toggle__thumb");
  });
});

describe("Badge", () => {
  it.each([
    ["neutral", "ui-badge--neutral"],
    ["accent", "ui-badge--accent"],
    ["success", "ui-badge--success"],
    ["warning", "ui-badge--warning"],
    ["danger", "ui-badge--danger"],
    ["info", "ui-badge--info"],
  ] as const)("el tono %s renderiza la clase %s", (tone, className) => {
    const markup = renderToStaticMarkup(<Badge tone={tone}>Etiqueta</Badge>);
    expect(markup).toContain(className);
    expect(markup).toContain("ui-badge");
    expect(markup).toContain("Etiqueta");
  });

  it("por defecto usa neutral y conserva className extra", () => {
    const markup = renderToStaticMarkup(<Badge className="mi-badge">x</Badge>);
    expect(markup).toContain("ui-badge--neutral");
    expect(markup).toContain("mi-badge");
  });
});

describe("StatusBadge", () => {
  it.each([
    ["ok", "ui-badge--success", "ui-status-badge--ok"],
    ["warning", "ui-badge--warning", "ui-status-badge--warning"],
    ["error", "ui-badge--danger", "ui-status-badge--error"],
    ["idle", "ui-badge--neutral", "ui-status-badge--idle"],
    ["busy", "ui-badge--neutral", "ui-status-badge--busy"],
  ] as const)("el estado %s mapea a %s con punto %s", (status, toneClass, statusClass) => {
    const markup = renderToStaticMarkup(<StatusBadge status={status} label="Estado" />);
    expect(markup).toContain(toneClass);
    expect(markup).toContain(statusClass);
    expect(markup).toContain("ui-status-badge__dot");
    expect(markup).toContain("ui-status-badge__label");
  });

  it("expone el label como texto y como title", () => {
    const markup = renderToStaticMarkup(<StatusBadge status="ok" label="Al día" />);
    expect(markup).toContain("Al día");
    expect(markup).toContain('title="Al día"');
  });
});

describe("Tooltip", () => {
  it("expone el tip en data-tip y conserva title como fallback", () => {
    const markup = renderToStaticMarkup(
      <Tooltip tip="Guarda los cambios" position="bottom">
        <button type="button">Guardar</button>
      </Tooltip>,
    );
    expect(markup).toContain('data-tip="Guarda los cambios"');
    expect(markup).toContain('title="Guarda los cambios"');
    expect(markup).toContain("ui-tooltip");
    expect(markup).toContain("ui-tooltip--bottom");
    expect(markup).toContain("Guardar");
  });

  it("soporta las cuatro posiciones y className extra", () => {
    for (const position of ["top", "bottom", "left", "right"] as const) {
      const markup = renderToStaticMarkup(
        <Tooltip tip="tip" position={position} className="extra">
          <span>contenido</span>
        </Tooltip>,
      );
      expect(markup).toContain(`ui-tooltip--${position}`);
      expect(markup).toContain("extra");
    }
  });
});

describe("ProgressBar", () => {
  it("expone aria-valuemin/max/now y pinta el fill al porcentaje exacto", () => {
    const markup = renderToStaticMarkup(<ProgressBar value={40} max={100} label="Exportando" />);
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuemin="0"');
    expect(markup).toContain('aria-valuemax="100"');
    expect(markup).toContain('aria-valuenow="40"');
    expect(markup).toContain('aria-label="Exportando"');
    expect(markup).toContain("width:40%");
  });

  it("clampa el valor fuera de rango y el máximo no divide por cero", () => {
    const over = renderToStaticMarkup(<ProgressBar value={150} max={100} />);
    expect(over).toContain('aria-valuenow="100"');
    expect(over).toContain("width:100%");
    const under = renderToStaticMarkup(<ProgressBar value={-5} max={100} />);
    expect(under).toContain('aria-valuenow="0"');
    expect(under).toContain("width:0%");
    const zeroMax = renderToStaticMarkup(<ProgressBar value={10} max={0} />);
    expect(zeroMax).toContain('aria-valuemax="0"');
    expect(zeroMax).toContain("width:0%");
  });

  it("indeterminate omite aria-valuenow y el width del fill", () => {
    const markup = renderToStaticMarkup(<ProgressBar indeterminate label="Procesando" />);
    expect(markup).not.toContain("aria-valuenow");
    expect(markup).toContain("ui-progress--indeterminate");
    expect(markup).not.toContain("width:");
  });
});

describe("Pagination", () => {
  it("muestra todas las páginas cuando son pocas y marca la actual con aria-current", () => {
    const markup = renderToStaticMarkup(
      <Pagination page={2} totalPages={3} onChange={() => undefined} />,
    );
    expect(pageButtons(markup)).toBe(3);
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain("ui-pagination__page--active");
    expect(occurrences(markup, 'aria-current="page"')).toBe(1);
  });

  it("deshabilita Anterior en la primera página y Siguiente en la última", () => {
    const first = renderToStaticMarkup(
      <Pagination page={1} totalPages={5} onChange={() => undefined} />,
    );
    const last = renderToStaticMarkup(
      <Pagination page={5} totalPages={5} onChange={() => undefined} />,
    );
    expect(buttonAround(first, "Anterior")).toContain("disabled");
    expect(buttonAround(first, "Siguiente")).not.toContain("disabled");
    expect(buttonAround(last, "Anterior")).not.toContain("disabled");
    expect(buttonAround(last, "Siguiente")).toContain("disabled");
  });

  it("colapsa con elipses en rangos grandes según la página actual", () => {
    const start = renderToStaticMarkup(
      <Pagination page={2} totalPages={12} onChange={() => undefined} />,
    );
    expect(occurrences(start, "ui-pagination__ellipsis")).toBe(1);
    expect(start.indexOf("ui-pagination__ellipsis")).toBeGreaterThan(
      start.indexOf("ui-pagination__page"),
    );
    const middle = renderToStaticMarkup(
      <Pagination page={6} totalPages={12} onChange={() => undefined} />,
    );
    expect(occurrences(middle, "ui-pagination__ellipsis")).toBe(2);
    const end = renderToStaticMarkup(
      <Pagination page={12} totalPages={12} onChange={() => undefined} />,
    );
    expect(occurrences(end, "ui-pagination__ellipsis")).toBe(1);
    expect(end.indexOf("ui-pagination__ellipsis")).toBeLessThan(
      end.lastIndexOf("ui-pagination__page"),
    );
  });

  it("resume el rango visible con totalItems y página de 1 en 1", () => {
    const markup = renderToStaticMarkup(
      <Pagination
        page={2}
        totalPages={5}
        onChange={() => undefined}
        pageSize={10}
        totalItems={42}
      />,
    );
    expect(markup).toContain("11–20 de 42");
    const empty = renderToStaticMarkup(
      <Pagination page={1} totalPages={1} onChange={() => undefined} totalItems={0} />,
    );
    expect(empty).toContain("0 resultados");
  });

  it("clampa la página fuera de rango: resumen y marca activa coherentes", () => {
    const markup = renderToStaticMarkup(
      <Pagination
        page={12}
        totalPages={5}
        onChange={() => undefined}
        pageSize={25}
        totalItems={120}
      />,
    );
    expect(markup).toContain("101–120 de 120");
    expect(markup).not.toContain("276–120 de 120");
    expect(occurrences(markup, 'aria-current="page"')).toBe(1);
    expect(markup).toContain(">5<");
    const below = renderToStaticMarkup(
      <Pagination
        page={0}
        totalPages={4}
        onChange={() => undefined}
        pageSize={10}
        totalItems={40}
      />,
    );
    expect(below).toContain("1–10 de 40");
    expect(below).toContain('aria-current="page"');
  });

  it("deriva la última página efectiva de totalItems aunque totalPages quede fijo", () => {
    const markup = renderToStaticMarkup(
      <Pagination
        page={12}
        totalPages={12}
        onChange={() => undefined}
        pageSize={25}
        totalItems={120}
      />,
    );
    expect(markup).toContain("101–120 de 120");
    expect(occurrences(markup, 'aria-current="page"')).toBe(1);
    expect(markup).toContain(">5<");
    expect(markup).not.toContain(">6<");
    expect(buttonAround(markup, "Siguiente")).toContain("disabled");
  });

  it("sin totalItems conserva totalPages como autoridad (sin clamp de datos)", () => {
    const markup = renderToStaticMarkup(
      <Pagination page={8} totalPages={12} onChange={() => undefined} pageSize={10} />,
    );
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain(">8<");
    expect(buttonAround(markup, "Siguiente")).not.toContain("disabled");
  });

  it("ofrece el selector de filas sólo cuando hay onPageSizeChange y pageSize", () => {
    const withSelect = renderToStaticMarkup(
      <Pagination
        page={1}
        totalPages={2}
        onChange={() => undefined}
        pageSize={25}
        onPageSizeChange={() => undefined}
        pageSizeOptions={[25, 50]}
      />,
    );
    expect(withSelect).toContain("Filas por página");
    expect(withSelect).toContain('value="25"');
    expect(withSelect).toContain('value="50"');
    const without = renderToStaticMarkup(
      <Pagination page={1} totalPages={2} onChange={() => undefined} />,
    );
    expect(without).not.toContain("Filas por página");
  });

  it("con disabled deshabilita todos los botones", () => {
    const markup = renderToStaticMarkup(
      <Pagination page={2} totalPages={3} onChange={() => undefined} disabled />,
    );
    expect(occurrences(markup, "disabled")).toBe(5);
  });
});

describe("SegmentedControl", () => {
  it("expone las opciones con aria-pressed según el valor y aria-label en el fieldset", () => {
    const markup = renderToStaticMarkup(
      <SegmentedControl
        value="list"
        onChange={() => undefined}
        label="Vista del catálogo"
        options={[
          { value: "table", label: "Lista" },
          { value: "list", label: "Tarjetas" },
        ]}
      />,
    );
    expect(markup).toContain('aria-label="Vista del catálogo"');
    expect(markup).toContain("ui-segmented");
    expect(markup).toContain("ui-segmented__option--active");
    expect(occurrences(markup, 'aria-pressed="true"')).toBe(1);
    expect(occurrences(markup, 'aria-pressed="false"')).toBe(1);
  });

  it("respeta la deshabilitación por opción y el tamaño", () => {
    const markup = renderToStaticMarkup(
      <SegmentedControl
        value="a"
        onChange={() => undefined}
        label="Opciones"
        size="sm"
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B", disabled: true },
        ]}
      />,
    );
    expect(markup).toContain("ui-segmented--sm");
    expect(markup).toContain("disabled");
    expect(markup).toContain("B");
  });
});
