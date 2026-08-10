/**
 * Constructor por secciones. Usa metadata declarada por ModuleDefinition para
 * generar el inspector y conserva compatibilidad entre módulos al reemplazar
 * una sección; cambiar esa regla afecta preview, historial y exportación.
 */
import {
  ArrowCounterClockwise,
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeSlash,
  Plus,
  Swap,
  Trash,
} from "@phosphor-icons/react";
import {
  createModuleSection,
  defaultSettingsForModule,
  isAddableModule,
  isLegacyModule,
  moduleRegistry,
  type RegisteredModule,
  replaceModuleInSection,
} from "@solara/modules";
import { type StoreProjectV1, type StoreSection, StoreSectionSchema } from "@solara/project-schema";
import { catalogModernTemplateManifest } from "@solara/project-schema/catalog-modern-guidance";
import { motion, useReducedMotion } from "motion/react";
import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  EmptyState,
  Field,
  IconButton,
  InlineError,
  SectionHeader,
} from "../components/Ui";
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

function formatIssuePaths(issues: Array<{ path: readonly PropertyKey[] }>): string {
  return [...new Set(issues.map((issue) => issue.path.join(".") || "settings"))].join(", ");
}

interface ModulePickerProps {
  modules: RegisteredModule[];
  slot: StoreSection["slot"];
  query: string;
  pickerRef: RefObject<HTMLDivElement | null>;
  onQueryChange(query: string): void;
  onPick(module: RegisteredModule): void;
  onClose(): void;
}

/**
 * Picker de módulos: búsqueda por nombre/descripción, agrupado por familia y
 * estado de compatibilidad de slot explícito. Lista los módulos agregables;
 * los legacy sólo son reemplazos (compatibilidad) y no se ofrecen como nuevos.
 */
