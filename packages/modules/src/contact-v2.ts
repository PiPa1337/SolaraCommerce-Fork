import {
  canvasEntityAttributes,
  canvasRepeaterItemAttributes,
  canvasTextAttributes,
  escapeAttribute,
  escapeHtml,
  type ModuleDefinition,
  moduleRoot,
  type RenderContext,
  safeHtml,
  safeUrl,
} from "@solara/module-sdk";
import { CATALOG_MODERN_PLACEHOLDER_PHONE } from "@solara/project-schema";
import { z } from "zod";
import { catalogHeroBenefitIcons } from "./catalog-modern";
import { scopedAssetId } from "./helpers";

const contactRevealZone = [
  {
    id: "content",
    label: "Contenido",
    selector: '[data-motion-zone="content"]',
    allowedPresets: ["none", "fade", "fade-up", "slide", "scale"] as const,
  },
] as const;

const contactItemsZone = [
  {
    id: "items",
    label: "Elementos",
    selector: '[data-motion-zone="items"]',
    allowedPresets: ["none", "fade", "fade-up", "stagger"] as const,
  },
] as const;

const contactManifest = <Id extends string>(input: {
  id: Id;
  name: string;
  description: string;
  compatibleSettings: readonly string[];
}) => ({
  ...input,
  version: 1 as const,
  family: "catalog-modern-v1" as const,
  availability: "default" as const,
  slots: ["content"] as const,
});

const iconPaths: Record<string, string> = {
  chat: '<path d="M4 5h16v11H9.5L4 19.5z"></path>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="1"></rect><path d="m4 7 8 6 8-6"></path>',
  phone:
    '<path d="M7 3.5 10 6 8.2 9.2c1.2 2.5 3.1 4.4 5.6 5.6l3.2-1.8 2.5 3-1.8 3.2c-.5.8-1.4 1.2-2.3 1C8.4 18.6 5.4 15.6 3.8 8.6c-.2-.9.2-1.8 1-2.3z"></path>',
  pin: '<path d="M12 21s6-5.8 6-11a6 6 0 1 0-12 0c0 5.2 6 11 6 11z"></path><circle cx="12" cy="10" r="2"></circle>',
  clock: '<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7v5l3.2 2"></path>',
  truck:
    '<path d="M2 6.5h10.5V15H2z"></path><path d="M12.5 9.5H17l3.5 3.5v2h-8"></path><circle cx="6.5" cy="15.5" r="1.7"></circle><circle cx="16.5" cy="15.5" r="1.7"></circle>',
  box: '<path d="m3 7 9-4 9 4-9 4z"></path><path d="M3 7v10l9 4 9-4V7"></path><path d="M12 11v10"></path>',
  bag: '<path d="M5 8h14l1 12H4z"></path><path d="M8 8a4 4 0 0 1 8 0"></path>',
  change:
    '<path d="M5 7h12l-3-3"></path><path d="M19 17H7l3 3"></path><path d="M17 7a5 5 0 0 1 2 4"></path><path d="M7 17a5 5 0 0 1-2-4"></path>',
  user: '<circle cx="12" cy="8" r="3.5"></circle><path d="M4.5 20a7.5 7.5 0 0 1 15 0"></path>',
  question:
    '<circle cx="12" cy="12" r="9"></circle><path d="M9.8 9a2.3 2.3 0 1 1 3.8 1.7c-1 .8-1.6 1.1-1.6 2.3"></path><path d="M12 16h.01"></path>',
  shield: '<path d="M12 3l7 2.5v5.5c0 4.2-2.9 7.2-7 8.5-4.1-1.3-7-4.3-7-8.5V5.5z"></path>',
};

const icon = (name: string): string =>
  `<svg class="solara-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] ?? iconPaths.question}</svg>`;

const contactReasonOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

