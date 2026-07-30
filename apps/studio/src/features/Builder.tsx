import { ArrowDown, ArrowUp, Copy, Eye, EyeSlash, Plus, Swap, Trash } from "@phosphor-icons/react";
import {
  createModuleSection,
  moduleRegistry,
  type RegisteredModule,
  replaceModuleInSection,
} from "@solara/modules";
import type { StoreProjectV1, StoreSection } from "@solara/project-schema";
import { useEffect, useMemo, useState } from "react";
import { Button, EmptyState, Field, IconButton, SectionHeader } from "../components/Ui";

const slotLabels: Record<StoreSection["slot"], string> = {
  announcement: "Aviso",
  header: "Encabezado",
  hero: "Portada",
  catalog: "Catálogo",
  product: "Producto",
  content: "Contenido",
  trust: "Confianza",
  cart: "Carrito",
  footer: "Pie",
};

function availableModules(): RegisteredModule[] {
  return Object.values(moduleRegistry);
}

interface BuilderProps {
  project: StoreProjectV1;
  onChange(project: StoreProjectV1): void;
}

export function Builder({ project, onChange }: BuilderProps) {
  const modules = useMemo(availableModules, []);
  const [selectedId, setSelectedId] = useState(project.sections[0]?.id ?? "");
  const [slotToAdd, setSlotToAdd] = useState<StoreSection["slot"]>("content");
  const selected = project.sections.find((section) => section.id === selectedId);
  const selectedModule = modules.find((module) => module.manifest.id === selected?.moduleId);

  const replaceSections = (sections: StoreSection[]) => {
    onChange({ ...project, sections, updatedAt: new Date().toISOString() });
  };

  const updateSection = (id: string, update: (section: StoreSection) => StoreSection) => {
    replaceSections(
      project.sections.map((section) => (section.id === id ? update(section) : section)),
    );
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= project.sections.length) return;
    const sections = [...project.sections];
    const current = sections[index];
    const sibling = sections[target];
    if (!current || !sibling) return;
    sections[index] = sibling;
    sections[target] = current;
    replaceSections(sections);
  };

  const addSection = () => {
    const module = modules.find((candidate) => candidate.manifest.slots.includes(slotToAdd));
    if (!module) return;
    const section = createModuleSection({
      id: `section-${crypto.randomUUID()}` as StoreSection["id"],
      slot: slotToAdd,
      moduleId: module.manifest.id,
    });
    replaceSections([...project.sections, section]);
    setSelectedId(section.id);
  };

  const replaceModule = (moduleId: string) => {
    if (!selected) return;
    updateSection(selected.id, (section) => replaceModuleInSection(section, moduleId));
  };

  return (
    <section className="workspace-section builder">
      <SectionHeader
        title="Constructor"
        description="Ordená secciones y cambiá su módulo sin alterar el contenido compatible."
        actions={
          <div className="add-section">
            <select
              aria-label="Tipo de sección"
              value={slotToAdd}
              onChange={(event) => setSlotToAdd(event.target.value as StoreSection["slot"])}
            >
              {Object.entries(slotLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <Button variant="primary" icon={Plus} onClick={addSection}>
              Agregar sección
            </Button>
          </div>
        }
      />

      <div className="builder-grid">
        <ul className="section-stack" aria-label="Secciones de la tienda">
          {project.sections.map((section, index) => {
            const definition = modules.find((module) => module.manifest.id === section.moduleId);
            return (
              <li
                className="section-row"
                data-selected={section.id === selectedId}
                key={section.id}
              >
                <button
                  className="section-select"
                  type="button"
                  onClick={() => setSelectedId(section.id)}
                >
                  <span>{slotLabels[section.slot]}</span>
                  <strong>{definition?.manifest.name ?? section.moduleId}</strong>
                </button>
                <div className="section-row-actions">
                  <IconButton
                    icon={ArrowUp}
                    label="Mover arriba"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  />
                  <IconButton
                    icon={ArrowDown}
                    label="Mover abajo"
                    disabled={index === project.sections.length - 1}
                    onClick={() => move(index, 1)}
                  />
                  <IconButton
                    icon={section.enabled ? Eye : EyeSlash}
                    label={section.enabled ? "Ocultar sección" : "Mostrar sección"}
                    onClick={() =>
                      updateSection(section.id, (current) => ({
                        ...current,
                        enabled: !current.enabled,
                      }))
                    }
                  />
                  <IconButton
                    icon={Copy}
                    label="Duplicar sección"
                    onClick={() => {
                      const duplicate: StoreSection = {
                        ...structuredClone(section),
                        id: `section-${crypto.randomUUID()}` as StoreSection["id"],
                      };
                      const sections = [...project.sections];
                      sections.splice(index + 1, 0, duplicate);
                      replaceSections(sections);
                      setSelectedId(duplicate.id);
                    }}
                  />
                  <IconButton
                    icon={Trash}
                    label="Eliminar sección"
                    onClick={() => {
                      replaceSections(project.sections.filter((item) => item.id !== section.id));
                      setSelectedId(
                        project.sections.find((item) => item.id !== section.id)?.id ?? "",
                      );
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="inspector" aria-label="Inspector de sección">
          {!selected ? (
            <EmptyState
              icon={Swap}
              title="Seleccioná una sección"
              body="El inspector muestra contenido, módulo y movimiento de la sección activa."
            />
          ) : (
            <>
              <header>
                <span>{slotLabels[selected.slot]}</span>
                <h3>{selectedModule?.manifest.name ?? selected.moduleId}</h3>
                <p>{selectedModule?.manifest.description}</p>
              </header>

              <Field label="Módulo">
                <select
                  value={selected.moduleId}
                  onChange={(event) => replaceModule(event.target.value)}
                >
                  {modules
                    .filter((module) => module.manifest.slots.includes(selected.slot))
                    .map((module) => (
                      <option key={module.manifest.id} value={module.manifest.id}>
                        {module.manifest.name}
                      </option>
                    ))}
                </select>
              </Field>

              <fieldset>
                <legend>Contenido</legend>
                <SettingsInspector
                  key={`${selected.id}:${selected.moduleId}`}
                  values={selected.settings}
                  fields={selectedModule?.settingsFields ?? []}
                  schema={selectedModule?.settingsSchema}
                  project={project}
                  onChange={(settings) =>
                    updateSection(selected.id, (section) => ({ ...section, settings }))
                  }
                />
              </fieldset>

              <fieldset>
                <legend>Movimiento</legend>
                <Field label="Preset">
                  <select
                    value={selected.motion.preset}
                    onChange={(event) =>
                      updateSection(selected.id, (section) => ({
                        ...section,
                        motion: {
                          ...section.motion,
                          preset: event.target.value as StoreSection["motion"]["preset"],
                        },
                      }))
                    }
                  >
                    {[
                      "none",
                      "fade",
                      "fade-up",
                      "slide",
                      "scale",
                      "stagger",
                      "parallax",
                      "scroll-progress",
                      "layer-stack",
                    ].map((preset) => (
                      <option key={preset} value={preset}>
                        {preset}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={`Intensidad ${selected.motion.intensity}`}>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={selected.motion.intensity}
                    onChange={(event) =>
                      updateSection(selected.id, (section) => ({
                        ...section,
                        motion: { ...section.motion, intensity: Number(event.target.value) },
                      }))
                    }
                  />
                </Field>
                <div className="inspector-split">
                  <Field label="Duración">
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.05}
                      value={selected.motion.duration}
                      onChange={(event) =>
                        updateSection(selected.id, (section) => ({
                          ...section,
                          motion: { ...section.motion, duration: Number(event.target.value) },
                        }))
                      }
                    />
                  </Field>
                  <Field label="Distancia">
                    <input
                      type="number"
                      min={0}
                      max={160}
                      value={selected.motion.distance}
                      onChange={(event) =>
                        updateSection(selected.id, (section) => ({
                          ...section,
                          motion: { ...section.motion, distance: Number(event.target.value) },
                        }))
                      }
                    />
                  </Field>
                </div>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={selected.motion.once}
                    onChange={(event) =>
                      updateSection(selected.id, (section) => ({
                        ...section,
                        motion: { ...section.motion, once: event.target.checked },
                      }))
                    }
                  />
                  Ejecutar una vez
                </label>
              </fieldset>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

function SettingsInspector({
  values,
  fields,
  schema,
  project,
  onChange,
}: {
  values: Record<string, unknown>;
  fields: RegisteredModule["settingsFields"];
  schema: RegisteredModule["settingsSchema"] | undefined;
  project: StoreProjectV1;
  onChange(values: Record<string, unknown>): void;
}) {
  const [draft, setDraft] = useState(values);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(values);
    setErrors({});
  }, [values]);

  if (fields.length === 0) {
    return <p className="inspector-note">Este módulo no requiere configuración.</p>;
  }

  const setValue = (key: string, next: unknown) => {
    const candidate = { ...draft, [key]: next };
    setDraft(candidate);
    if (!schema) return;
    const result = schema.safeParse(candidate);
    if (result.success) {
      setErrors({});
      onChange(result.data as Record<string, unknown>);
      return;
    }
    setErrors(
      Object.fromEntries(
        result.error.issues.map((issue) => [String(issue.path[0] ?? key), issue.message]),
      ),
    );
  };

  return (
    <div className="settings-fields">
      {fields.map((field) => {
        const value = draft[field.key];
        const error = errors[field.key];
        const hint = error ?? field.description;
        if (field.type === "boolean") {
          return (
            <div key={field.key}>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) => setValue(field.key, event.target.checked)}
                />
                {field.label}
              </label>
              {error ? <small className="field-error">{error}</small> : null}
            </div>
          );
        }
        if (field.type === "number") {
          return (
            <Field label={field.label} {...(error ? { hint: error } : {})} key={field.key}>
              <input
                type="number"
                value={String(value ?? "")}
                min={field.min}
                max={field.max}
                step={field.step}
                aria-invalid={Boolean(error)}
                onChange={(event) => setValue(field.key, Number(event.target.value))}
              />
            </Field>
          );
        }
        if (field.type === "asset") {
          return (
            <Field label={field.label} {...(error ? { hint: error } : {})} key={field.key}>
              <select
                value={String(value ?? "")}
                aria-invalid={Boolean(error)}
                onChange={(event) => setValue(field.key, event.target.value)}
              >
                <option value="">Sin imagen</option>
                {project.assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </Field>
          );
        }
        if (field.type === "select") {
          return (
            <Field label={field.label} {...(error ? { hint: error } : {})} key={field.key}>
              <select
                value={String(value ?? "")}
                aria-invalid={Boolean(error)}
                onChange={(event) => setValue(field.key, event.target.value)}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          );
        }
        const text = String(value ?? "");
        return (
          <Field
            label={field.label}
            {...(hint ? { hint } : {})}
            key={field.key}
            className={error ? "field--error" : ""}
          >
            {field.type === "rich-text" ? (
              <textarea
                value={text}
                rows={4}
                placeholder={field.placeholder}
                aria-invalid={Boolean(error)}
                onChange={(event) => setValue(field.key, event.target.value)}
              />
            ) : (
              <input
                type={field.type === "url" ? "url" : "text"}
                value={text}
                placeholder={field.placeholder}
                aria-invalid={Boolean(error)}
                onChange={(event) => setValue(field.key, event.target.value)}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}