function ModulePicker({
  modules,
  slot,
  query,
  pickerRef,
  onQueryChange,
  onPick,
  onClose,
}: ModulePickerProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      modules.filter(
        (module) =>
          normalized.length === 0 ||
          `${module.manifest.name} ${module.manifest.description}`
            .toLowerCase()
            .includes(normalized),
      ),
    [modules, normalized],
  );
  const groups = useMemo(() => {
    const modern = filtered.filter((module) => !isLegacyModule(module));
    const legacy = filtered.filter(isLegacyModule);
    return [
      ...(modern.length > 0 ? [{ label: "Nuevas · Catalog Modern", modules: modern }] : []),
      ...(legacy.length > 0 ? [{ label: "Legacy · Compatibilidad", modules: legacy }] : []),
    ];
  }, [filtered]);

  // Trampa de Tab del picker: mismo patrón que trapConflictFocus en Studio.tsx,
  // pero con todos los focables (input de búsqueda + opciones habilitadas).
  const trapPickerFocus = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "Tab" || !pickerRef.current) return;
    const focusable = Array.from(
      pickerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    });
    if (focusable.length === 0) return;
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={pickerRef}
      className="module-picker"
      data-testid="ui-module-picker"
      role="dialog"
      aria-modal="true"
      aria-label="Elegir módulo de sección"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
        trapPickerFocus(event);
      }}
    >
      <label className="module-picker__search">
        <span className="visually-hidden">Buscar módulo</span>
        <input
          data-testid="ui-module-search"
          type="search"
          placeholder="Buscar módulo por nombre"
          autoComplete="off"
          ref={searchRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      {filtered.length === 0 ? (
        <p className="module-picker__empty">No hay módulos que coincidan con «{query}».</p>
      ) : (
        <ul className="module-picker__list">
          {groups.map((group) => (
            <li className="module-picker__group" key={group.label}>
              <span className="module-picker__group-label">{group.label}</span>
              <ul className="module-picker__items">
                {group.modules.map((module) => {
                  const compatible = module.manifest.slots.includes(slot);
                  return (
                    <li key={module.manifest.id}>
                      <button
                        type="button"
                        className="module-picker__option"
                        data-testid="ui-module-option"
                        disabled={!compatible}
                        onClick={() => onPick(module)}
                      >
                        <strong style={{ minWidth: 0 }} title={module.manifest.name}>
                          {module.manifest.name}
                        </strong>
                        <small style={{ minWidth: 0 }} title={module.manifest.description}>
                          {module.manifest.description}
                        </small>
                        <span className="module-picker__meta">
                          <span
                            className={`module-picker__badge${isLegacyModule(module) ? "" : " module-picker__badge--new"}`}
                          >
                            {isLegacyModule(module) ? "Compatibilidad" : "Nuevo"}
                          </span>
                          {compatible ? (
                            module.manifest.slots.map((compatibleSlot) => (
                              <span className="module-picker__slot-chip" key={compatibleSlot}>
                                {slotLabels[compatibleSlot]}
                              </span>
                            ))
                          ) : (
                            <span className="module-picker__hint">
                              No compatible con «{slotLabels[slot]}»
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <Button variant="quiet" size="sm" data-testid="ui-module-picker-cancel" onClick={onClose}>
        Cancelar
      </Button>
    </div>
  );
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
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

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setPickerQuery("");
    requestAnimationFrame(() => addButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (pickerRef.current?.contains(event.target as Node)) return;
      if (addButtonRef.current?.contains(event.target as Node)) return;
      closePicker();
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [closePicker, pickerOpen]);

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

  const addSectionWith = (module: RegisteredModule) => {
    if (protectedBase && pageKind === "home") return;
    if (!module.manifest.slots.includes(slotToAdd)) return;
    const section = createModuleSection({
      id: `section-${crypto.randomUUID()}` as StoreSection["id"],
      slot: slotToAdd,
      moduleId: module.manifest.id,
    });
    replaceSections([...pageSections, section]);
    setSelectedId(section.id);
    closePicker();
  };

  const handleSectionHeaderKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      move(index, -1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      move(index, 1);
    }
  };

  const pageSlotLabels =
    pageKind === "home"
      ? Object.entries(slotLabels)
      : Object.entries(slotLabels).filter(([slot]) => ["catalog", "content"].includes(slot));

  const replaceModule = (moduleId: string) => {
    if (!selected || isProtected(selected)) return;
    updateSection(selected.id, (section) => replaceModuleInSection(section, moduleId));
  };

  const restoreDefaults = () => {
    if (!selected || isProtected(selected) || !selectedModule) return;
    updateSection(selected.id, (section) => ({
      ...section,
      settings: defaultSettingsForModule(selectedModule.manifest.id),
    }));
  };

  const savedSettingsError = useMemo(() => {
    if (!selected || !selectedModule) return "";
    const settingsResult = selectedModule.settingsSchema.safeParse(selected.settings);
    if (!settingsResult.success) return formatIssuePaths(settingsResult.error.issues);
    // Los controles de movimiento commitean valores sin recorte previo; un
    // valor fuera de rango (p. ej. distancia > 160) vuelve inválida la sección
    // completa y debe aparecer en el mismo panel de error de esquema.
    const sectionResult = StoreSectionSchema.safeParse(selected);
    return sectionResult.success ? "" : formatIssuePaths(sectionResult.error.issues);
  }, [selected, selectedModule]);

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
                // En páginas secundarias sólo existen los slots catalog/content;
                // si el valor previo (elegido en Home) no está disponible, se
                // recorta al primer slot válido (catalog) para que el select
                // mostrado coincida con el estado.
                const allowedSlots = (Object.keys(slotLabels) as StoreSection["slot"][]).filter(
                  (slot) => next === "home" || slot === "catalog" || slot === "content",
                );
                setPageKind(next);
                setSlotToAdd((current) => (allowedSlots.includes(current) ? current : "catalog"));
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
              ref={addButtonRef}
              variant="primary"
              icon={Plus}
              aria-expanded={pickerOpen}
              onClick={() => {
                setPickerOpen((current) => !current);
                setPickerQuery("");
              }}
              disabled={protectedBase && pageKind === "home"}
            >
              Agregar sección
            </Button>
            {pickerOpen ? (
              <ModulePicker
                modules={modules}
                slot={slotToAdd}
                query={pickerQuery}
                pickerRef={pickerRef}
                onQueryChange={setPickerQuery}
                onPick={addSectionWith}
                onClose={closePicker}
              />
            ) : null}
          </div>
        }
      />

      <div className="builder-grid">
        <ul className="section-stack" aria-label="Secciones de la tienda">
          {pageSections.map((section, index) => {
            const definition = allModules.find((module) => module.manifest.id === section.moduleId);
            return (
              <motion.li
                className="section-row"
                data-selected={section.id === selectedId}
                key={section.id}
                layout
                transition={
                  reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }
                }
              >
                <button
                  className="section-select"
                  type="button"
                  aria-keyshortcuts="ArrowUp ArrowDown"
                  onClick={() => setSelectedId(section.id)}
                  onKeyDown={(event) => handleSectionHeaderKeyDown(event, index)}
                >
                  <span>{slotLabels[section.slot]}</span>
                  <strong title={definition?.manifest.name ?? section.moduleId}>
                    {definition?.manifest.name ?? section.moduleId}
                  </strong>
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
              </motion.li>
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

              {savedSettingsError ? (
                <div data-testid="ui-section-schema-error">
                  <InlineError>
                    La configuración guardada de esta sección no es válida ({savedSettingsError}).
                    Corregí los campos marcados en el inspector para volver a guardar con valores
                    válidos.
                  </InlineError>
                </div>
              ) : null}

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

              <Button
                variant="quiet"
                size="sm"
                icon={ArrowCounterClockwise}
                disabled={isProtected(selected)}
                data-testid="ui-restore-defaults"
                onClick={restoreDefaults}
              >
                Restaurar valores por defecto
              </Button>

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
