import { ArrowDown, ArrowUp, Copy, Eye, EyeSlash, Plus, Swap, Trash } from "@phosphor-icons/react";
import type { RepeaterItemField } from "@solara/modules";
import {
  createModuleSection,
  isAddableModule,
  moduleRegistry,
  type RegisteredModule,
  replaceModuleInSection,
} from "@solara/modules";
import type { StoreProjectV1, StoreSection } from "@solara/project-schema";
import { catalogModernTemplateManifest } from "@solara/project-schema/catalog-modern-guidance";
import { useEffect, useId, useMemo, useState } from "react";
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
  const [rawArrays, setRawArrays] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(values);
    setErrors({});
    setRawArrays({});
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
      setRawArrays((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
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
          const acceptsVideo = field.key.toLowerCase().includes("video");
          return (
            <Field label={field.label} {...(error ? { hint: error } : {})} key={field.key}>
              <select
                value={String(value ?? "")}
                aria-invalid={Boolean(error)}
                onChange={(event) => setValue(field.key, event.target.value)}
              >
                <option value="">Sin imagen</option>
                {!acceptsVideo
                  ? project.assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name}
                      </option>
                    ))
                  : null}
                {acceptsVideo && project.videos.length > 0 ? (
                  <optgroup label="Videos">
                    {project.videos.map((video) => (
                      <option key={video.id} value={video.id}>
                        {video.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
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
        if (field.type === "array") {
          if (field.key === "slides") {
            return (
              <HeroSlidesEditor
                key={field.key}
                value={value}
                project={project}
                {...(error ? { error } : {})}
                onChange={(next) => setValue(field.key, next)}
              />
            );
          }
          return (
            <Field label={field.label} {...(hint ? { hint } : {})} key={field.key}>
              <textarea
                value={rawArrays[field.key] ?? JSON.stringify(value ?? [], null, 2)}
                rows={6}
                aria-invalid={Boolean(error)}
                onChange={(event) => {
                  try {
                    const parsed = JSON.parse(event.target.value);
                    setValue(field.key, parsed);
                  } catch {
                    setDraft((current) => ({ ...current, [field.key]: event.target.value }));
                    setRawArrays((current) => ({ ...current, [field.key]: event.target.value }));
                    setErrors((current) => ({ ...current, [field.key]: "JSON inválido." }));
                  }
                }}
              />
            </Field>
          );
        }
        if (field.type === "repeater") {
          return (
            <RepeaterEditor
              key={field.key}
              label={field.label}
              value={value}
              fields={field.fields}
              {...(field.minItems === undefined ? {} : { minItems: field.minItems })}
              {...(field.maxItems === undefined ? {} : { maxItems: field.maxItems })}
              {...(field.itemLabelKey === undefined ? {} : { itemLabelKey: field.itemLabelKey })}
              {...(error === undefined ? {} : { error })}
              project={project}
              onChange={(next) => setValue(field.key, next)}
            />
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

function RepeaterEditor({
  label,
  value,
  fields,
  minItems,
  maxItems,
  itemLabelKey,
  error,
  project,
  onChange,
}: {
  label: string;
  value: unknown;
  fields: readonly RepeaterItemField[];
  minItems?: number;
  maxItems?: number;
  itemLabelKey?: string;
  error?: string;
  project: StoreProjectV1;
  onChange(next: unknown[]): void;
}) {
  const items = Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object"),
      )
    : [];
  const defaults = () =>
    Object.fromEntries(
      fields.map((field) => [
        field.key,
        field.type === "boolean"
          ? false
          : field.type === "number"
            ? (field.min ?? 0)
            : field.type === "select"
              ? (field.options?.[0]?.value ?? "")
              : field.key === "id"
                ? `item-${crypto.randomUUID()}`
                : field.key === itemLabelKey || field.key === "title"
                  ? "Nuevo elemento"
                  : field.key === "author"
                    ? "Nueva persona"
                    : field.key === "body"
                      ? "Texto editable"
                      : field.key === "categoryId"
                        ? (project.categories[0]?.id ?? "")
                        : field.key === "actionLabel"
                          ? "Ver más"
                          : field.key === "actionHref"
                            ? "/"
                            : "",
      ]),
    );
  const update = (index: number, key: string, next: unknown) =>
    onChange(
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: next } : item)),
    );
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const current = next[index];
    const sibling = next[target];
    if (!current || !sibling) return;
    next[index] = sibling;
    next[target] = current;
    onChange(next);
  };
  return (
    <fieldset className="repeater-editor">
      <legend>{label}</legend>
      {items.map((item, index) => (
        <article className="repeater-editor__item" key={String(item.id ?? index)}>
          <header>
            <strong>
              {String((itemLabelKey && item[itemLabelKey]) || `${label} ${index + 1}`)}
            </strong>
            <div>
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Subir elemento"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label="Bajar elemento"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                disabled={items.length <= (minItems ?? 0)}
                aria-label="Eliminar elemento"
              >
                Eliminar
              </button>
            </div>
          </header>
          {fields.map((field) => {
            const current = item[field.key];
            if (field.type === "boolean") {
              return (
                <label className="check-field" key={field.key}>
                  <input
                    type="checkbox"
                    checked={Boolean(current)}
                    onChange={(event) => update(index, field.key, event.target.checked)}
                  />
                  {field.label}
                </label>
              );
            }
            if (field.type === "asset") {
              return (
                <Field label={field.label} key={field.key}>
                  <select
                    value={String(current ?? "")}
                    onChange={(event) => update(index, field.key, event.target.value)}
                  >
                    <option value="">Sin asset</option>
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
                <Field label={field.label} key={field.key}>
                  <select
                    value={String(current ?? "")}
                    onChange={(event) => update(index, field.key, event.target.value)}
                  >
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
              );
            }
            return (
              <Field label={field.label} key={field.key}>
                <input
                  type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
                  value={String(current ?? "")}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  onChange={(event) =>
                    update(
                      index,
                      field.key,
                      field.type === "number" ? Number(event.target.value) : event.target.value,
                    )
                  }
                />
              </Field>
            );
          })}
        </article>
      ))}
      <button
        type="button"
        className="secondary-button"
        onClick={() => onChange([...items, defaults()])}
        disabled={maxItems !== undefined && items.length >= maxItems}
      >
        Agregar elemento
      </button>
      {error ? <small className="field-error">{error}</small> : null}
    </fieldset>
  );
}

type HeroSlideDraft = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
  imageId: string;
};

function slideValue(slide: unknown, key: keyof HeroSlideDraft): string {
  if (!slide || typeof slide !== "object") return "";
  const value = (slide as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function normalizeSlide(slide: unknown, index: number): HeroSlideDraft {
  return {
    id: slideValue(slide, "id") || `slide-${index + 1}`,
    eyebrow: slideValue(slide, "eyebrow"),
    title: slideValue(slide, "title"),
    body: slideValue(slide, "body"),
    actionLabel: slideValue(slide, "actionLabel") || "Ver colección",
    actionHref: slideValue(slide, "actionHref") || "/",
    imageId: slideValue(slide, "imageId"),
  };
}

function HeroSlidesEditor({
  value,
  project,
  error,
  onChange,
}: {
  value: unknown;
  project: StoreProjectV1;
  error?: string;
  onChange(next: HeroSlideDraft[]): void;
}) {
  const titleId = useId();
  const slides = Array.isArray(value) ? value.map(normalizeSlide) : [];
  const updateSlide = (index: number, key: keyof HeroSlideDraft, next: string) => {
    onChange(
      slides.map((slide, slideIndex) => (slideIndex === index ? { ...slide, [key]: next } : slide)),
    );
  };
  const moveSlide = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    const current = next[index];
    const sibling = next[target];
    if (!current || !sibling) return;
    next[index] = sibling;
    next[target] = current;
    onChange(next);
  };
  const addSlide = () =>
    onChange([
      ...slides,
      {
        id: `slide-${crypto.randomUUID()}`,
        eyebrow: "",
        title: "Nueva diapositiva",
        body: "",
        actionLabel: "Ver colección",
        actionHref: "/",
        imageId: "",
      },
    ]);

  return (
    <section className="slides-editor" aria-labelledby={titleId}>
      <h4 className="visually-hidden" id={titleId}>
        Editor visual de slides
      </h4>
      <div className="slides-editor__header">
        <div>
          <strong>Slides del carrusel</strong>
          <small>{slides.length} configurados</small>
        </div>
        <Button icon={Plus} onClick={addSlide}>
          Agregar slide
        </Button>
      </div>
      {error ? <small className="field-error">{error}</small> : null}
      {slides.length === 0 ? (
        <p className="inspector-note">Agregá al menos dos slides para activar el carrusel.</p>
      ) : (
        <div className="slides-editor__list">
          {slides.map((slide, index) => (
            <article className="slide-card" key={slide.id}>
              <header className="slide-card__header">
                <strong>Slide {index + 1}</strong>
                <div className="slide-card__actions">
                  <IconButton
                    icon={ArrowUp}
                    label="Mover slide arriba"
                    disabled={index === 0}
                    onClick={() => moveSlide(index, -1)}
                  />
                  <IconButton
                    icon={ArrowDown}
                    label="Mover slide abajo"
                    disabled={index === slides.length - 1}
                    onClick={() => moveSlide(index, 1)}
                  />
                  <IconButton
                    icon={Copy}
                    label="Duplicar slide"
                    onClick={() =>
                      onChange([
                        ...slides.slice(0, index + 1),
                        { ...slide, id: `slide-${crypto.randomUUID()}` },
                        ...slides.slice(index + 1),
                      ])
                    }
                  />
                  <IconButton
                    icon={Trash}
                    label="Eliminar slide"
                    onClick={() =>
                      onChange(slides.filter((_item, slideIndex) => slideIndex !== index))
                    }
                  />
                </div>
              </header>
              <Field label="Imagen">
                <select
                  value={slide.imageId}
                  aria-label={`Imagen del slide ${index + 1}`}
                  onChange={(event) => updateSlide(index, "imageId", event.target.value)}
                >
                  <option value="">Sin imagen</option>
                  {project.assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Antetítulo">
                <input
                  value={slide.eyebrow}
                  aria-label={`Antetítulo del slide ${index + 1}`}
                  onChange={(event) => updateSlide(index, "eyebrow", event.target.value)}
                />
              </Field>
              <Field label="Título">
                <input
                  value={slide.title}
                  aria-label={`Título del slide ${index + 1}`}
                  onChange={(event) => updateSlide(index, "title", event.target.value)}
                />
              </Field>
              <Field label="Texto">
                <textarea
                  value={slide.body}
                  rows={3}
                  aria-label={`Texto del slide ${index + 1}`}
                  onChange={(event) => updateSlide(index, "body", event.target.value)}
                />
              </Field>
              <div className="inspector-split">
                <Field label="Texto del CTA">
                  <input
                    value={slide.actionLabel}
                    aria-label={`Texto del CTA del slide ${index + 1}`}
                    onChange={(event) => updateSlide(index, "actionLabel", event.target.value)}
                  />
                </Field>
                <Field label="Destino del CTA">
                  <input
                    type="url"
                    value={slide.actionHref}
                    aria-label={`Destino del CTA del slide ${index + 1}`}
                    onChange={(event) => updateSlide(index, "actionHref", event.target.value)}
                  />
                </Field>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
