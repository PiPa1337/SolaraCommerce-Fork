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
import { applyMutation, createMutationRegistry } from "@solara/core";
import {
  createModuleSection,
  defaultSettingsForModule,
  isAddableModule,
  isLegacyModule,
  isModuleAvailableOnPage,
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
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
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
  id: string;
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
  id,
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
      id={id}
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
  onPreviewRouteChange?(route: string): void;
  protectedBase?: boolean;
  /** Estado de sesión del Modo avanzado (shell): muestra el indicador del Constructor. */
  advancedMode?: boolean;
  /** Desbloquea la estructura protegida activando el Modo avanzado (PR5-F1). */
  onEnableAdvanced?(): void;
}

type EditablePageKind = StoreProjectV1["pages"][number]["kind"];

type PendingSectionDelete = {
  id: StoreSection["id"];
  label: string;
};

type PendingSectionRestore = {
  id: StoreSection["id"];
  label: string;
};

type PendingModuleReplace = {
  id: StoreSection["id"];
  currentLabel: string;
  nextLabel: string;
  moduleId: string;
};

export function Builder({
  project,
  onChange,
  onPreviewRouteChange,
  protectedBase = false,
  advancedMode = false,
  onEnableAdvanced,
}: BuilderProps) {
  const allModules = useMemo(availableModules, []);
  const [pageKind, setPageKind] = useState<EditablePageKind>("home");
  const [selectedId, setSelectedId] = useState(project.sections[0]?.id ?? "");
  const [slotToAdd, setSlotToAdd] = useState<StoreSection["slot"]>("content");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingSectionDelete | null>(null);
  const [pendingRestore, setPendingRestore] = useState<PendingSectionRestore | null>(null);
  const [pendingModuleReplace, setPendingModuleReplace] = useState<PendingModuleReplace | null>(
    null,
  );
  const pickerId = useId();
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const lastPickerToggleAtRef = useRef(0);
  const reduceMotion = useReducedMotion();
  const editablePage = project.pages.find((page) => page.kind === pageKind);
  const pageSections = pageKind === "home" ? project.sections : (editablePage?.sections ?? []);
  const selected = pageSections.find((section) => section.id === selectedId);
  const selectedModule = allModules.find((module) => module.manifest.id === selected?.moduleId);
  const modules = useMemo(
    () =>
      allModules.filter((module) =>
        isModuleAvailableOnPage(module, pageKind, project.commerceTemplates.designFamily),
      ),
    [allModules, pageKind, project.commerceTemplates.designFamily],
  );
  const isProtected = (section: StoreSection): boolean =>
    protectedBase &&
    pageKind === "home" &&
    catalogModernTemplateManifest.protectedSectionIds.includes(section.id);
  const replacementModules =
    selectedModule &&
    !isModuleAvailableOnPage(selectedModule, pageKind, project.commerceTemplates.designFamily)
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

  const updateSectionSettings = (id: string, settings: Record<string, unknown>) => {
    // Mismo núcleo de mutaciones que el canal IA y el Canvas: valida campos
    // contra el settingsSchema del módulo y parsea el snapshot resultante.
    const applied = applyMutation(project, createMutationRegistry(), {
      type: "section.updateSettings",
      sectionId: id,
      settings,
    });
    const nextSection = applied.project.sections.find((section) => section.id === id);
    if (nextSection) updateSection(id, () => nextSection);
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
      ? Object.entries(slotLabels).filter(([slot]) => slot !== "product")
      : Object.entries(slotLabels).filter(([slot]) => ["catalog", "content"].includes(slot));

  const replaceModule = (sectionId: StoreSection["id"], moduleId: string) => {
    const section = pageSections.find((current) => current.id === sectionId);
    if (!section || isProtected(section)) return;
    updateSection(sectionId, (current) => replaceModuleInSection(current, moduleId));
  };

  const restoreDefaults = (sectionId: StoreSection["id"]) => {
    const section = pageSections.find((current) => current.id === sectionId);
    if (!section || isProtected(section)) return;
    updateSection(sectionId, (current) => ({
      ...current,
      settings: defaultSettingsForModule(current.moduleId),
    }));
  };

  const deleteSection = (sectionId: StoreSection["id"]) => {
    const index = pageSections.findIndex((section) => section.id === sectionId);
    if (index < 0) return;
    const nextSections = pageSections.filter((section) => section.id !== sectionId);
    // Mantener el contrato existente del editor: tras borrar, el inspector
    // salta a la primera sección restante, también cuando se elimina una
    // sección intermedia.
    const nextSelectedId = nextSections[0]?.id ?? "";
    replaceSections(nextSections);
    setSelectedId(nextSelectedId);
    requestAnimationFrame(() => {
      const focusTarget = nextSelectedId
        ? document.querySelector<HTMLElement>(
            `[data-section-select="${CSS.escape(nextSelectedId)}"]`,
          )
        : null;
      (
        focusTarget ?? document.querySelector<HTMLElement>('[aria-label="Página de edición"]')
      )?.focus();
    });
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
            {advancedMode ? (
              <output className="ui-badge ui-badge--accent">Modo avanzado activado</output>
            ) : null}
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
                onPreviewRouteChange?.(
                  next === "home" ? "/" : next === "about" ? "/nosotros/" : "/contacto/",
                );
                setSlotToAdd((current) => (allowedSlots.includes(current) ? current : "catalog"));
                setPickerOpen(false);
                setPickerQuery("");
                const nextPage = project.pages.find((page) => page.kind === next);
                const nextSections =
                  next === "home" ? project.sections : (nextPage?.sections ?? []);
                setSelectedId(nextSections[0]?.id ?? "");
              }}
            >
              <option value="home">Home</option>
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
              aria-haspopup="dialog"
              aria-controls={pickerOpen ? pickerId : undefined}
              onClick={() => {
                // Un doble click rápido no debe abrir y cerrar el picker en el
                // mismo instante: se ignora el segundo toggle inmediato.
                const now = Date.now();
                if (pickerOpen && now - lastPickerToggleAtRef.current < 350) return;
                lastPickerToggleAtRef.current = now;
                setPickerOpen((current) => !current);
                setPickerQuery("");
              }}
              disabled={protectedBase && pageKind === "home"}
            >
              Agregar sección
            </Button>
            {protectedBase && onEnableAdvanced ? (
              <Button variant="quiet" size="sm" onClick={onEnableAdvanced}>
                Desbloquear
              </Button>
            ) : null}
            {pickerOpen ? (
              <ModulePicker
                id={pickerId}
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
            const sectionLabelId = `section-row-label-${section.id}`;
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
                  data-section-select={section.id}
                  aria-pressed={section.id === selectedId}
                  aria-keyshortcuts="ArrowUp ArrowDown"
                  onClick={() => setSelectedId(section.id)}
                  onKeyDown={(event) => handleSectionHeaderKeyDown(event, index)}
                >
                  <span>{slotLabels[section.slot]}</span>
                  <strong id={sectionLabelId} title={definition?.manifest.name ?? section.moduleId}>
                    {definition?.manifest.name ?? section.moduleId}
                  </strong>
                </button>
                <div className="section-row-actions">
                  <IconButton
                    icon={ArrowUp}
                    aria-describedby={sectionLabelId}
                    label="Mover arriba"
                    disabled={index === 0 || isProtected(section)}
                    onClick={() => move(index, -1)}
                  />
                  <IconButton
                    icon={ArrowDown}
                    aria-describedby={sectionLabelId}
                    label="Mover abajo"
                    disabled={index === pageSections.length - 1 || isProtected(section)}
                    onClick={() => move(index, 1)}
                  />
                  <IconButton
                    icon={section.enabled ? Eye : EyeSlash}
                    aria-describedby={sectionLabelId}
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
                    aria-describedby={sectionLabelId}
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
                    aria-describedby={sectionLabelId}
                    label="Eliminar sección"
                    disabled={isProtected(section)}
                    onClick={() =>
                      setPendingDelete({
                        id: section.id,
                        label: definition?.manifest.name ?? section.moduleId,
                      })
                    }
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
                  onChange={(event) => {
                    if (event.target.value === selected.moduleId) return;
                    const target = replacementModules.find(
                      (module) => module.manifest.id === event.target.value,
                    );
                    if (!target) return;
                    setPendingModuleReplace({
                      id: selected.id,
                      currentLabel: selectedModule?.manifest.name ?? selected.moduleId,
                      nextLabel: target.manifest.name,
                      moduleId: target.manifest.id,
                    });
                  }}
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
                onClick={() =>
                  setPendingRestore({
                    id: selected.id,
                    label: selectedModule?.manifest.name ?? selected.moduleId,
                  })
                }
              >
                Restaurar valores por defecto
              </Button>

              <fieldset>
                <legend>Contenido</legend>
                {selected.enabled === false ? (
                  <output className="builder-section-hidden-note">
                    Esta sección está oculta: activala con «Mostrar sección» para verla en el
                    preview y en el sitio.
                  </output>
                ) : null}
                <SettingsInspector
                  key={`${selected.id}:${selected.moduleId}`}
                  values={selected.settings}
                  fields={selectedModule?.settingsFields ?? []}
                  schema={selectedModule?.settingsSchema}
                  project={project}
                  onChange={(settings) => updateSectionSettings(selected.id, settings)}
                  onProjectChange={onChange}
                  sectionId={selected.id}
                  moduleId={selectedModule?.manifest.id}
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
      {pendingDelete ? (
        <ConfirmDialog
          title="Eliminar sección"
          body={
            <>
              Se eliminará «{pendingDelete.label}» y su configuración del proyecto. Podés deshacerlo
              después desde la barra del editor.
            </>
          }
          confirmLabel="Eliminar sección"
          cancelLabel="Cancelar"
          danger
          onConfirm={() => {
            const sectionId = pendingDelete.id;
            setPendingDelete(null);
            requestAnimationFrame(() => deleteSection(sectionId));
          }}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
      {pendingRestore ? (
        <ConfirmDialog
          title="Restaurar valores por defecto"
          body={
            <>
              Se reemplazará toda la configuración de «{pendingRestore.label}» por sus valores
              iniciales. Podés deshacerlo después desde la barra del editor.
            </>
          }
          confirmLabel="Restaurar valores"
          cancelLabel="Cancelar"
          danger
          onConfirm={() => {
            const sectionId = pendingRestore.id;
            setPendingRestore(null);
            requestAnimationFrame(() => restoreDefaults(sectionId));
          }}
          onCancel={() => setPendingRestore(null)}
        />
      ) : null}
      {pendingModuleReplace ? (
        <ConfirmDialog
          title="Cambiar módulo de sección"
          danger
          confirmLabel="Cambiar módulo"
          body={
            <>
              Se cambiará «{pendingModuleReplace.currentLabel}» por «
              {pendingModuleReplace.nextLabel}». Los ajustes compatibles se conservarán; el resto
              volverá a los valores iniciales del nuevo módulo.
            </>
          }
          onConfirm={() => {
            const replacement = pendingModuleReplace;
            setPendingModuleReplace(null);
            requestAnimationFrame(() => replaceModule(replacement.id, replacement.moduleId));
          }}
          onCancel={() => setPendingModuleReplace(null)}
        />
      ) : null}
    </section>
  );
}
