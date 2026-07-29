import { Globe, Storefront, WhatsappLogo } from "@phosphor-icons/react";
import type { StoreProjectV1 } from "@solara/project-schema";
import { Field, SectionHeader } from "../components/Ui";

export function Overview({
  project,
  onChange,
}: {
  project: StoreProjectV1;
  onChange(project: StoreProjectV1): void;
}) {
  const commit = (patch: Partial<StoreProjectV1>) =>
    onChange({ ...project, ...patch, updatedAt: new Date().toISOString() });

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
      </div>
    </section>
  );
}