const CONTACT_REASON_OPTIONS = [
  { id: "product", label: "Consulta de producto" },
  { id: "availability", label: "Disponibilidad" },
  { id: "shipping", label: "Envíos" },
  { id: "other", label: "Otro" },
] as const;

export const contactFormSettings = z.object({
  title: z.string().default("Escribinos"),
  body: z.string().default("Completá el formulario y nuestro equipo te responderá a la brevedad."),
  showPhone: z.boolean().default(true),
  showEmailButton: z.boolean().default(true),
  /** Compatibilidad con configuraciones antiguas; el copy global es la fuente nueva. */
  reasonLabel: z.string().default(""),
  reasonOptions: z
    .array(contactReasonOptionSchema)
    .min(1)
    .max(12)
    .default([...CONTACT_REASON_OPTIONS]),
  nameLabel: z.string().default("Nombre"),
  emailLabel: z.string().default("Email"),
  phoneLabel: z.string().default("Teléfono"),
  messageLabel: z.string().default("Mensaje"),
  emailActionLabel: z.string().default("Enviar por Email"),
  whatsappActionLabel: z.string().default("Enviar por WhatsApp"),
});

export const contactChannelsSettings = z.object({
  title: z.string().default("Nuestros canales"),
  body: z.string().default("Elegí el canal que prefieras para comunicarte con nosotros."),
  showWhatsapp: z.boolean().default(true),
  showEmail: z.boolean().default(true),
  showPhone: z.boolean().default(true),
  showAddress: z.boolean().default(true),
  showHours: z.boolean().default(true),
  hoursText: z.string().default("Lunes a viernes de 9 a 18 hs.\nSábados de 10 a 14 hs."),
  whatsappActionLabel: z.string().default("Escribir ahora"),
  emailActionLabel: z.string().default("Enviar email"),
  phoneActionLabel: z.string().default("Llamar ahora"),
  addressActionLabel: z.string().default("Ver en mapa"),
  hoursActionLabel: z.string().default("Ver horarios"),
});

const contactHasPublicPhone = (phone: string): boolean =>
  phone !== CATALOG_MODERN_PLACEHOLDER_PHONE && phone.replace(/\D/g, "").length > 0;

const contactPhone = (context: RenderContext<unknown>): string => {
  const phone = context.project.whatsapp.phone;
  return contactHasPublicPhone(phone) ? phone.replace(/\D/g, "") : "";
};

const contactIconMarkup = (name: string): string =>
  `<span class="solara-contact-icon" aria-hidden="true">${icon(name)}</span>`;

type ContactModuleInput<Id extends string, Settings> = Omit<
  ModuleDefinition<Id, Settings>,
  "manifest"
> & {
  id: Id;
  name: string;
  description: string;
  compatibleSettings: readonly string[];
};

const contactModule = <Id extends string, Settings>(
  input: ContactModuleInput<Id, Settings>,
): ModuleDefinition<Id, Settings> => {
  const { id, name, description, compatibleSettings, ...definition } = input;
  return {
    ...definition,
    manifest: contactManifest({ id, name, description, compatibleSettings }),
  };
};

function contactCanvasContext(context: Pick<RenderContext<unknown>, "canvas" | "section">) {
  return {
    editorMode: context.canvas?.editorMode === true,
    sectionId: context.section.id,
  } as const;
}

export const contactForm: ModuleDefinition<
  "contact-form",
  z.infer<typeof contactFormSettings>
