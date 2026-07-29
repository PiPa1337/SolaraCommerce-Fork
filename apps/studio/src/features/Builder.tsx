import { ArrowDown, ArrowUp, Copy, Eye, EyeSlash, Plus, Swap, Trash } from "@phosphor-icons/react";
import { moduleRegistry } from "@solara/modules";
import type { StoreProjectV1, StoreSection } from "@solara/project-schema";
import { useMemo, useState } from "react";
import { Button, EmptyState, Field, IconButton, SectionHeader } from "../components/Ui";

interface ModuleChoice {
  manifest: {
    id: string;
    name: string;
    description: string;
    slots: StoreSection["slot"][];
    compatibleSettings?: string[];
  };
  settingsSchema: {
    parse(value: unknown): Record<string, unknown>;
  };
  motionZones?: Array<{ id: string; label: string; allowedPresets: readonly string[] }>;
}

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

const settingLabels: Record<string, string> = {
  actionHref: "Destino de la acción",
  actionLabel: "Texto de la acción",
  body: "Contenido",
  cartLabel: "Texto del carrito",
  catalogHref: "Destino del catálogo",
  catalogLabel: "Texto del catálogo",
  checkoutLabel: "Texto para finalizar",
  contactTitle: "Título de contacto",
  deliveryNote: "Nota de entrega",
  deliveryTitle: "Título de entrega",
  emptyText: "Mensaje de carrito vacío",
  eyebrow: "Texto superior",
  imageId: "Imagen",
  imagePosition: "Posición de imagen",
  imageSide: "Lado de imagen",
  limit: "Cantidad máxima",
  linkHref: "Destino del enlace",
  linkLabel: "Texto del enlace",
  note: "Nota",
  returnsTitle: "Título de cambios",
  showCategories: "Mostrar categorías",
  showCompareAtPrice: "Mostrar precio anterior",
  showDescription: "Mostrar descripción",
  showPolicies: "Mostrar políticas",
  text: "Texto",
  title: "Título",
};

function availableModules(): ModuleChoice[] {
  const source: unknown = moduleRegistry;
  const values =
    source instanceof Map
      ? [...source.values()]
      : Array.isArray(source)
        ? source
        : typeof source === "object" && source !== null
          ? Object.values(source)
          : [];
  return values.filter(
    (candidate): candidate is ModuleChoice =>
      typeof candidate === "object" &&
      candidate !== null &&
      "manifest" in candidate &&
      "settingsSchema" in candidate,
  );
}

function defaultsFor(module: ModuleChoice): Record<string, unknown> {
  try {
    return module.settingsSchema.parse({});
  } catch {
    return {};
  }
}

function defaultMotion(): StoreSection["motion"] {
  return {
    preset: "none",
    intensity: 0,
    direction: "up",
    distance: 24,
    duration: 0.55,
    delay: 0,
    stagger: 0.08,
    easing: "cubic-bezier(.16,1,.3,1)",
    entryPoint: 0.25,
    once: true,
  };
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
    const section: StoreSection = {
      id: `section-${crypto.randomUUID()}` as StoreSection["id"],
      slot: slotToAdd,
      moduleId: module.manifest.id,
      enabled: true,
      settings: defaultsFor(module),
      motion: defaultMotion(),
    };
    replaceSections([...project.sections, section]);
    setSelectedId(section.id);
  };

  const replaceModule = (moduleId: string) => {
    if (!selected) return;
    const nextModule = modules.find((module) => module.manifest.id === moduleId);
    if (!nextModule) return;
    const defaults = defaultsFor(nextModule);
    const compatible = new Set(nextModule.manifest.compatibleSettings ?? Object.keys(defaults));
    const preserved = Object.fromEntries(
      Object.entries(selected.settings).filter(([key]) => compatible.has(key)),
    );
    updateSection(selected.id, (section) => ({
      ...section,
      moduleId,
      settings: { ...defaults, ...preserved },
    }));
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
                  values={selected.settings}
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
  project,
  onChange,
}: {
  values: Record<string, unknown>;
  project: StoreProjectV1;
  onChange(values: Record<string, unknown>): void;
}) {
  const entries = Object.entries(values);
  if (entries.length === 0) {
    return <p className="inspector-note">Este módulo no requiere configuración.</p>;
  }
  return (
    <div className="settings-fields">
      {entries.map(([key, value]) => {
        const label =
          settingLabels[key] ??
          key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
        const setValue = (next: unknown) => onChange({ ...values, [key]: next });
        if (typeof value === "boolean") {
          return (
            <label className="check-field" key={key}>
              <input
                type="checkbox"
                checked={value}
                onChange={(event) => setValue(event.target.checked)}
              />
              {label}
            </label>
          );
        }
        if (typeof value === "number") {
          return (
            <Field label={label} key={key}>
              <input
                type="number"
                value={value}
                onChange={(event) => setValue(Number(event.target.value))}
              />
            </Field>
          );
        }
        if (/imageId$/i.test(key)) {
          return (
            <Field label={label} key={key}>
              <select
                value={String(value ?? "")}
                onChange={(event) => setValue(event.target.value)}
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
        const text = String(value ?? "");
        return (
          <Field label={label} key={key}>
            {text.length > 90 || /body|description|text/i.test(key) ? (
              <textarea value={text} rows={4} onChange={(event) => setValue(event.target.value)} />
            ) : (
              <input value={text} onChange={(event) => setValue(event.target.value)} />
            )}
          </Field>
        );
      })}
    </div>
  );
}
