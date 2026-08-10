/** Inspector de tokens visuales persistidos; no introduce estilos públicos paralelos. */
import { ArrowCounterClockwise, PaintBrush, TextT, Wrench } from "@phosphor-icons/react";
import type { StoreProjectV1, Theme } from "@solara/project-schema";
import { useRef } from "react";
import { Button, Field, SectionHeader } from "../components/Ui";

const colorLabels: Record<keyof Theme["colors"], string> = {
  background: "Fondo",
  surface: "Superficie",
  text: "Texto",
  muted: "Texto secundario",
  accent: "Acento",
  accentText: "Texto sobre acento",
  border: "Borde",
};

/**
 * Paletas curadas derivadas de los tokens existentes. Sólo aplican colores:
 * el storefront público sobreescribe fondo, superficie, texto, secundario y
 * borde con valores fijos cuando colorMode es "dark" (styles.ts), así que el
 * preview y el sitio dejarían de reflejar la paleta elegida. Por eso la opción
 * "Oscuro" del selector está deshabilitada y las paletas oscuras se consiguen
 * con colores (ej. "Tinta profunda") sin cambiar colorMode.
 */
const THEME_PRESETS: Array<{
  id: string;
  name: string;
  description: string;
  colors: Theme["colors"];
}> = [
  {
    id: "editorial-calido",
    name: "Editorial cálido",
    description: "La paleta actual: neutros cálidos y acento tinta.",
    colors: {
      background: "#fcfcfb",
      surface: "#f0f0ee",
      text: "#0b0b0c",
      muted: "#696966",
      accent: "#0b0b0c",
      accentText: "#ffffff",
      border: "#dededa",
    },
  },
  {
    id: "salvia-serena",
    name: "Salvia serena",
    description: "Verdes fríos y neutros suaves para un tono calmado.",
    colors: {
      background: "#f5f7f4",
      surface: "#e7ece6",
      text: "#18231f",
      muted: "#5f6b62",
      accent: "#3a5244",
      accentText: "#fbfcfb",
      border: "#d4dcd3",
    },
  },
  {
    id: "costa-terracota",
    name: "Costa terracota",
    description: "Acento cálido de barro sobre neutros arena.",
    colors: {
      background: "#faf6f2",
      surface: "#f1e9e1",
      text: "#231510",
      muted: "#7c6a5c",
      accent: "#b4552d",
      accentText: "#fff8f3",
      border: "#e6dacd",
    },
  },
  {
    id: "tinta-profunda",
    name: "Tinta profunda",
    description: "Superficies oscuras con texto de alto contraste.",
    colors: {
      background: "#16151a",
      surface: "#1f1e24",
      text: "#f2f0f4",
      muted: "#a29daa",
      accent: "#e9e6ee",
      accentText: "#16151a",
      border: "#33313a",
    },
  },
];

const PRESET_SWATCH_KEYS: Array<keyof Theme["colors"]> = [
  "background",
  "text",
  "accent",
  "accentText",
];

