/** Editor de identidad, contacto, navegación y copy que completa la plantilla base. */
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
import { ConfirmDialog } from "../components/ConfirmDialog";
import { StatusBadge, Toggle } from "../components/primitives";
import { useToast } from "../components/Toast";
import { Button, Field, IconButton, SectionHeader } from "../components/Ui";

const PHONE_PATTERN = /^\d{8,15}$/;

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function Overview({
  project,
  onChange,
}: {
  project: StoreProjectV1;
  onChange(project: StoreProjectV1): void;
}) {
  const [pendingNavDelete, setPendingNavDelete] = useState<string | null>(null);
  const { success } = useToast();
  const pendingNavItem = pendingNavDelete
    ? project.navigation.items.find((item) => item.id === pendingNavDelete)
    : undefined;
  const phoneValue = project.whatsapp.phone;
  const phoneError =
    phoneValue && !PHONE_PATTERN.test(phoneValue)
      ? "Usá entre 8 y 15 dígitos con código de país y área."
      : undefined;
  const urlValue = project.baseUrl;
  const urlError =
    urlValue && !isValidUrl(urlValue) ? "Ingresá una URL válida con http(s)." : undefined;
  const deleteNavItem = (itemId: string) => {
    updateNavigation({
      items: project.navigation.items.filter((current) => current.id !== itemId),
    });
    success("Enlace de navegación eliminado");
  };
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
            <WhatsappLogo aria-hidden size={19} /> Pedido por WhatsApp{" "}
            <StatusBadge
              status={phoneError ? "warning" : phoneValue ? "ok" : "idle"}
              label={phoneError ? "Revisar formato" : phoneValue ? "Formato correcto" : "Pendiente"}
            />
          </legend>
          <div className="form-grid">
            <Field
              label="Número internacional"
              hint="Sólo números, con código de país y área."
              {...(phoneError ? { error: phoneError } : {})}
            >
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
            <Toggle
              checked={project.whatsapp.includeSku}
              onChange={(checked) =>
                commit({ whatsapp: { ...project.whatsapp, includeSku: checked } })
              }
              label="Incluir SKU en el mensaje"
            />
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
              {...(urlError ? { error: urlError } : {})}
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
                        <IconButton
                          icon={Trash}
                          label={`Eliminar subenlace ${child.label}`}
                          tooltip="Eliminar subenlace"
                          onClick={() =>
                            updateNavigationItem(item.id, {
                              children: (item.children ?? []).filter(
                                (current) => current.id !== child.id,
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                    <Button
                      variant="secondary"
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
                    onClick={() => {
                      if ((item.children?.length ?? 0) > 0) setPendingNavDelete(item.id);
                      else deleteNavItem(item.id);
                    }}
                  />
                </div>
              ))}
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
                <Field label="Título SEO">
                  <input
                    value={page.seoTitle}
                    onChange={(event) => updatePage(page.id, { seoTitle: event.target.value })}
                  />
                </Field>
                <Field label="Descripción SEO">
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
      {pendingNavItem ? (
        <ConfirmDialog
          title="Eliminar enlace de navegación"
          body={
            <>
              Se eliminará «{pendingNavItem.label}» junto con sus{" "}
              {pendingNavItem.children?.length ?? 0} subenlace(s). Podés deshacerlo desde la barra
              del editor.
            </>
          }
          confirmLabel="Eliminar enlace"
          danger
          onConfirm={() => {
            deleteNavItem(pendingNavItem.id);
            setPendingNavDelete(null);
          }}
          onCancel={() => setPendingNavDelete(null)}
        />
      ) : null}
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