> = contactModule({
  id: "contact-form",
  name: "Formulario de Contacto",
  description: "Formulario que prepara una consulta para email.",
  compatibleSettings: [
    "title",
    "body",
    "showPhone",
    "showEmailButton",
    "reasonLabel",
    "reasonOptions",
    "nameLabel",
    "emailLabel",
    "phoneLabel",
    "messageLabel",
    "emailActionLabel",
    "whatsappActionLabel",
  ],
  settingsSchema: contactFormSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    { key: "body", type: "text", label: "Texto" },
    { key: "showPhone", type: "boolean", label: "Mostrar teléfono" },
    { key: "showEmailButton", type: "boolean", label: "Mostrar botón de email" },
    { key: "reasonLabel", type: "text", label: "Label del motivo" },
    {
      key: "reasonOptions",
      type: "repeater",
      label: "Motivos de consulta",
      minItems: 1,
      maxItems: 12,
      itemLabelKey: "label",
      fields: [{ key: "label", label: "Motivo", type: "text" }],
    },
    { key: "nameLabel", type: "text", label: "Label nombre" },
    { key: "emailLabel", type: "text", label: "Label email" },
    { key: "phoneLabel", type: "text", label: "Label teléfono" },
    { key: "messageLabel", type: "text", label: "Label mensaje" },
    { key: "emailActionLabel", type: "text", label: "Botón email" },
    { key: "whatsappActionLabel", type: "text", label: "Botón WhatsApp" },
  ],
  motionZones: contactRevealZone,
  canvasBindings: [
    {
      id: "title",
      label: "Título del formulario",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "title" },
      capabilities: ["edit-text"],
      maxLength: 160,
    },
    {
      id: "body",
      label: "Texto del formulario",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "body" },
      capabilities: ["edit-text"],
      multiline: true,
      maxLength: 600,
    },
    {
      id: "showPhone",
      label: "Mostrar teléfono",
      kind: "boolean",
      source: { kind: "section-setting", fieldKey: "showPhone" },
      capabilities: ["toggle-boolean"],
    },
    {
      id: "reasonLabel",
      label: "Etiqueta del motivo",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "reasonLabel" },
      capabilities: ["edit-text"],
      maxLength: 80,
    },
    {
      id: "reason-option-label",
      label: "Motivo de consulta",
      kind: "repeater-item",
      source: { kind: "section-repeater-item", fieldKey: "reasonOptions", itemFieldKey: "label" },
      capabilities: ["edit-repeater-item", "edit-text"],
      maxLength: 120,
    },
    {
      id: "nameLabel",
      label: "Etiqueta de nombre",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "nameLabel" },
      capabilities: ["edit-text"],
      maxLength: 80,
    },
    {
      id: "emailLabel",
      label: "Etiqueta de email",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "emailLabel" },
      capabilities: ["edit-text"],
      maxLength: 80,
    },
    {
      id: "phoneLabel",
      label: "Etiqueta de teléfono",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "phoneLabel" },
      capabilities: ["edit-text"],
      maxLength: 80,
    },
    {
      id: "messageLabel",
      label: "Etiqueta de mensaje",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "messageLabel" },
      capabilities: ["edit-text"],
      maxLength: 80,
    },
    {
      id: "emailActionLabel",
      label: "Botón de email",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "emailActionLabel" },
      capabilities: ["edit-text"],
      maxLength: 120,
    },
    {
      id: "whatsappActionLabel",
      label: "Botón de WhatsApp",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "whatsappActionLabel" },
      capabilities: ["edit-text"],
      maxLength: 120,
    },
  ],
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const copy = context.project.publicCopy;
    const settings = context.settings;
    const editor = contactCanvasContext(context);
    const phone = contactPhone(context);
    const email = context.project.identity.email.trim();
    const hasWhatsapp = phone.length > 0;
    const hasEmail = email.length > 0;
    const brand = context.project.identity.brandName;
    const action = hasEmail ? `mailto:${escapeAttribute(email)}` : "#";
    const emailDisabled = hasEmail ? "" : " disabled";
    const whatsappDisabled = hasWhatsapp ? "" : " disabled";
    const whatsappHref = hasWhatsapp ? `https://wa.me/${escapeAttribute(phone)}` : "#";
    const noscriptFallback =
      hasEmail || hasWhatsapp
        ? `<p>${hasEmail ? `<a href="mailto:${escapeAttribute(email)}">${escapeHtml(copy.contact.emailAction || settings.emailActionLabel)}</a> ` : escapeHtml(copy.contact.emailFallback)}${hasEmail && hasWhatsapp ? " · " : ""}${hasWhatsapp ? `<a href="${whatsappHref}" target="_blank" rel="noopener noreferrer">${escapeHtml(copy.contact.whatsappAction)}</a> ` : escapeHtml(copy.contact.whatsappFallback)}</p>`
        : `<p>${escapeHtml(copy.contact.whatsappFallback)}</p>`;
    const reasonOptions = settings.reasonOptions
      .map(
        (option) =>
          `<option value="${escapeAttribute(option.id)}"${canvasRepeaterItemAttributes(editor, "reason-option-label", option.id)}>${escapeHtml(option.label)}</option>`,
      )
      .join("");
    const reasonLabel = settings.reasonLabel.trim() || copy.contact.reasonLabel;
    const reasonField = `<label><span${canvasTextAttributes(editor, "reasonLabel", 80)}>${escapeHtml(reasonLabel)}</span><select name="reason" required>${reasonOptions}</select></label>`;
    const emailButton = settings.showEmailButton
      ? `<button class="catalog-primary-action solara-primary-action" data-contact-channel="email" type="submit"${emailDisabled}><span class="catalog-hero-cta-label"${canvasTextAttributes(editor, "emailActionLabel", 120)}>${escapeHtml(settings.emailActionLabel)}</span><span class="catalog-hero-cta-icon" aria-hidden="true">→</span></button>`
      : "";
    return moduleRoot(
      "contact-form",
      context.section,
      safeHtml(
        `<section id="contact-form" class="contact-main-grid" data-motion-zone="content"><form class="contact-form" data-solara-contact-form data-contact-brand="${escapeAttribute(brand)}" data-contact-email="${escapeAttribute(email)}" data-contact-whatsapp="${escapeAttribute(phone)}" action="${action}" method="get" target="_blank"><h2${canvasTextAttributes(editor, "title", 160)}>${escapeHtml(settings.title)}</h2><p${canvasTextAttributes(editor, "body", 600)}>${escapeHtml(settings.body)}</p><div class="contact-form-fields"><label><span${canvasTextAttributes(editor, "nameLabel", 80)}>${escapeHtml(settings.nameLabel)}</span><input name="name" autocomplete="name" required></label><label><span${canvasTextAttributes(editor, "emailLabel", 80)}>${escapeHtml(settings.emailLabel)}</span><input name="email" type="email" autocomplete="email" required></label>${settings.showPhone ? `<label><span${canvasTextAttributes(editor, "phoneLabel", 80)}>${escapeHtml(settings.phoneLabel)}</span><input name="phone" type="tel" autocomplete="tel" required></label>` : ""}${reasonField}<label class="contact-form-message"><span${canvasTextAttributes(editor, "messageLabel", 80)}>${escapeHtml(settings.messageLabel)}</span><textarea name="message" rows="5" required></textarea></label></div><div class="contact-form-actions">${emailButton}<button class="catalog-primary-action solara-primary-action contact-form-whatsapp" data-contact-channel="whatsapp" type="button"${whatsappDisabled}><span class="catalog-hero-cta-label"${canvasTextAttributes(editor, "whatsappActionLabel", 120)}>${escapeHtml(settings.whatsappActionLabel)}</span><svg class="catalog-hero-cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${catalogHeroBenefitIcons.chat}</svg></button></div><p class="contact-form-status" data-contact-status aria-live="polite"></p><noscript>${noscriptFallback}<p>${escapeHtml(copy.contact.javascriptFallback)}</p></noscript></form></section>`,
      ),
    );
  },
});

