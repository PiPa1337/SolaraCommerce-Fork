/** Inspector de tokens visuales persistidos; no introduce estilos públicos paralelos. */
import { PaintBrush, TextT, Wrench } from "@phosphor-icons/react";
import type { StoreProjectV1, Theme } from "@solara/project-schema";
import { Field, SectionHeader } from "../components/Ui";

const colorLabels: Record<keyof Theme["colors"], string> = {
  background: "Fondo",
  surface: "Superficie",
  text: "Texto",
  muted: "Texto secundario",
  accent: "Acento",
  accentText: "Texto sobre acento",
  border: "Borde",
};

export function ThemeEditor({
  project,
  onChange,
}: {
  project: StoreProjectV1;
  onChange(project: StoreProjectV1): void;
}) {
  const updateTheme = (theme: Theme) =>
    onChange({ ...project, theme, updatedAt: new Date().toISOString() });

  return (
    <section className="workspace-section">
      <SectionHeader
        title="Tema"
        description="Un sistema de tokens consistente para todos los módulos de la tienda."
      />
      <div className="theme-layout">
        <fieldset>
          <legend>
            <PaintBrush aria-hidden size={19} /> Color
          </legend>
          <Field label="Modo">
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
              <option value="dark">Oscuro</option>
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
        </fieldset>

        <fieldset>
          <legend>
            <TextT aria-hidden size={19} /> Tipografía
          </legend>
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
    </section>
  );
}
