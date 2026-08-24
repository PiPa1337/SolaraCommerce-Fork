/** Inspector de tokens visuales persistidos; no introduce estilos públicos paralelos. */
import { ArrowCounterClockwise, PaintBrush, TextT, Wrench } from "@phosphor-icons/react";
import type { StoreProjectV1, Theme } from "@solara/project-schema";
import { useEffect, useRef, useState } from "react";
import { Button, Field, SectionHeader } from "../components/Ui";

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const COLOR_ERROR = "Ingresá un color hex como #1a2b3c.";
const CONTAINER_ERROR = "Ingresá un ancho de 960 a 1800 px.";
const CONTAINER_MIN = 960;
const CONTAINER_MAX = 1800;

/**
 * Opciones reales del selector de fuentes. El valor persistido es el stack
 * completo (typography.display/body siguen strings); las familias del sistema
 * no cargan nada y las de Google Fonts son las que el exporter materializa
 * con @font-face en el sitio y el preview.
 */
interface FontOption {
  id: string;
  label: string;
  stack: string;
  group: "sistema" | "google";
}

const FONT_OPTIONS: FontOption[] = [
  { id: "georgia", label: "Georgia", group: "sistema", stack: `Georgia, "Times New Roman", serif` },
  {
    id: "verdana",
    label: "Verdana",
    group: "sistema",
    stack: `Verdana, Geneva, Tahoma, sans-serif`,
  },
  {
    id: "arial",
    label: "Arial",
    group: "sistema",
    stack: `Arial, "Helvetica Neue", Helvetica, sans-serif`,
  },
  { id: "tahoma", label: "Tahoma", group: "sistema", stack: `Tahoma, Verdana, Geneva, sans-serif` },
  {
    id: "trebuchet",
    label: "Trebuchet MS",
    group: "sistema",
    stack: `"Trebuchet MS", "Segoe UI", Tahoma, sans-serif`,
  },
  {
    id: "times",
    label: "Times New Roman",
    group: "sistema",
    stack: `"Times New Roman", Times, Georgia, serif`,
  },
  {
    id: "courier",
    label: "Courier New",
    group: "sistema",
    stack: `"Courier New", Courier, "Lucida Console", monospace`,
  },
  {
    id: "monospace",
    label: "Monospace",
    group: "sistema",
    stack: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
  },
  { id: "sans-serif", label: "Sans serif", group: "sistema", stack: `sans-serif` },
  { id: "serif", label: "Serif", group: "sistema", stack: `serif` },
  {
    id: "system-ui",
    label: "System UI",
    group: "sistema",
    stack: `system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`,
  },
  {
    id: "archivo",
    label: "Archivo",
    group: "google",
    stack: `Archivo, Arial Narrow, Helvetica Neue, Arial, sans-serif`,
  },
  {
    id: "inter",
    label: "Inter",
    group: "google",
    stack: `Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`,
  },
  { id: "lora", label: "Lora", group: "google", stack: `Lora, Georgia, "Times New Roman", serif` },
];