export const contactChannels: ModuleDefinition<
  "contact-channels",
  z.infer<typeof contactChannelsSettings>
> = contactModule({
  id: "contact-channels",
  name: "Canales de Contacto",
  description: "Canales, horarios y datos de contacto de la tienda.",
  compatibleSettings: [
    "title",
    "body",
    "showWhatsapp",
    "showEmail",
    "showPhone",
    "showAddress",
    "showHours",
    "hoursText",
    "whatsappActionLabel",
    "emailActionLabel",
    "phoneActionLabel",
    "addressActionLabel",
    "hoursActionLabel",
  ],
  settingsSchema: contactChannelsSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    { key: "body", type: "text", label: "Texto" },
    { key: "showWhatsapp", type: "boolean", label: "Mostrar WhatsApp" },
    { key: "showEmail", type: "boolean", label: "Mostrar email" },
    { key: "showPhone", type: "boolean", label: "Mostrar teléfono" },
    { key: "showAddress", type: "boolean", label: "Mostrar dirección" },
    { key: "showHours", type: "boolean", label: "Mostrar horarios" },
    { key: "hoursText", type: "text", label: "Horarios" },
    { key: "whatsappActionLabel", type: "text", label: "Acción WhatsApp" },
    { key: "emailActionLabel", type: "text", label: "Acción email" },
    { key: "phoneActionLabel", type: "text", label: "Acción teléfono" },
    { key: "addressActionLabel", type: "text", label: "Acción dirección" },
    { key: "hoursActionLabel", type: "text", label: "Acción horarios" },
  ],
  motionZones: contactItemsZone,
  canvasBindings: [
    {
      id: "title",
      label: "Título de canales",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "title" },
      capabilities: ["edit-text"],
      maxLength: 160,
    },
    {
      id: "body",
      label: "Texto de canales",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "body" },
      capabilities: ["edit-text"],
      multiline: true,
      maxLength: 600,
    },
    {
      id: "showWhatsapp",
      label: "Mostrar WhatsApp",
      kind: "boolean",
      source: { kind: "section-setting", fieldKey: "showWhatsapp" },
      capabilities: ["toggle-boolean"],
    },
    {
      id: "showEmail",
      label: "Mostrar email",
      kind: "boolean",
      source: { kind: "section-setting", fieldKey: "showEmail" },
      capabilities: ["toggle-boolean"],
    },
    {
      id: "showPhone",
      label: "Mostrar teléfono",
      kind: "boolean",
      source: { kind: "section-setting", fieldKey: "showPhone" },
      capabilities: ["toggle-boolean"],
    },
    {
      id: "showAddress",
      label: "Mostrar dirección",
      kind: "boolean",
      source: { kind: "section-setting", fieldKey: "showAddress" },
      capabilities: ["toggle-boolean"],
    },
    {
      id: "showHours",
      label: "Mostrar horarios",
      kind: "boolean",
      source: { kind: "section-setting", fieldKey: "showHours" },
      capabilities: ["toggle-boolean"],
    },
    {
      id: "hoursText",
      label: "Horarios de atención",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "hoursText" },
      capabilities: ["edit-text"],
      multiline: true,
      maxLength: 400,
    },
    {
      id: "whatsappActionLabel",
      label: "Acción WhatsApp",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "whatsappActionLabel" },
      capabilities: ["edit-text"],
      maxLength: 120,
    },
    {
      id: "emailActionLabel",
      label: "Acción email",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "emailActionLabel" },
      capabilities: ["edit-text"],
      maxLength: 120,
    },
    {
      id: "phoneActionLabel",
      label: "Acción teléfono",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "phoneActionLabel" },
      capabilities: ["edit-text"],
      maxLength: 120,
    },
    {
      id: "addressActionLabel",
      label: "Acción dirección",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "addressActionLabel" },
      capabilities: ["edit-text"],
      maxLength: 120,
    },
    {
      id: "hoursActionLabel",
      label: "Acción horarios",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "hoursActionLabel" },
      capabilities: ["edit-text"],
      maxLength: 120,
    },
    {
      id: "identity-email",
      label: "Email de contacto",
      kind: "text",
      source: { kind: "identity", field: "email" },
      capabilities: ["edit-text"],
      maxLength: 160,
    },
    {
      id: "identity-phone",
      label: "Teléfono de contacto",
      kind: "text",
      source: { kind: "identity", field: "phone" },
      capabilities: ["edit-text"],
      maxLength: 80,
    },
    {
      id: "identity-address",
      label: "Dirección de contacto",
      kind: "text",
      source: { kind: "identity", field: "address" },
      capabilities: ["edit-text"],
      maxLength: 500,
    },
  ],
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const settings = context.settings;
    const copy = context.project.publicCopy;
    const editor = contactCanvasContext(context);
    const locationHref = "#contact-form";
    const phone = contactPhone(context);
    const rows: Array<[string, string, string, string, string] | null> = [
      settings.showWhatsapp && phone
        ? [
            "chat",
            copy.contact.whatsapp,
            settings.hoursText,
            settings.whatsappActionLabel,
            `https://wa.me/${phone}`,
          ]
        : null,
      settings.showEmail && context.project.identity.email
        ? [
            "mail",
            copy.contact.email,
            context.project.identity.email,
            settings.emailActionLabel,
            `mailto:${context.project.identity.email}`,
          ]
        : null,
      settings.showPhone && context.project.identity.phone
        ? [
            "phone",
            copy.contact.phone,
            context.project.identity.phone,
            settings.phoneActionLabel,
            `tel:${context.project.identity.phone}`,
          ]
        : null,
      settings.showAddress && context.project.identity.address
        ? [
            "pin",
            copy.contact.address,
            context.project.identity.address,
            settings.addressActionLabel,
            locationHref,
          ]
        : null,
      settings.showHours && settings.hoursText
        ? ["clock", copy.contact.hours, settings.hoursText, settings.hoursActionLabel, locationHref]
        : null,
    ];
    const activeRows = rows.filter(
      (row): row is [string, string, string, string, string] => row !== null,
    );
    return moduleRoot(
      "contact-channels",
      context.section,
      safeHtml(
        `<section id="contact-channels" class="contact-channels" data-motion-zone="items"><header><h2${canvasTextAttributes(editor, "title", 160)}>${escapeHtml(settings.title)}</h2><p${canvasTextAttributes(editor, "body", 600)}>${escapeHtml(settings.body)}</p></header><div class="contact-channel-list">${activeRows
          .map(([rowIcon, title, body, action, href]) => {
            const identityField =
              rowIcon === "mail"
                ? "email"
                : rowIcon === "phone"
                  ? "phone"
                  : rowIcon === "pin"
                    ? "address"
                    : undefined;
            const actionField =
              rowIcon === "chat"
                ? "whatsappActionLabel"
                : rowIcon === "mail"
                  ? "emailActionLabel"
                  : rowIcon === "phone"
                    ? "phoneActionLabel"
                    : rowIcon === "pin"
                      ? "addressActionLabel"
                      : "hoursActionLabel";
            const identityAttributes = identityField
              ? canvasEntityAttributes(
                  editor,
                  `identity-${identityField}`,
                  "identity",
                  context.project.id,
                  identityField,
                )
              : "";
            const valueAttributes =
              identityAttributes ||
              (rowIcon === "clock" ? canvasTextAttributes(editor, "hoursText", 400) : "");
            return `<a class="contact-channel-row" href="${escapeAttribute(safeUrl(href))}">${contactIconMarkup(rowIcon)}<span><strong>${escapeHtml(title)}</strong><small${valueAttributes}>${escapeHtml(body)}</small></span><span${canvasTextAttributes(editor, actionField, 120)}>${escapeHtml(action)} →</span></a>`;
          })
          .join("")}</div></section>`,
      ),
    );
  },
});

export const contactV2Modules = [contactForm, contactChannels] as const;

export const contactV2ModuleIds = new Set<string>(
  contactV2Modules.map((module) => module.manifest.id),
);