function parseHex(color: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  let hex = match[1] ?? "";
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((channel) => channel + channel)
      .join("");
  }
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function luminance([red, green, blue]: [number, number, number]): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/** Ratio WCAG 2.x entre dos colores; null si alguno no es un hex válido. */
function contrastRatio(first: string, second: string): number | null {
  const firstRgb = parseHex(first);
  const secondRgb = parseHex(second);
  if (!firstRgb || !secondRgb) return null;
  const firstLuminance = luminance(firstRgb);
  const secondLuminance = luminance(secondRgb);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

const CONTRAST_PAIRS: Array<{
  id: string;
  label: string;
  foreground: keyof Theme["colors"];
  background: keyof Theme["colors"];
}> = [
  { id: "text", label: "Texto sobre fondo", foreground: "text", background: "background" },
  {
    id: "muted",
    label: "Texto secundario sobre fondo",
    foreground: "muted",
    background: "background",
  },
  { id: "accent", label: "Texto sobre acento", foreground: "accentText", background: "accent" },
];

const CONTRAST_THRESHOLD = 4.5;

type ThemeGroup = "colors" | "typography" | "geometry";

const groupLabels: Record<ThemeGroup, string> = {
  colors: "colores",
  typography: "tipografía",
  geometry: "geometría",
};

export function ThemeEditor({
  project,
  onChange,
}: {
  project: StoreProjectV1;
  onChange(project: StoreProjectV1): void;
}) {
  /** El tema al abrir la pestaña es la referencia para los resets por grupo. */
  const originalTheme = useRef(project.theme);

  const updateTheme = (theme: Theme) =>
    onChange({ ...project, theme, updatedAt: new Date().toISOString() });

  const applyPreset = (preset: (typeof THEME_PRESETS)[number]) =>
    updateTheme({ ...project.theme, colors: preset.colors });

  const resetGroup = (group: ThemeGroup) => {
    const base = originalTheme.current;
    if (group === "colors") {
      updateTheme({ ...project.theme, colors: base.colors, colorMode: base.colorMode });
      return;
    }
    if (group === "typography") {
      updateTheme({ ...project.theme, typography: base.typography });
      return;
    }
    updateTheme({
      ...project.theme,
      spacingScale: base.spacingScale,
      radius: base.radius,
      container: base.container,
    });
  };

  const contrastChecks = CONTRAST_PAIRS.map((pair) => ({
    ...pair,
    ratio: contrastRatio(
      project.theme.colors[pair.foreground],
      project.theme.colors[pair.background],
    ),
  }));

  return (
    <section className="workspace-section">
      <SectionHeader
        title="Tema"
        description="Un sistema de tokens consistente para todos los módulos de la tienda."
      />

      <fieldset className="theme-presets-panel">
        <legend>Paletas</legend>
        <div className="theme-presets">
          {THEME_PRESETS.map((preset) => (
            <button
              type="button"
              key={preset.id}
              className="theme-preset"
              data-testid="ui-theme-preset"
              aria-label={`Aplicar paleta ${preset.name}`}
              onClick={() => applyPreset(preset)}
            >
              <span className="theme-preset__swatches" aria-hidden>
                {PRESET_SWATCH_KEYS.map((key) => (
                  <span
                    key={key}
                    className="theme-preset__swatch"
                    style={{ background: preset.colors[key] }}
                  />
                ))}
              </span>
              <strong>{preset.name}</strong>
              <small>{preset.description}</small>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="theme-layout">
        <fieldset>
          <legend>
            <PaintBrush aria-hidden size={19} /> Color
          </legend>
          <div className="fieldset-toolbar">
            <Button
              variant="quiet"
              size="sm"
              icon={ArrowCounterClockwise}
              data-testid="ui-reset-colors"
              onClick={() => resetGroup("colors")}
            >
              Restaurar colores
            </Button>
          </div>
          <Field
            label="Modo"
            hint="Oscuro está deshabilitado: el sitio lo sobreescribiría con colores fijos. Usá la paleta Tinta profunda."
          >
            <select
              value={project.theme.colorMode}
              onChange={(event) =>
                updateTheme({
                  ...project.theme,
                  colorMode: event.target.value as Theme["colorMode"],
                })
              }
            >
              <option value="auto">Sistema</option>
              <option value="light">Claro</option>
              <option value="dark" disabled>
                Oscuro
              </option>
            </select>
          </Field>
          <div className="color-grid">
            {(Object.keys(colorLabels) as Array<keyof Theme["colors"]>).map((key) => (
              <Field label={colorLabels[key]} key={key}>
                <span className="color-input">
                  <input
                    type="color"
                    value={project.theme.colors[key]}
                    onChange={(event) =>
                      updateTheme({
                        ...project.theme,
                        colors: { ...project.theme.colors, [key]: event.target.value },
                      })
                    }
                  />
                  <input
                    type="text"
                    value={project.theme.colors[key]}
                    onChange={(event) =>
                      updateTheme({
                        ...project.theme,
                        colors: { ...project.theme.colors, [key]: event.target.value },
                      })
                    }
                  />
                </span>
              </Field>
            ))}
          </div>
          <div className="contrast-check" aria-live="polite">
            <strong className="contrast-check__title">Contraste (WCAG)</strong>
            {contrastChecks.map((check) => {
              const ratio = check.ratio;
              const invalid = ratio === null;
              const passing = !invalid && ratio >= CONTRAST_THRESHOLD;
              const testid = invalid
                ? "ui-contrast-warn"
                : passing
                  ? "ui-contrast-ok"
                  : "ui-contrast-warning";
              return (
                <div
                  className={`contrast-check__row${passing ? "" : " is-failing"}`}
                  data-testid={testid}
                  key={check.id}
                >
                  <span>{check.label}</span>
                  <span className="contrast-check__ratio">
                    {check.ratio === null
                      ? "color no válido"
                      : `${check.ratio.toFixed(2)}:1${passing ? "" : ` — inferior a ${CONTRAST_THRESHOLD}:1`}`}
                  </span>
                </div>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend>
            <TextT aria-hidden size={19} /> Tipografía
          </legend>
          <div className="fieldset-toolbar">
            <Button
              variant="quiet"
              size="sm"
              icon={ArrowCounterClockwise}
              data-testid="ui-reset-typography"
              onClick={() => resetGroup("typography")}
            >
              Restaurar tipografía
            </Button>
          </div>
          <Field label="Familia de títulos">
            <input
              value={project.theme.typography.display}
              onChange={(event) =>
                updateTheme({
                  ...project.theme,
                  typography: { ...project.theme.typography, display: event.target.value },
                })
              }
            />
          </Field>
          <Field label="Familia de texto">
            <input
              value={project.theme.typography.body}
              onChange={(event) =>
                updateTheme({
                  ...project.theme,
                  typography: { ...project.theme.typography, body: event.target.value },
                })
              }
            />
          </Field>
          <Field label={`Escala ${project.theme.typography.scale.toFixed(2)}`}>
            <input
              type="range"
              min={0.8}
              max={1.4}
              step={0.05}
              value={project.theme.typography.scale}
              onChange={(event) =>
                updateTheme({
                  ...project.theme,
                  typography: { ...project.theme.typography, scale: Number(event.target.value) },
                })
              }
            />
          </Field>
        </fieldset>

        <fieldset>
          <legend>
            <Wrench aria-hidden size={19} /> Geometría
          </legend>
          <div className="fieldset-toolbar">
            <Button
              variant="quiet"
              size="sm"
              icon={ArrowCounterClockwise}
              data-testid="ui-reset-geometry"
              onClick={() => resetGroup("geometry")}
            >
              Restaurar geometría
            </Button>
          </div>
          <Field label={`Espaciado ${project.theme.spacingScale.toFixed(2)}`}>
            <input
              type="range"
              min={0.75}
              max={1.5}
              step={0.05}
              value={project.theme.spacingScale}
              onChange={(event) =>
                updateTheme({ ...project.theme, spacingScale: Number(event.target.value) })
              }
            />
          </Field>
          <Field label={`Radio ${project.theme.radius}px`}>
            <input
              type="range"
              min={0}
              max={40}
              value={project.theme.radius}
              onChange={(event) =>
                updateTheme({ ...project.theme, radius: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Ancho del contenedor">
            <input
              type="number"
              min={960}
              max={1800}
              step={20}
              value={project.theme.container}
              onChange={(event) =>
                updateTheme({ ...project.theme, container: Number(event.target.value) })
              }
            />
          </Field>
        </fieldset>
      </div>
      <p className="inspector-note">
        Los resets vuelven cada grupo al tema que tenía la tienda al abrir esta pestaña (
        {groupLabels.colors}, {groupLabels.typography} y {groupLabels.geometry} por separado).
      </p>
    </section>
  );
}
