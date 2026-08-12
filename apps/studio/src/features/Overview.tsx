/** Editor de identidad, contacto, navegación y copy que completa la plantilla base. */

import type { Icon } from "@phosphor-icons/react";
import {
  ArrowDown,
  ArrowUp,
  Article,
  CaretDown,
  CheckCircle,
  FloppyDisk,
  Globe,
  List,
  Storefront,
  Trash,
  WhatsappLogo,
} from "@phosphor-icons/react";
import type { StoreProjectV1 } from "@solara/project-schema";
import { catalogModernPhoneValue } from "@solara/project-schema";
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { StatusBadge, Toggle } from "../components/primitives";
import { useToast } from "../components/Toast";
import { Button, Field, IconButton, SectionHeader } from "../components/Ui";

const PHONE_PATTERN = /^\d{8,15}$/;

type PendingNavigationDelete =
  | {
      kind: "item";
      itemId: string;
      label: string;
      childCount: number;
    }
  | {
      kind: "child";
      itemId: string;
      childId: string;
      label: string;
      parentLabel: string;
    };

/** Clave de localStorage del estado plegado del Resumen (R8-B1): por tienda,
 *  con el mismo patrón que el pane del editor en Studio.tsx. */
const COLLAPSED_SECTIONS_KEY = "solara-resumen-collapsed";

function readCollapsedSections(projectId: string): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(`${COLLAPSED_SECTIONS_KEY}:${projectId}`);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((value): value is string => typeof value === "string"));
    }
  } catch {
    // Almacenamiento no disponible o contenido inválido: secciones abiertas.
  }
  return new Set();
}

