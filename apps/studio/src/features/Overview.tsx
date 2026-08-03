import {
  ArrowDown,
  ArrowUp,
  Globe,
  List,
  Storefront,
  Trash,
  WhatsappLogo,
} from "@phosphor-icons/react";
import type { StoreProjectV1 } from "@solara/project-schema";
import { type InputHTMLAttributes, useEffect, useState } from "react";
import { Field, IconButton, SectionHeader } from "../components/Ui";

export function Overview({
  project,
  onChange,
}: {
  project: StoreProjectV1;
  onChange(project: StoreProjectV1): void;
}) {
  const commit = (patch: Partial<StoreProjectV1>) =>
    onChange({ ...project, ...patch, updatedAt: new Date().toISOString() });
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

  return (
    <section className="workspace-section">
      <SectionHeader
        title="Resumen"
        description="Datos comerciales compartidos por la tienda, el pedido y la exportación."
      />
      <div className="form-clusters">
        <fieldset>
          <legend>
            <Storefront aria-hidden size={19} /> Identidad
          </legend>
          <div className="form-grid">
            <Field label="Nombre de la tienda">
              <input
                value={project.name}
                onChange={(event) =>
                  commit({
                    name: event.target.value,
                    identity: { ...project.identity, brandName: event.target.value },
                  })
                }
              />
            </Field>
            <Field label="Razón social">
              <input
                value={project.identity.legalName}
                onChange={(event) =>
                  commit({ identity: { ...project.identity, legalName: event.target.value } })
                }
              />
            </Field>
            <Field label="Descripción" className="field--wide">
              <textarea
                rows={4}
                value={project.identity.description}
                onChange={(event) =>
                  commit({ identity: { ...project.identity, description: event.target.value } })
                }
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={project.identity.email}
                onChange={(event) =>
                  commit({ identity: { ...project.identity, email: event.target.value } })
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
        </fieldset>

        <fieldset>
          <legend>
            <WhatsappLogo aria-hidden size={19} /> Pedido por WhatsApp
          </legend>
          <div className="form-grid">
            <Field label="Número internacional" hint="Sólo números, con código de país y área.">
              <input
                inputMode="tel"
                value={project.whatsapp.phone}
                onChange={(event) =>
                  commit({
                    whatsapp: { ...project.whatsapp, phone: event.target.value.replace(/\D/g, "") },
                  })
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
            <label className="check-field">
              <input
                type="checkbox"
                checked={project.whatsapp.includeSku}
                onChange={(event) =>
                  commit({ whatsapp: { ...project.whatsapp, includeSku: event.target.checked } })
                }
              />
              Incluir SKU en el mensaje
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>
            <Globe aria-hidden size={19} /> Dominio
          </legend>
          <div className="form-grid">
            <Field
              label="URL pública"
              hint="La exportación de producción usa esta URL para canonical y feeds."
            >
              <input
                type="url"
                value={project.baseUrl}
                onChange={(event) => commit({ baseUrl: event.target.value })}
              />
            </Field>
            <Field label="Slug interno">
              <input value={project.slug} readOnly aria-readonly />
            </Field>
          </div>
        </fieldset>

        <fieldset>
          <legend>
            <List aria-hidden size={19} /> Navegación pública
          </legend>
          <div className="form-grid">
            <Field label="Nombre del catálogo">
              <input
                value={project.navigation.catalogLabel}
                onChange={(event) => updateNavigation({ catalogLabel: event.target.value })}
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
                <label className="check-field" key={key}>
                  <input
                    type="checkbox"
                    checked={project.navigation[key]}
                    onChange={(event) => updateNavigation({ [key]: event.target.checked })}
                  />
                  {label}
                </label>
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
                <label className="check-field" key={key}>
                  <input
                    type="checkbox"
                    checked={project.siteShell[key]}
                    onChange={(event) =>
                      commit({ siteShell: { ...project.siteShell, [key]: event.target.checked } })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="navigation-editor field--wide">
              {project.navigation.items.map((item, index) => (
                <div className="navigation-editor-item" key={item.id}>
                  <div className="form-grid">
                    <Field label={`Enlace ${index + 1}`}>
                      <input
                        value={item.label}
                        onChange={(event) =>
                          updateNavigation({
                            items: project.navigation.items.map((current) =>
                              current.id === item.id
                                ? { ...current, label: event.target.value }
                                : current,
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field label="Destino">
                      <DraftInput
                        type="url"
                        value={item.href ?? ""}
                        onCommit={(value) => updateNavigationItem(item.id, { href: value })}
                      />
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
                    {(item.children ?? []).map((child, childIndex) => (
                      <div className="navigation-child-editor" key={child.id}>
                        <Field label={`Subenlace ${childIndex + 1}`}>
                          <input
                            value={child.label}
                            onChange={(event) =>
                              updateNavigationItem(item.id, {
                                children: (item.children ?? []).map((current) =>
                                  current.id === child.id
                                    ? { ...current, label: event.target.value }
                                    : current,
                                ),
                              })
                            }
                          />
                        </Field>
                        <Field label="Destino">
                          <DraftInput
                            type="url"
                            value={child.href ?? ""}
                            onCommit={(value) =>
                              updateNavigationItem(item.id, {
                                children: (item.children ?? []).map((current) =>
                                  current.id === child.id ? { ...current, href: value } : current,
                                ),
                              })
                            }
                          />
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
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={`Eliminar subenlace ${child.label}`}
                          onClick={() =>
                            updateNavigationItem(item.id, {
                              children: (item.children ?? []).filter(
                                (current) => current.id !== child.id,
                              ),
                            })
                          }
                        >
                          <Trash aria-hidden size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      className="button button--secondary"
                      type="button"
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
                    </button>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Eliminar enlace ${item.label}`}
                    onClick={() =>
                      updateNavigation({
                        items: project.navigation.items.filter((current) => current.id !== item.id),
                      })
                    }
                  >
                    <Trash aria-hidden size={18} />
                  </button>
                </div>
              ))}
              <button
                className="button button--secondary"
                type="button"
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
              </button>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Páginas editoriales</legend>
          <div className="form-grid">
            {project.pages.map((page) => (
              <div className="page-editor" key={page.id}>
                <strong>
                  {page.kind === "home" ? "Home" : page.kind === "about" ? "Nosotros" : "Contacto"}
                </strong>
                <Field label="Título visible">
                  <input
                    value={page.title}
                    onChange={(event) => updatePage(page.id, { title: event.target.value })}
                  />
                </Field>
                <Field label="SEO title">
                  <input
                    value={page.seoTitle}
                    onChange={(event) => updatePage(page.id, { seoTitle: event.target.value })}
                  />
                </Field>
                <Field label="SEO description">
                  <textarea
                    rows={2}
                    value={page.seoDescription}
                    onChange={(event) =>
                      updatePage(page.id, { seoDescription: event.target.value })
                    }
                  />
                </Field>
              </div>
            ))}
          </div>
        </fieldset>
      </div>
    </section>
  );
}

function DraftInput({
  value,
  onCommit,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value"> & {
  value: string;
  onCommit(value: string): void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <input
      {...props}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
    />
  );
}