/** Primera familia de un stack, sin comillas y en minúsculas. */
function firstFamilyOf(stack: string): string {
  return (stack.split(",")[0] ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .toLowerCase();
}

/**
 * Migración tolerante: resuelve el valor guardado por stack exacto o por la
 * primera familia del stack. Si no matchea ninguna opción devuelve undefined:
 * el select muestra una opción "Personalizada" con el valor tal cual y el
 * proyecto no se reescribe.
 */
function matchFontOption(value: string): FontOption | undefined {
  const trimmed = value.trim();
  const exact = FONT_OPTIONS.find((option) => option.stack === trimmed);
  if (exact) return exact;
  const first = firstFamilyOf(trimmed);
  if (first === "") return undefined;
  return FONT_OPTIONS.find((option) => firstFamilyOf(option.stack) === first);
}

/** Normaliza a #rrggbb en minúsculas, el formato que acepta el input nativo. */
function normalizeHexColor(color: string): string | null {
  const match = HEX_COLOR_RE.exec(color.trim());
  if (!match) return null;
  const channels = match[0].slice(1);
  const expanded =
    channels.length === 3
      ? channels
          .split("")
          .map((channel) => channel + channel)
          .join("")
      : channels;
  return `#${expanded.toLowerCase()}`;
}

const colorLabels: Record<keyof Theme["colors"], string> = {
  background: "Fondo",
  surface: "Superficie",
  text: "Texto",
  muted: "Texto secundario",
  accent: "Acento",
  accentText: "Texto sobre acento",
  border: "Borde",
  sale: "Descuento",
  rating: "Rating",
};

/**
 * Paletas curadas derivadas de los tokens existentes. Sólo aplican colores:
 * el storefront público sobreescribe fondo, superficie, texto, secundario y
 * borde con valores fijos cuando colorMode es "dark" (styles.ts), así que el
 * preview y el sitio dejarían de reflejar la paleta elegida. Por eso la opción
 * "Oscuro" del selector está deshabilitada. Las diez opciones son claras y
 * mantienen contraste suficiente para texto principal, secundario y acentos.
 */
const THEME_PRESETS: Array<{
  id: string;
  name: string;
  description: string;
  colors: Theme["colors"];
}> = [
  {
    id: "marfil-editorial",
    name: "Marfil editorial",
    description: "Neutros cálidos y acento tinta para una base limpia.",
    colors: {
      background: "#fcfcfb",
      surface: "#f0f0ee",
      text: "#0b0b0c",
      muted: "#696966",
      accent: "#0b0b0c",
      accentText: "#ffffff",
      border: "#dededa",
      sale: "#d94a55",
      rating: "#d99a12",
    },
  },
  {
    id: "jardin-salvia",
    name: "Jardín de salvia",
    description: "Verdes suaves para una identidad natural y serena.",
    colors: {
      background: "#f1f6f0",
      surface: "#e0ece0",
      text: "#1b2a20",
      muted: "#526457",
      accent: "#356248",
      accentText: "#f6fff7",
      border: "#c7d8c7",
      sale: "#d94a55",
      rating: "#d99a12",
    },
  },
  {
    id: "terracota-solar",
    name: "Terracota solar",
    description: "Barro cálido y arena para una tienda cercana y luminosa.",
    colors: {
      background: "#fff5ee",
      surface: "#f8e4d4",
      text: "#3a2118",
      muted: "#76584b",
      accent: "#9a442c",
      accentText: "#fff8f3",
      border: "#e8c8b3",
      sale: "#d94a55",
      rating: "#d99a12",
    },
  },
  {
    id: "azul-mediterraneo",
    name: "Azul mediterráneo",
    description: "Azules frescos para una presencia confiable y abierta.",
    colors: {
      background: "#eff6fb",
      surface: "#ddebf5",
      text: "#172b3a",
      muted: "#4a6272",
      accent: "#1d5b7a",
      accentText: "#f7fcff",
      border: "#c5d8e5",
      sale: "#d94a55",
      rating: "#d99a12",
    },
  },
  {
    id: "lavanda-suave",
    name: "Lavanda suave",
    description: "Lavandas ligeras para una estética delicada y moderna.",
    colors: {
      background: "#f6f2fb",
      surface: "#e9e0f3",
      text: "#29213a",
      muted: "#655978",
      accent: "#6d4a92",
      accentText: "#fbf8ff",
      border: "#d8c9e7",
      sale: "#d94a55",
      rating: "#d99a12",
    },
  },
  {
    id: "rosa-petalo",
    name: "Rosa pétalo",
    description: "Rosas empolvados con contraste para una marca cálida.",
    colors: {
      background: "#fff2f4",
      surface: "#f6e0e5",
      text: "#3a2028",
      muted: "#76515c",
      accent: "#9a3f56",
      accentText: "#fff7f9",
      border: "#e6c5cf",
      sale: "#d94a55",
      rating: "#d99a12",
    },
  },
  {
    id: "menta-fresca",
    name: "Menta fresca",
    description: "Verdes agua para una sensación liviana y actual.",
    colors: {
      background: "#effaf7",
      surface: "#ddf1ea",
      text: "#17352f",
      muted: "#4d6a62",
      accent: "#1e6b59",
      accentText: "#f4fffc",
      border: "#c2ded5",
      sale: "#d94a55",
      rating: "#d99a12",
    },
  },
  {
    id: "mostaza-clara",
    name: "Mostaza clara",
    description: "Amarillos suaves para destacar con energía sin saturar.",
    colors: {
      background: "#fff9e8",
      surface: "#f6edc7",
      text: "#332c18",
      muted: "#756b43",
      accent: "#766018",
      accentText: "#fffbef",
      border: "#e7d9a8",
      sale: "#d94a55",
      rating: "#d99a12",
    },
  },
  {
    id: "coral-suave",
    name: "Coral suave",
    description: "Coral cálido para comunicar cercanía y movimiento.",
    colors: {
      background: "#fff4f1",
      surface: "#f6dfd8",
      text: "#3b201d",
      muted: "#765651",
      accent: "#a64034",
      accentText: "#fff8f6",
      border: "#e6c6be",
      sale: "#d94a55",
      rating: "#d99a12",
    },
  },
  {
    id: "azul-lavanda",
    name: "Azul lavanda",
    description: "Azules violetas para una identidad tranquila y precisa.",
    colors: {
      background: "#eef1fa",
      surface: "#dce2f2",
      text: "#202b4a",
      muted: "#56627d",
      accent: "#3d5592",
      accentText: "#f8faff",
      border: "#c8d0e5",
      sale: "#d94a55",
      rating: "#d99a12",
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

  /**
   * Borradores de los campos de color: mientras el texto no es un hex válido
   * no se commitea (patrón de SettingsInspector/Overview); el draft sobrevive
   * a la escritura y se descarta al cambiar los colores confirmados.
   */
  const [colorDrafts, setColorDrafts] = useState<Partial<Record<keyof Theme["colors"], string>>>(
    {},
  );
  const [colorErrors, setColorErrors] = useState<Partial<Record<keyof Theme["colors"], boolean>>>(
    {},
  );

  /**
   * Borrador del ancho del contenedor: escribirlo tecleando pasa por valores
   * inválidos a mitad de camino (p. ej. "1"), que el schema rechazaría y
   * haría rebotar el input sin mostrar lo escrito. El draft sólo se commitea
   * con un número dentro del rango del schema (mismo patrón que los colores).
   */
  const [containerDraft, setContainerDraft] = useState<string | null>(null);
  const [containerError, setContainerError] = useState<boolean>(false);

  /* biome-ignore lint/correctness/useExhaustiveDependencies: al cambiar los colores confirmados (commit, preset o reset) los borradores de texto deben volver a partir de esos valores. */
  useEffect(() => {
    setColorDrafts({});
    setColorErrors({});
  }, [project.theme.colors]);

  useEffect(() => {
    setContainerDraft(null);
    setContainerError(false);
  }, []);

  const updateTheme = (theme: Theme) =>
    onChange({ ...project, theme, updatedAt: new Date().toISOString() });

  const commitColor = (key: keyof Theme["colors"], raw: string) => {
    const next = normalizeHexColor(raw);
    if (next === null) {
      setColorDrafts((current) => ({ ...current, [key]: raw }));
      setColorErrors((current) => ({ ...current, [key]: true }));
      return;
    }
    setColorDrafts((current) => ({ ...current, [key]: next }));
    setColorErrors((current) => ({ ...current, [key]: false }));
    if (next !== project.theme.colors[key]) {
      updateTheme({
        ...project.theme,
        colors: { ...project.theme.colors, [key]: next },
      });
    }
  };

  const applyPreset = (preset: (typeof THEME_PRESETS)[number]) =>
    updateTheme({ ...project.theme, colors: preset.colors });

  const resetGroup = (group: ThemeGroup) => {
    const base = originalTheme.current;
    if (group === "colors") {
      // Limpiar borradores explícitamente: si los colores confirmados ya eran
      // los de apertura, el efecto de [project.theme.colors] no se dispara y el
      // texto inválido tecleado seguiría visible tras "Restaurar".
      setColorDrafts({});
      setColorErrors({});
      updateTheme({ ...project.theme, colors: base.colors, colorMode: base.colorMode });
      return;
    }
    if (group === "typography") {
      updateTheme({ ...project.theme, typography: base.typography });
      return;
    }
    setContainerDraft(null);
    setContainerError(false);
    updateTheme({
      ...project.theme,
      spacingScale: base.spacingScale,
      radius: base.radius,
      container: base.container,
    });
  };

  const commitContainer = (raw: string) => {
    const next = Number(raw.trim());
    if (raw.trim() === "" || !Number.isFinite(next)) {
      setContainerDraft(raw);
      setContainerError(true);
      return;
    }
    const rounded = Math.round(next);
    if (rounded < CONTAINER_MIN || rounded > CONTAINER_MAX) {
      setContainerDraft(raw);
      setContainerError(true);
      return;
    }
    setContainerDraft(String(rounded));
    setContainerError(false);
    if (rounded !== project.theme.container) {
      updateTheme({ ...project.theme, container: rounded });
    }
  };

  const commitFont = (key: "display" | "body", stack: string) => {
    if (stack !== project.theme.typography[key]) {
      updateTheme({
        ...project.theme,
        typography: { ...project.theme.typography, [key]: stack },
      });
    }
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
        title="Tema de la tienda"
        description="Un sistema de tokens consistente para todos los módulos de la tienda."
      />

      {project.commerceTemplates.designFamily?.startsWith("catalog-modern") ? (
        <fieldset className="theme-presets-panel">
          <legend>Familia visual</legend>
          <div className="theme-presets">
            <div
              className="theme-preset"
              data-testid="ui-design-family-v2"
              data-active={
                project.commerceTemplates.designFamily === "catalog-modern-v2" || undefined
              }
            >
              <strong>Editorial V2</strong>
              <small>Familia visual actual de SolaraCommerce.</small>
            </div>
          </div>
          <p className="inspector-note">
            La familia visual actual es única. Catálogo, contenido, SEO y configuración comercial se
            conservan.
          </p>
        </fieldset>
      ) : null}

      <fieldset className="theme-presets-panel">
        <legend>Paletas</legend>
        <div className="theme-presets">
          {THEME_PRESETS.map((preset) => {
            const active = Object.keys(preset.colors).every(
              (key) =>
                project.theme.colors[key as keyof Theme["colors"]] ===
                preset.colors[key as keyof Theme["colors"]],
            );
            return (
              <button
                type="button"
                key={preset.id}
                className="theme-preset"
                data-testid="ui-theme-preset"
                aria-label={`Aplicar paleta ${preset.name}`}
                aria-pressed={active}
                data-active={active || undefined}
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
            );
          })}
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
            hint="Oscuro está deshabilitado: el sitio lo sobreescribiría con colores fijos. Las paletas disponibles están diseñadas para fondos claros."
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
              <Field
                label={colorLabels[key]}
                key={key}
                {...(colorErrors[key]
                  ? { error: COLOR_ERROR, errorId: `theme-color-error-${key}` }
                  : {})}
              >
                <span className="color-input">
                  <input
                    type="color"
                    value={project.theme.colors[key]}
                    aria-label={`${colorLabels[key]} selector de color`}
                    data-testid={`ui-color-native-${key}`}
                    onChange={(event) => commitColor(key, event.target.value)}
                  />
                  <input
                    type="text"
                    value={colorDrafts[key] ?? project.theme.colors[key]}
                    aria-label={`${colorLabels[key]} valor hexadecimal`}
                    aria-invalid={colorErrors[key] ? true : undefined}
                    aria-describedby={colorErrors[key] ? `theme-color-error-${key}` : undefined}
                    data-testid={`ui-color-text-${key}`}
                    onChange={(event) => commitColor(key, event.target.value)}
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
            <FontSelect
              value={project.theme.typography.display}
              testId="ui-font-display"
              label="Familia de títulos"
              onChange={(stack) => commitFont("display", stack)}
            />
          </Field>
          <Field label="Familia de texto">
            <FontSelect
              value={project.theme.typography.body}
              testId="ui-font-body"
              label="Familia de texto"
              onChange={(stack) => commitFont("body", stack)}
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
          <Field
            label="Ancho del contenedor"
            {...(containerError ? { error: CONTAINER_ERROR } : {})}
          >
            <input
              type="number"
              min={CONTAINER_MIN}
              max={CONTAINER_MAX}
              value={containerDraft ?? String(project.theme.container)}
              aria-invalid={containerError ? true : undefined}
              onChange={(event) => commitContainer(event.target.value)}
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

/**
 * Selector de fuentes real: familias del sistema + Google Fonts curadas. Un
 * valor guardado fuera de las opciones se muestra como "Personalizada" sin
 * reescribir el proyecto (migración tolerante sin cambios de schema).
 */
function FontSelect({
  value,
  testId,
  label,
  onChange,
}: {
  value: string;
  testId: string;
  label: string;
  onChange(stack: string): void;
}) {
  const matched = matchFontOption(value);
  const custom = matched === undefined;
  return (
    <select
      aria-label={label}
      value={custom ? value : matched.stack}
      data-testid={testId}
      onChange={(event) => onChange(event.target.value)}
    >
      <optgroup label="Sistema">
        {FONT_OPTIONS.filter((option) => option.group === "sistema").map((option) => (
          <option key={option.id} value={option.stack}>
            {option.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="Google Fonts">
        {FONT_OPTIONS.filter((option) => option.group === "google").map((option) => (
          <option key={option.id} value={option.stack}>
            {option.label}
          </option>
        ))}
      </optgroup>
      {custom ? (
        <optgroup label="Personalizada">
          <option value={value}>
            {value === "" ? "Personalizada" : `Personalizada: ${value}`}
          </option>
        </optgroup>
      ) : null}
    </select>
  );
}