function writeCollapsedSections(projectId: string, sections: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(
      `${COLLAPSED_SECTIONS_KEY}:${projectId}`,
      JSON.stringify([...sections]),
    );
  } catch {
    // Almacenamiento no disponible: el pliegue queda sólo para la sesión.
  }
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Destino de navegación: ruta interna (ej. /contacto/, nunca //) o URL http(s), mailto o tel.
 *  Espeja la validación del schema (`validateHref`): mailto:/tel: sólo si el commit lo acepta. */
function isValidDestination(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  try {
    return ["http:", "https:", "mailto:", "tel:"].includes(new URL(trimmed).protocol);
  } catch {
    return false;
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function destinationError(href: string): string | undefined {
  return href.trim() !== "" && !isValidDestination(href)
    ? "Usá http(s) o una ruta interna (ej. /contacto/)."
    : undefined;
}

/** Sección plegable del formulario (T4.2): encabezado botón + panel con animación. */
function AccordionSection({
  sectionKey,
  label,
  icon: IconComponent,
  badge,
  collapsed,
  onToggle,
  children,
}: {
  sectionKey: string;
  label: string;
  icon: Icon;
  badge?: ReactNode;
  collapsed: boolean;
  onToggle(): void;
  children: ReactNode;
}) {
  const toggleId = useId();
  const panelId = useId();
  return (
    <section
      className="overview-accordion"
      data-testid="ui-accordion"
      data-accordion-id={sectionKey}
    >
      <h3 className="overview-accordion__heading">
        <button
          type="button"
          id={toggleId}
          className="overview-accordion__toggle"
          aria-expanded={!collapsed}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <IconComponent aria-hidden size={19} />
          <span>{label}</span>
          {badge}
          <CaretDown aria-hidden size={16} className="overview-accordion__caret" />
        </button>
      </h3>
      <section
        className="overview-accordion__panel"
        id={panelId}
        aria-labelledby={toggleId}
        hidden={collapsed}
      >
        {children}
      </section>
    </section>
  );
}

export function Overview({
  project,
  onChange,
}: {
  project: StoreProjectV1;
  onChange(project: StoreProjectV1): void;
}) {
  const [pendingNavDelete, setPendingNavDelete] = useState<PendingNavigationDelete | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<ReadonlySet<string>>(() =>
    readCollapsedSections(project.id),
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({});
  const [unsaved, setUnsaved] = useState(false);
  const unsavedTimer = useRef<number | undefined>(undefined);
  /** Último campo que SÍ commiteó (no el último editado): sólo su borrador se
   *  limpia cuando el proyecto cambia. Un borrador inválido sin commitear no
   *  debe ser destruido por un commit de otro campo. */
  const lastCommittedFieldRef = useRef<string | null>(null);
  const { success } = useToast();

  /** Valor visible de un campo validado: el borrador local prima sobre el proyecto. */
  const fieldValue = (key: string, projectValue: string) => fieldDrafts[key] ?? projectValue;
  /** Guarda el borrador local y commitea sólo cuando es válido para el schema. */
  const updateField = (
    key: string,
    next: string,
    isValid: (value: string) => boolean,
    onCommit: (value: string) => void,
  ) => {
    markUnsaved();
    setFieldDrafts((current) => ({ ...current, [key]: next }));
    if (isValid(next)) {
      lastCommittedFieldRef.current = key;
      onCommit(next);
    }
  };

  const phoneDisplay = fieldValue("phone", catalogModernPhoneValue(project.whatsapp.phone));
  const phoneMissing = phoneDisplay === "";
  const phoneInvalid = phoneDisplay !== "" && !PHONE_PATTERN.test(phoneDisplay);
  const phoneError = phoneMissing
    ? "Falta completar el número de WhatsApp."
    : phoneInvalid
      ? "Usá entre 8 y 15 dígitos con código de país y área."
      : undefined;
  const legalNameDisplay = fieldValue("legalName", project.identity.legalName);
  const legalNameError = legalNameDisplay.trim() === "" ? "Completá la razón social." : undefined;
  const urlDisplay = fieldValue("baseUrl", project.baseUrl);
  const urlError =
    urlDisplay.trim() === ""
      ? "Completá la URL pública."
      : !isValidUrl(urlDisplay)
        ? "Ingresá una URL válida con http(s)."
        : undefined;
  const nameDisplay = fieldValue("name", project.name);
  const nameError = nameDisplay.trim() === "" ? "Completá el nombre de la tienda." : undefined;
  const descriptionError =
    project.identity.description.trim() === "" ? "Completá la descripción de la marca." : undefined;
  const catalogLabelDisplay = fieldValue("catalogLabel", project.navigation.catalogLabel);
  const catalogLabelError =
    catalogLabelDisplay.trim() === "" ? "Completá el nombre del catálogo." : undefined;
  const emailDisplay = fieldValue("email", project.identity.email);
  const emailError =
    emailDisplay.trim() !== "" && !isValidEmail(emailDisplay)
      ? "Ingresá un email válido."
      : undefined;

  const markUnsaved = useCallback(() => {
    setUnsaved(true);
    window.clearTimeout(unsavedTimer.current);
    unsavedTimer.current = window.setTimeout(() => setUnsaved(false), 1200);
  }, []);

  useEffect(() => () => window.clearTimeout(unsavedTimer.current), []);

  /* biome-ignore lint/correctness/useExhaustiveDependencies: al cambiar el proyecto (commit o undo) limpiar sólo el borrador del campo que commiteó, no todos ni el último editado. */
  useEffect(() => {
    const key = lastCommittedFieldRef.current;
    lastCommittedFieldRef.current = null;
    if (!key) return;
    const withoutKey = (current: Record<string, string>) =>
      key in current
        ? Object.fromEntries(Object.entries(current).filter(([draftKey]) => draftKey !== key))
        : current;
    setDrafts(withoutKey);
    setFieldDrafts(withoutKey);
  }, [project.updatedAt]);

  const toggleSection = (sectionId: string) =>
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      writeCollapsedSections(project.id, next);
      return next;
    });

  const deleteNavItem = (itemId: string) => {
    updateNavigation({
      items: project.navigation.items.filter((current) => current.id !== itemId),
    });
    success("Enlace de navegación eliminado");
  };
  const commit = (patch: Partial<StoreProjectV1>) => {
    markUnsaved();
    onChange({ ...project, ...patch, updatedAt: new Date().toISOString() });
  };
  const updateNavigation = (patch: Partial<StoreProjectV1["navigation"]>) =>
    commit({ navigation: { ...project.navigation, ...patch } });
  const updateNavigationItem = (
    itemId: string,
    patch: Partial<StoreProjectV1["navigation"]["items"][number]>,
  ) =>
    updateNavigation({
      items: project.navigation.items.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
    });
  const confirmNavigationDelete = () => {
    if (!pendingNavDelete) return;
    if (pendingNavDelete.kind === "item") {
      deleteNavItem(pendingNavDelete.itemId);
    } else {
      const parent = project.navigation.items.find((item) => item.id === pendingNavDelete.itemId);
      if (parent) {
        updateNavigationItem(parent.id, {
          children: (parent.children ?? []).filter(
            (child) => child.id !== pendingNavDelete.childId,
          ),
        });
        success("Subenlace de navegación eliminado");
      }
    }
    setPendingNavDelete(null);
  };
  const moveNavigationItem = (itemId: string, delta: -1 | 1) => {
    const index = project.navigation.items.findIndex((item) => item.id === itemId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= project.navigation.items.length) return;
    const items = [...project.navigation.items];
    const current = items[index];
    const next = items[target];
    if (!current || !next) return;
    items[index] = next;
    items[target] = current;
    updateNavigation({ items });
  };
  const moveNavigationChild = (itemId: string, childId: string, delta: -1 | 1) => {
    const parent = project.navigation.items.find((item) => item.id === itemId);
    if (!parent?.children) return;
    const index = parent.children.findIndex((child) => child.id === childId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= parent.children.length) return;
    const children = [...parent.children];
    const current = children[index];
    const next = children[target];
    if (!current || !next) return;
    children[index] = next;
    children[target] = current;
    updateNavigationItem(itemId, { children });
  };
  const updatePage = (pageId: string, patch: Partial<StoreProjectV1["pages"][number]>) =>
    commit({
      pages: project.pages.map((page) => (page.id === pageId ? { ...page, ...patch } : page)),
    });

  /** Input con borrador local: edita sin commitear y confirma al salir sólo si el destino es válido. */
  const destinationInput = (key: string, value: string, onCommit: (next: string) => void) => (
    <input
      type="url"
      value={drafts[key] ?? value}
      onChange={(event) => {
        setDrafts((current) => ({ ...current, [key]: event.target.value }));
      }}
      onBlur={() => {
        const next = drafts[key] ?? value;
        if (next !== value && destinationError(next) === undefined) {
          lastCommittedFieldRef.current = key;
          onCommit(next);
        }
      }}
    />
  );

  const saveIndicator = (extraClass = "", testId: string | null = null) => (
    <output
      className={`overview-save-indicator${unsaved ? " overview-save-indicator--unsaved" : ""} ${extraClass}`}
      aria-live="polite"
      {...(testId ? { "data-testid": testId } : {})}
    >
      {unsaved ? <FloppyDisk aria-hidden size={15} /> : <CheckCircle aria-hidden size={15} />}
      <span>{unsaved ? "Sin guardar" : "Cambios guardados"}</span>
    </output>
  );

  return (
    <section className="workspace-section">
      <SectionHeader
        title="Resumen"
        description="Datos comerciales compartidos por la tienda, el pedido y la exportación."
        actions={saveIndicator("", "ui-save-indicator")}
      />
      <div className="form-clusters">
        <AccordionSection
          sectionKey="identity"
          label="Identidad"
          icon={Storefront}
          collapsed={collapsedSections.has("identity")}
          onToggle={() => toggleSection("identity")}
        >
          <div className="form-grid">
            <Field label="Nombre de la tienda" {...(nameError ? { error: nameError } : {})}>
              <input
                value={nameDisplay}
                onChange={(event) =>
                  updateField(
                    "name",
                    event.target.value,
                    (next) => next.trim() !== "",
                    (next) =>
                      commit({
                        name: next,
                        identity: { ...project.identity, brandName: next },
                      }),
                  )
                }
              />
            </Field>
            <Field label="Razón social" {...(legalNameError ? { error: legalNameError } : {})}>
              <input
                value={legalNameDisplay}
                onChange={(event) =>
                  updateField(
                    "legalName",
                    event.target.value,
                    (next) => next.trim() !== "",
                    (next) => commit({ identity: { ...project.identity, legalName: next } }),
                  )
                }
              />
            </Field>
            <Field
              label="Descripción"
              className="field--wide"
              {...(descriptionError ? { error: descriptionError } : {})}
            >
              <textarea
                rows={4}
                value={project.identity.description}
                onChange={(event) =>
                  commit({ identity: { ...project.identity, description: event.target.value } })
                }
              />
            </Field>
            <Field label="Email" {...(emailError ? { error: emailError } : {})}>
              <input
                type="email"
                value={emailDisplay}
                onChange={(event) =>
                  updateField(
                    "email",
                    event.target.value,
                    (next) => next === "" || isValidEmail(next),
                    (next) => commit({ identity: { ...project.identity, email: next } }),
                  )
                }
              />
            </Field>
            <Field label="Teléfono">
              <input
                value={project.identity.phone}
                onChange={(event) =>
                  commit({ identity: { ...project.identity, phone: event.target.value } })
                }
              />
            </Field>
            <Field label="Dirección" className="field--wide">
              <input
                value={project.identity.address}
                onChange={(event) =>
                  commit({ identity: { ...project.identity, address: event.target.value } })
                }
              />
            </Field>
          </div>
        </AccordionSection>

        <AccordionSection
          sectionKey="whatsapp"
          label="Pedido por WhatsApp"
          icon={WhatsappLogo}
          badge={
            <StatusBadge
              status={phoneInvalid ? "warning" : phoneMissing ? "idle" : "ok"}
              label={
                phoneInvalid ? "Revisar formato" : phoneMissing ? "Pendiente" : "Formato correcto"
              }
            />
          }
          collapsed={collapsedSections.has("whatsapp")}
          onToggle={() => toggleSection("whatsapp")}
        >
          <div className="form-grid">
            <Field
              label="Número internacional"
              hint="Sólo números, con código de país y área."
              {...(phoneError ? { error: phoneError } : {})}
            >
              <input
                inputMode="tel"
                value={phoneDisplay}
                onChange={(event) =>
                  updateField(
                    "phone",
                    event.target.value.replace(/\D/g, ""),
                    (next) => next !== "" && PHONE_PATTERN.test(next),
                    (next) => commit({ whatsapp: { ...project.whatsapp, phone: next } }),
                  )
                }
              />
            </Field>
            <Field label="Saludo del pedido" className="field--wide">
              <input
                value={project.whatsapp.greeting}
                onChange={(event) =>
                  commit({ whatsapp: { ...project.whatsapp, greeting: event.target.value } })
                }
              />
            </Field>
            <Toggle
              checked={project.whatsapp.includeSku}
              onChange={(checked) =>
                commit({ whatsapp: { ...project.whatsapp, includeSku: checked } })
              }
              label="Incluir SKU en el mensaje"
            />
          </div>
        </AccordionSection>

        <AccordionSection
          sectionKey="domain"
          label="Dominio"
          icon={Globe}
          collapsed={collapsedSections.has("domain")}
          onToggle={() => toggleSection("domain")}
        >
          <div className="form-grid">
            <Field
              label="URL pública"
              hint="La exportación de producción usa esta URL para canonical y feeds."
              {...(urlError ? { error: urlError } : {})}
            >
              <input
                type="url"
                value={urlDisplay}
                onChange={(event) =>
                  updateField(
                    "baseUrl",
                    event.target.value,
                    (next) => next.trim() !== "" && isValidUrl(next),
                    (next) => commit({ baseUrl: next }),
                  )
                }
              />
            </Field>
            <Field label="Slug interno">
              <input value={project.slug} readOnly aria-readonly />
            </Field>
          </div>
        </AccordionSection>

        <AccordionSection
          sectionKey="navigation"
          label="Navegación pública"
          icon={List}
          collapsed={collapsedSections.has("navigation")}
          onToggle={() => toggleSection("navigation")}
        >
          <div className="form-grid">
            <Field
              label="Nombre del catálogo"
              {...(catalogLabelError ? { error: catalogLabelError } : {})}
            >
              <input
                value={catalogLabelDisplay}
                onChange={(event) =>
                  updateField(
                    "catalogLabel",
                    event.target.value,
                    (next) => next.trim() !== "",
                    (next) => updateNavigation({ catalogLabel: next }),
                  )
                }
              />
            </Field>
            <div className="navigation-switches">
              {(
                [
                  ["showHome", "Mostrar Inicio"],
                  ["showContact", "Mostrar Contacto"],
                  ["showAbout", "Mostrar Nosotros"],
                  ["showSearch", "Mostrar búsqueda"],
                  ["showCart", "Mostrar carrito"],
                ] as const
              ).map(([key, label]) => (
                <Toggle
                  key={key}
                  checked={project.navigation[key]}
                  onChange={(checked) => updateNavigation({ [key]: checked })}
                  label={label}
                />
              ))}
            </div>
            <div className="navigation-switches field--wide">
              {(
                [
                  ["announcement", "Mostrar barra informativa"],
                  ["header", "Mostrar encabezado"],
                  ["footer", "Mostrar pie"],
                  ["cart", "Mostrar carrito lateral"],
                ] as const
              ).map(([key, label]) => (
                <Toggle
                  key={key}
                  checked={project.siteShell[key]}
                  onChange={(checked) =>
                    commit({ siteShell: { ...project.siteShell, [key]: checked } })
                  }
                  label={label}
                />
              ))}
            </div>
            <div className="navigation-editor field--wide">
              {project.navigation.items.map((item, index) => {
                const itemHrefDraft = drafts[`nav-${item.id}`] ?? item.href ?? "";
                const itemHrefError = destinationError(itemHrefDraft);
                const itemLabelKey = `nav-label-${item.id}`;
                const itemLabelDisplay = fieldValue(itemLabelKey, item.label);
                const itemLabelError =
                  itemLabelDisplay.trim() === "" ? "Completá el nombre del enlace." : undefined;
                return (
                  <div className="navigation-editor-item" key={item.id}>
                    <div className="form-grid">
                      <Field
                        label={`Enlace ${index + 1}`}
                        {...(itemLabelError ? { error: itemLabelError } : {})}
                      >
                        <input
                          value={itemLabelDisplay}
                          onChange={(event) =>
                            updateField(
                              itemLabelKey,
                              event.target.value,
                              (next) => next.trim() !== "",
                              (next) =>
                                updateNavigation({
                                  items: project.navigation.items.map((current) =>
                                    current.id === item.id ? { ...current, label: next } : current,
                                  ),
                                }),
                            )
                          }
                        />
                      </Field>
                      <Field
                        label="Destino"
                        description={`Destino del enlace ${item.label}`}
                        {...(itemHrefError ? { error: itemHrefError } : {})}
                      >
                        {destinationInput(`nav-${item.id}`, item.href ?? "", (next) =>
                          updateNavigationItem(item.id, { href: next }),
                        )}
                      </Field>
                    </div>
                    <div className="navigation-reorder">
                      <IconButton
                        icon={ArrowUp}
                        label={`Mover ${item.label} arriba`}
                        disabled={index === 0}
                        onClick={() => moveNavigationItem(item.id, -1)}
                      />
                      <IconButton
                        icon={ArrowDown}
                        label={`Mover ${item.label} abajo`}
                        disabled={index === project.navigation.items.length - 1}
                        onClick={() => moveNavigationItem(item.id, 1)}
                      />
                    </div>
                    <div className="navigation-children">
                      <span className="navigation-children-title">Subenlaces</span>
                      <span id={`nav-children-context-${item.id}`} className="visually-hidden">
                        Subenlaces de {item.label}
                      </span>
                      {(item.children ?? []).map((child, childIndex) => {
                        const childHrefDraft =
                          drafts[`nav-${item.id}-${child.id}`] ?? child.href ?? "";
                        const childHrefError = destinationError(childHrefDraft);
                        const childLabelKey = `nav-child-label-${child.id}`;
                        const childLabelDisplay = fieldValue(childLabelKey, child.label);
                        const childLabelError =
                          childLabelDisplay.trim() === ""
                            ? "Completá el nombre del subenlace."
                            : undefined;
                        return (
                          <div className="navigation-child-editor" key={child.id}>
                            <Field
                              label={`Subenlace ${childIndex + 1}`}
                              description={`Subenlace ${child.label} de ${item.label}`}
                              {...(childLabelError ? { error: childLabelError } : {})}
                            >
                              <input
                                value={childLabelDisplay}
                                onChange={(event) =>
                                  updateField(
                                    childLabelKey,
                                    event.target.value,
                                    (next) => next.trim() !== "",
                                    (next) =>
                                      updateNavigationItem(item.id, {
                                        children: (item.children ?? []).map((current) =>
                                          current.id === child.id
                                            ? { ...current, label: next }
                                            : current,
                                        ),
                                      }),
                                  )
                                }
                              />
                            </Field>
                            <Field
                              label="Destino"
                              description={`Destino del subenlace ${child.label} de ${item.label}`}
                              {...(childHrefError ? { error: childHrefError } : {})}
                            >
                              {destinationInput(
                                `nav-${item.id}-${child.id}`,
                                child.href ?? "",
                                (next) =>
                                  updateNavigationItem(item.id, {
                                    children: (item.children ?? []).map((current) =>
                                      current.id === child.id
                                        ? { ...current, href: next }
                                        : current,
                                    ),
                                  }),
                              )}
                            </Field>
                            <div className="navigation-reorder">
                              <IconButton
                                icon={ArrowUp}
                                label={`Mover ${child.label} arriba`}
                                disabled={childIndex === 0}
                                onClick={() => moveNavigationChild(item.id, child.id, -1)}
                              />
                              <IconButton
                                icon={ArrowDown}
                                label={`Mover ${child.label} abajo`}
                                disabled={childIndex === (item.children?.length ?? 0) - 1}
                                onClick={() => moveNavigationChild(item.id, child.id, 1)}
                              />
                            </div>
                            <IconButton
                              icon={Trash}
                              label={`Eliminar subenlace ${child.label}`}
                              tooltip="Eliminar subenlace"
                              onClick={() =>
                                setPendingNavDelete({
                                  kind: "child",
                                  itemId: item.id,
                                  childId: child.id,
                                  label: child.label,
                                  parentLabel: item.label,
                                })
                              }
                            />
                          </div>
                        );
                      })}
                      <Button
                        variant="secondary"
                        aria-describedby={`nav-children-context-${item.id}`}
                        onClick={() =>
                          updateNavigationItem(item.id, {
                            children: [
                              ...(item.children ?? []),
                              {
                                id: `nav-${crypto.randomUUID()}`,
                                label: "Nuevo subenlace",
                                href: project.categories[0]
                                  ? `/categorias/${project.categories[0].slug}/`
                                  : "/",
                              },
                            ],
                          })
                        }
                      >
                        Añadir subenlace
                      </Button>
                    </div>
                    <IconButton
                      icon={Trash}
                      label={`Eliminar enlace ${item.label}`}
                      tooltip="Eliminar enlace"
                      onClick={() =>
                        setPendingNavDelete({
                          kind: "item",
                          itemId: item.id,
                          label: item.label,
                          childCount: item.children?.length ?? 0,
                        })
                      }
                    />
                  </div>
                );
              })}
              <Button
                variant="secondary"
                onClick={() =>
                  updateNavigation({
                    items: [
                      ...project.navigation.items,
                      {
                        id: `nav-${crypto.randomUUID()}`,
                        label: "Nueva categoría",
                        href: project.categories[0]
                          ? `/categorias/${project.categories[0].slug}/`
                          : "/",
                      },
                    ],
                  })
                }
              >
                Añadir enlace de catálogo
              </Button>
            </div>
          </div>
        </AccordionSection>

        <AccordionSection
          sectionKey="pages"
          label="Páginas editoriales"
          icon={Article}
          collapsed={collapsedSections.has("pages")}
          onToggle={() => toggleSection("pages")}
        >
          <div className="form-grid">
            {project.pages.map((page) => {
              const pageLabel =
                page.kind === "home" ? "Home" : page.kind === "about" ? "Nosotros" : "Contacto";
              const pageTitleDisplay = fieldValue(`page-title-${page.id}`, page.title);
              const pageTitleError =
                pageTitleDisplay.trim() === "" ? "Completá el título visible." : undefined;
              const seoTitleKey = `page-seo-title-${page.id}`;
              const seoTitleDisplay = fieldValue(seoTitleKey, page.seoTitle);
              const seoTitleError =
                seoTitleDisplay.trim() === "" ? "Completá el título SEO." : undefined;
              const seoDescriptionKey = `page-seo-desc-${page.id}`;
              const seoDescriptionDisplay = fieldValue(seoDescriptionKey, page.seoDescription);
              const seoDescriptionError =
                seoDescriptionDisplay.trim() === "" ? "Completá la descripción SEO." : undefined;
              return (
                <div className="page-editor" key={page.id}>
                  <strong>{pageLabel}</strong>
                  <Field
                    label="Título visible"
                    description={`Página ${pageLabel}`}
                    {...(pageTitleError ? { error: pageTitleError } : {})}
                  >
                    <input
                      value={pageTitleDisplay}
                      onChange={(event) =>
                        updateField(
                          `page-title-${page.id}`,
                          event.target.value,
                          (next) => next.trim() !== "",
                          (next) => updatePage(page.id, { title: next }),
                        )
                      }
                    />
                  </Field>
                  <Field
                    label="Título SEO"
                    description={`Página ${pageLabel}`}
                    hint={`${seoTitleDisplay.length}/70 caracteres`}
                    {...(seoTitleError ? { error: seoTitleError } : {})}
                  >
                    <input
                      maxLength={70}
                      value={seoTitleDisplay}
                      onChange={(event) =>
                        updateField(
                          seoTitleKey,
                          event.target.value,
                          (next) => next.trim() !== "",
                          (next) => updatePage(page.id, { seoTitle: next }),
                        )
                      }
                    />
                  </Field>
                  <Field
                    label="Descripción SEO"
                    description={`Página ${pageLabel}`}
                    hint={`${seoDescriptionDisplay.length}/180 caracteres`}
                    {...(seoDescriptionError ? { error: seoDescriptionError } : {})}
                  >
                    <textarea
                      rows={2}
                      maxLength={180}
                      value={seoDescriptionDisplay}
                      onChange={(event) =>
                        updateField(
                          seoDescriptionKey,
                          event.target.value,
                          (next) => next.trim() !== "",
                          (next) => updatePage(page.id, { seoDescription: next }),
                        )
                      }
                    />
                  </Field>
                </div>
              );
            })}
          </div>
        </AccordionSection>
      </div>
      <div className="overview-savebar" data-testid="ui-overview-savebar">
        {saveIndicator()}
        <span className="overview-savebar__note">
          Los cambios se guardan automáticamente en tu máquina.
        </span>
      </div>
      {pendingNavDelete ? (
        <ConfirmDialog
          title={
            pendingNavDelete.kind === "item"
              ? "Eliminar enlace de navegación"
              : "Eliminar subenlace de navegación"
          }
          body={
            pendingNavDelete.kind === "item" ? (
              <>
                Se eliminará «{pendingNavDelete.label}».
                {pendingNavDelete.childCount > 0
                  ? ` También se eliminarán ${pendingNavDelete.childCount} subenlace(s).`
                  : " No tiene subenlaces."}{" "}
                Podés deshacerlo desde la barra del editor.
              </>
            ) : (
              <>
                Se eliminará el subenlace «{pendingNavDelete.label}» de «
                {pendingNavDelete.parentLabel}». Podés deshacerlo desde la barra del editor.
              </>
            )
          }
          confirmLabel={pendingNavDelete.kind === "item" ? "Eliminar enlace" : "Eliminar subenlace"}
          danger
          onConfirm={confirmNavigationDelete}
          onCancel={() => setPendingNavDelete(null)}
        />
      ) : null}
    </section>
  );
}
