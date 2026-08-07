/**
 * Constructor por secciones. Usa metadata declarada por ModuleDefinition para
 * generar el inspector y conserva compatibilidad entre módulos al reemplazar
 * una sección; cambiar esa regla afecta preview, historial y exportación.
 */
import { ArrowDown, ArrowUp, Copy, Eye, EyeSlash, Plus, Swap, Trash } from "@phosphor-icons/react";
import {
  createModuleSection,
  isAddableModule,
  moduleRegistry,
  type RegisteredModule,
  replaceModuleInSection,
} from "@solara/modules";
import type { StoreProjectV1, StoreSection } from "@solara/project-schema";
import { catalogModernTemplateManifest } from "@solara/project-schema/catalog-modern-guidance";
import { useEffect, useMemo, useState } from "react";
import { Button, EmptyState, Field, IconButton, SectionHeader } from "../components/Ui";
import { SettingsInspector } from "./builder/SettingsInspector";

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
  protectedBase?: boolean;
}

type EditablePageKind = StoreProjectV1["pages"][number]["kind"];

export function Builder({ project, onChange, protectedBase = false }: BuilderProps) {
  const allModules = useMemo(availableModules, []);
  const modules = useMemo(() => allModules.filter(isAddableModule), [allModules]);
  const [pageKind, setPageKind] = useState<EditablePageKind>("home");
  const [selectedId, setSelectedId] = useState(project.sections[0]?.id ?? "");
  const [slotToAdd, setSlotToAdd] = useState<StoreSection["slot"]>("content");
  const editablePage = project.pages.find((page) => page.kind === pageKind);
  const pageSections = pageKind === "home" ? project.sections : (editablePage?.sections ?? []);
  const selected = pageSections.find((section) => section.id === selectedId);
  const selectedModule = allModules.find((module) => module.manifest.id === selected?.moduleId);
  const isProtected = (section: StoreSection): boolean =>
    protectedBase &&
    pageKind === "home" &&
    catalogModernTemplateManifest.protectedSectionIds.includes(section.id);
  const replacementModules =
    selectedModule && !isAddableModule(selectedModule)
      ? [
          selectedModule,
          ...modules.filter((module) =>
            module.manifest.slots.includes(selected?.slot ?? "content"),
          ),
        ]
      : modules.filter((module) => module.manifest.slots.includes(selected?.slot ?? "content"));

  useEffect(() => {
    if (!pageSections.some((section) => section.id === selectedId)) {
      setSelectedId(pageSections[0]?.id ?? "");
    }
  }, [pageSections, selectedId]);

  const replaceSections = (sections: StoreSection[]) => {
    onChange({
      ...project,
      ...(pageKind === "home"
        ? { sections }
        : {
            pages: project.pages.map((page) =>
              page.kind === pageKind ? { ...page, sections } : page,
            ),
          }),
      updatedAt: new Date().toISOString(),
    });
  };

  const updateSection = (id: string, update: (section: StoreSection) => StoreSection) => {
    replaceSections(pageSections.map((section) => (section.id === id ? update(section) : section)));
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= pageSections.length) return;
    const sections = [...pageSections];
    const current = sections[index];
    const sibling = sections[target];
    if (!current || !sibling) return;
    if (protectedBase && pageKind === "home" && (isProtected(current) || isProtected(sibling))) {
      return;
    }
    sections[index] = sibling;
    sections[target] = current;
    replaceSections(sections);
  };

  const addSection = () => {
    if (protectedBase && pageKind === "home") return;
    const module = modules.find((candidate) => candidate.manifest.slots.includes(slotToAdd));
    if (!module) return;
    const section = createModuleSection({
      id: `section-${crypto.randomUUID()}` as StoreSection["id"],
      slot: slotToAdd,
      moduleId: module.manifest.id,
    });
    replaceSections([...pageSections, section]);
    setSelectedId(section.id);
  };

  const pageSlotLabels =
    pageKind === "home"
      ? Object.entries(slotLabels)
      : Object.entries(slotLabels).filter(([slot]) => ["catalog", "content"].includes(slot));

  const replaceModule = (moduleId: string) => {
    if (!selected || isProtected(selected)) return;
    updateSection(selected.id, (section) => replaceModuleInSection(section, moduleId));
  };

  return (
    <section className="workspace-section builder">
      <SectionHeader
        title="Constructor"
        description={
          protectedBase
            ? "La estructura base está protegida. Activá Modo avanzado para agregar o reordenar módulos."
            : "Ordená secciones y cambiá su módulo sin alterar el contenido compatible."
        }
        actions={
          <div className="add-section">
            <select
              aria-label="Página de edición"
              value={pageKind}
              onChange={(event) => {
                const next = event.target.value as EditablePageKind;
                setPageKind(next);
                const nextPage = project.pages.find((page) => page.kind === next);
                const nextSections =
                  next === "home" ? project.sections : (nextPage?.sections ?? []);
                setSelectedId(nextSections[0]?.id ?? "");
              }}
            >
              <option value="home">Home</option>
              <option value="about">Nosotros</option>
              <option value="contact">Contacto</option>
            </select>
            <select
              aria-label="Tipo de sección"
              value={slotToAdd}
              onChange={(event) => setSlotToAdd(event.target.value as StoreSection["slot"])}
            >
              {pageSlotLabels.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <Button
              variant="primary"
              icon={Plus}
              onClick={addSection}
              disabled={protectedBase && pageKind === "home"}
            >
              Agregar sección
            </Button>
          </div>
        }
      />

      <div className="builder-grid">
        <ul className="section-stack" aria-label="Secciones de la tienda">
          {pageSections.map((section, index) => {
            const definition = allModules.find((module) => module.manifest.id === section.moduleId);
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
                    disabled={index === 0 || isProtected(section)}
                    onClick={() => move(index, -1)}
                  />
                  <IconButton
                    icon={ArrowDown}
                    label="Mover abajo"
                    disabled={index === pageSections.length - 1 || isProtected(section)}
                    onClick={() => move(index, 1)}
                  />
                  <IconButton
                    icon={section.enabled ? Eye : EyeSlash}
                    label={section.enabled ? "Ocultar sección" : "Mostrar sección"}
                    disabled={isProtected(section)}
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
                    disabled={isProtected(section)}
                    onClick={() => {
                      const duplicate: StoreSection = {
                        ...structuredClone(section),
                        id: `section-${crypto.randomUUID()}` as StoreSection["id"],
                      };
                      const sections = [...pageSections];
                      sections.splice(index + 1, 0, duplicate);
                      replaceSections(sections);
                      setSelectedId(duplicate.id);
                    }}
                  />
                  <IconButton
                    icon={Trash}
                    label="Eliminar sección"
                    disabled={isProtected(section)}
                    onClick={() => {
                      replaceSections(pageSections.filter((item) => item.id !== section.id));
                      setSelectedId(pageSections.find((item) => item.id !== section.id)?.id ?? "");
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
              action={
                pageSections.length > 0 ? (
                  <Button
                    variant="primary"
                    icon={ArrowDown}
                    onClick={() => setSelectedId(pageSections[0]?.id ?? "")}
                  >
                    Seleccionar la primera sección
                  </Button>
                ) : undefined
              }
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
                  disabled={isProtected(selected)}
                  onChange={(event) => replaceModule(event.target.value)}
                >
                  {replacementModules.map((module, index) => (
                    <option key={module.manifest.id} value={module.manifest.id}>
                      {module.manifest.name}
                      {index === 0 && !isAddableModule(module) ? " (compatibilidad)" : ""}
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
