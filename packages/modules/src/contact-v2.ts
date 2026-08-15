import {
  escapeAttribute,
  escapeHtml,
  type ModuleDefinition,
  moduleRoot,
  type RenderContext,
  renderImage,
  safeHtml,
  safeUrl,
} from "@solara/module-sdk";
import {
  CATALOG_MODERN_PLACEHOLDER_PHONE,
  contactDefaultFaqItems,
  contactDefaultHelpItems,
  contactDefaultPurchaseItems,
  contactDefaultQuickLinks,
  contactDefaultReasons,
} from "@solara/project-schema";
import { z } from "zod";
import { renderCatalogModernEditorialHero } from "./catalog-modern";
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

const contactQuickLinkSchema = z.object({
  id: z.string().min(1),
  icon: z.string().default("chat"),
  title: z.string().min(1),
  body: z.string().default(""),
  href: z.string().default("#"),
  actionLabel: z.string().default("Ver más"),
});

const contactHelpItemSchema = z.object({
  id: z.string().min(1),
  icon: z.string().default("question"),
  title: z.string().min(1),
  body: z.string().default(""),
  href: z.string().default("/contacto/"),
  actionLabel: z.string().default("Más información"),
});

const contactPurchaseItemSchema = z.object({
  id: z.string().min(1),
  icon: z.string().default("truck"),
  title: z.string().min(1),
  body: z.string().default(""),
  href: z.string().default("/contacto/"),
  actionLabel: z.string().default("Más información"),
});

const contactFaqItemSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  enabled: z.boolean().default(true),
});

const contactReasonSchema = z.object({
  id: z.string().min(1),
  value: z.string().min(1),
});

export const contactHeroSettings = z.object({
  eyebrow: z.string().default("HABLEMOS"),
  title: z.string().default("Estamos para ayudarte."),
  body: z
    .string()
    .default("Respondemos consultas, disponibilidad y detalles de entrega por canales directos."),
  actionLabel: z.string().default("Escribinos"),
  actionHref: z.string().default("#contact-form"),
  imageAssetId: z.string().default("asset-contact-hero"),
  quickLinks: z
    .array(contactQuickLinkSchema)
    .max(4)
    .default([...contactDefaultQuickLinks]),
});

export const contactFormSettings = z.object({
  title: z.string().default("Escribinos"),
  body: z.string().default("Completá el formulario y nuestro equipo te responderá a la brevedad."),
  showPhone: z.boolean().default(true),
  showOrderNumber: z.boolean().default(true),
  nameLabel: z.string().default("Nombre"),
  emailLabel: z.string().default("Email"),
  phoneLabel: z.string().default("Teléfono"),
  reasonLabel: z.string().default("Motivo de consulta"),
  orderNumberLabel: z.string().default("Número de pedido (opcional)"),
  messageLabel: z.string().default("Mensaje"),
  submitLabel: z.string().default("Enviar consulta"),
  reasons: z
    .array(contactReasonSchema)
    .max(12)
    .default(contactDefaultReasons.map((reason) => ({ ...reason }))),
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

export const contactHelpGridSettings = z.object({
  title: z.string().default("¿En qué podemos ayudarte?"),
  body: z.string().default("Elegí el tema para que podamos asistirte de la mejor manera."),
  items: z
    .array(contactHelpItemSchema)
    .max(4)
    .default([...contactDefaultHelpItems]),
});

export const contactWhatsappCtaSettings = z.object({
  title: z.string().default("¿Preferís hablar directamente?"),
  body: z
    .string()
    .default("Consultanos por WhatsApp y coordinamos tu compra de forma personalizada."),
  actionLabel: z.string().default("Iniciar conversación"),
});

export const contactPurchaseInfoSettings = z.object({
  items: z
    .array(contactPurchaseItemSchema)
    .max(3)
    .default([...contactDefaultPurchaseItems]),
});

export const contactFaqSettings = z.object({
  title: z.string().default("Preguntas frecuentes"),
  body: z.string().default("Respondemos las dudas más comunes."),
  items: z
    .array(contactFaqItemSchema)
    .max(8)
    .default([...contactDefaultFaqItems]),
});

export const contactLocationSettings = z.object({
  enabled: z.boolean().default(false),
  title: z.string().default("Visitanos"),
  body: z.string().default("Conocé nuestro espacio y probá lo que te representa."),
  address: z.string().default(""),
  hoursText: z.string().default(""),
  imageAssetId: z.string().default(""),
  mapHref: z.string().default(""),
  mapImageAssetId: z.string().default(""),
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

export const contactHero: ModuleDefinition<
  "contact-hero",
  z.infer<typeof contactHeroSettings>
> = contactModule({
  id: "contact-hero",
  name: "Hero de Contacto",
  description: "Introducción de Contacto con accesos rápidos.",
  compatibleSettings: [
    "eyebrow",
    "title",
    "body",
    "actionLabel",
    "actionHref",
    "imageAssetId",
    "quickLinks",
  ],
  settingsSchema: contactHeroSettings,
  settingsFields: [
    { key: "eyebrow", type: "text", label: "Antetítulo" },
    { key: "title", type: "text", label: "Título" },
    { key: "body", type: "text", label: "Descripción" },
    { key: "actionLabel", type: "text", label: "Botón" },
    { key: "actionHref", type: "url", label: "Destino" },
    { key: "imageAssetId", type: "asset", label: "Imagen vertical" },
    {
      key: "quickLinks",
      type: "repeater",
      label: "Accesos rápidos",
      maxItems: 4,
      itemLabelKey: "title",
      fields: [
        { key: "icon", type: "text", label: "Ícono" },
        { key: "title", type: "text", label: "Título" },
        { key: "body", type: "text", label: "Texto" },
        { key: "href", type: "url", label: "Destino" },
        { key: "actionLabel", type: "text", label: "Acción" },
      ],
    },
  ],
  motionZones: [...contactRevealZone, ...contactItemsZone],
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const settings = context.settings;
    const actions = settings.actionLabel
      ? `<a class="catalog-primary-action" href="${escapeAttribute(safeUrl(settings.actionHref))}">${escapeHtml(settings.actionLabel)} →</a>`
      : "";
    const quickLinks = `<div class="contact-quick-links contact-hero-links" data-motion-zone="items">${settings.quickLinks.map((item) => `<a class="contact-quick-link" href="${escapeAttribute(safeUrl(item.href))}">${contactIconMarkup(item.icon)}<span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.body)}</small></span><span aria-hidden="true">→</span></a>`).join("")}</div>`;
    return renderCatalogModernEditorialHero(context, {
      moduleId: "contact-hero",
      rootClassName: "contact-hero-module",
      innerClassName: "contact-hero",
      imageClassName: "contact-hero-image",
      eyebrow: settings.eyebrow,
      title: settings.title,
      body: settings.body,
      imageAssetId: settings.imageAssetId,
      actions,
      trailing: quickLinks,
    });
  },
});

export const contactForm: ModuleDefinition<
  "contact-form",
  z.infer<typeof contactFormSettings>
> = contactModule({
  id: "contact-form",
  name: "Formulario de Contacto",
  description: "Formulario que prepara una consulta para WhatsApp.",
  compatibleSettings: [
    "title",
    "body",
    "showPhone",
    "showOrderNumber",
    "nameLabel",
    "emailLabel",
    "phoneLabel",
    "reasonLabel",
    "orderNumberLabel",
    "messageLabel",
    "submitLabel",
    "reasons",
  ],
  settingsSchema: contactFormSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    { key: "body", type: "text", label: "Texto" },
    { key: "showPhone", type: "boolean", label: "Mostrar teléfono" },
    { key: "showOrderNumber", type: "boolean", label: "Mostrar número de pedido" },
    { key: "nameLabel", type: "text", label: "Label nombre" },
    { key: "emailLabel", type: "text", label: "Label email" },
    { key: "phoneLabel", type: "text", label: "Label teléfono" },
    { key: "reasonLabel", type: "text", label: "Label motivo" },
    { key: "orderNumberLabel", type: "text", label: "Label pedido" },
    { key: "messageLabel", type: "text", label: "Label mensaje" },
    { key: "submitLabel", type: "text", label: "Botón" },
    {
      key: "reasons",
      type: "repeater",
      label: "Motivos de consulta",
      maxItems: 12,
      itemLabelKey: "value",
      fields: [{ key: "value", type: "text", label: "Motivo" }],
    },
  ],
  motionZones: contactRevealZone,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const settings = context.settings;
    const phone = contactPhone(context);
    const fallback = phone
      ? `<a class="contact-form-fallback" href="https://wa.me/${escapeAttribute(phone)}">Escribinos por WhatsApp</a>`
      : `<p class="contact-form-fallback">Configurá un teléfono de WhatsApp para recibir consultas.</p>`;
    return moduleRoot(
      "contact-form",
      context.section,
      safeHtml(
        `<section id="contact-form" class="contact-main-grid" data-motion-zone="content"><form class="contact-form" data-solara-contact-form data-whatsapp-brand="${escapeAttribute(context.project.identity.brandName)}"${phone ? ` data-whatsapp-phone="${escapeAttribute(phone)}"` : ""} action="${phone ? `https://wa.me/${escapeAttribute(phone)}` : "#"}" method="get" target="_blank"><h2>${escapeHtml(settings.title)}</h2><p>${escapeHtml(settings.body)}</p><div class="contact-form-fields"><label>${escapeHtml(settings.nameLabel)}<input name="name" autocomplete="name" required></label><label>${escapeHtml(settings.emailLabel)}<input name="email" type="email" autocomplete="email" required></label>${settings.showPhone ? `<label>${escapeHtml(settings.phoneLabel)}<input name="phone" type="tel" autocomplete="tel" required></label>` : ""}<label>${escapeHtml(settings.reasonLabel)}<select name="reason" required><option value="">Seleccioná una opción</option>${settings.reasons.map((reason) => `<option value="${escapeAttribute(reason.value)}">${escapeHtml(reason.value)}</option>`).join("")}</select></label>${settings.showOrderNumber ? `<label>${escapeHtml(settings.orderNumberLabel)}<input name="orderNumber" inputmode="numeric"></label>` : ""}<label class="contact-form-message">${escapeHtml(settings.messageLabel)}<textarea name="message" rows="5" required></textarea></label></div><button class="catalog-primary-action" type="submit">${escapeHtml(settings.submitLabel)} →</button>${fallback}<noscript><p>Activá JavaScript o usá el enlace de WhatsApp para enviar la consulta.</p></noscript></form></section>`,
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
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const settings = context.settings;
    const phone = contactPhone(context);
    const rows: Array<[string, string, string, string, string] | null> = [
      settings.showWhatsapp && phone
        ? [
            "chat",
            "WhatsApp",
            "Respondemos de lunes a viernes.",
            settings.whatsappActionLabel,
            `https://wa.me/${phone}`,
          ]
        : null,
      settings.showEmail && context.project.identity.email
        ? [
            "mail",
            "Email",
            context.project.identity.email,
            settings.emailActionLabel,
            `mailto:${context.project.identity.email}`,
          ]
        : null,
      settings.showPhone && context.project.identity.phone
        ? [
            "phone",
            "Teléfono",
            context.project.identity.phone,
            settings.phoneActionLabel,
            `tel:${context.project.identity.phone}`,
          ]
        : null,
      settings.showAddress && context.project.identity.address
        ? [
            "pin",
            "Dirección",
            context.project.identity.address,
            settings.addressActionLabel,
            "#contact-location",
          ]
        : null,
      settings.showHours && settings.hoursText
        ? [
            "clock",
            "Horarios de atención",
            settings.hoursText,
            settings.hoursActionLabel,
            "#contact-location",
          ]
        : null,
    ];
    const activeRows = rows.filter(
      (row): row is [string, string, string, string, string] => row !== null,
    );
    return moduleRoot(
      "contact-channels",
      context.section,
      safeHtml(
        `<section id="contact-channels" class="contact-channels" data-motion-zone="items"><header><h2>${escapeHtml(settings.title)}</h2><p>${escapeHtml(settings.body)}</p></header><div class="contact-channel-list">${activeRows.map(([rowIcon, title, body, action, href]) => `<a class="contact-channel-row" href="${escapeAttribute(safeUrl(href))}">${contactIconMarkup(rowIcon)}<span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(body)}</small></span><span>${escapeHtml(action)} →</span></a>`).join("")}</div></section>`,
      ),
    );
  },
});

export const contactHelpGrid: ModuleDefinition<
  "contact-help-grid",
  z.infer<typeof contactHelpGridSettings>
> = contactModule({
  id: "contact-help-grid",
  name: "Centro de ayuda",
  description: "Cuatro accesos cuadrados para orientar consultas.",
  compatibleSettings: ["title", "body", "items"],
  settingsSchema: contactHelpGridSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    { key: "body", type: "text", label: "Texto" },
    {
      key: "items",
      type: "repeater",
      label: "Ayudas",
      maxItems: 4,
      itemLabelKey: "title",
      fields: [
        { key: "icon", type: "text", label: "Ícono" },
        { key: "title", type: "text", label: "Título" },
        { key: "body", type: "text", label: "Texto" },
        { key: "href", type: "url", label: "Destino" },
        { key: "actionLabel", type: "text", label: "Acción" },
      ],
    },
  ],
  motionZones: contactItemsZone,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const settings = context.settings;
    return moduleRoot(
      "contact-help-grid",
      context.section,
      safeHtml(
        `<section class="contact-help" data-motion-zone="items"><header><h2>${escapeHtml(settings.title)}</h2><p>${escapeHtml(settings.body)}</p></header><div class="contact-help-grid">${settings.items.map((item) => `<a class="contact-help-item" href="${escapeAttribute(safeUrl(item.href))}">${contactIconMarkup(item.icon)}<strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p><span>${escapeHtml(item.actionLabel)} →</span></a>`).join("")}</div></section>`,
      ),
    );
  },
});

export const contactWhatsappCta: ModuleDefinition<
  "contact-whatsapp-cta",
  z.infer<typeof contactWhatsappCtaSettings>
> = contactModule({
  id: "contact-whatsapp-cta",
  name: "CTA WhatsApp de Contacto",
  description: "Bloque oscuro de conversación directa.",
  compatibleSettings: ["title", "body", "actionLabel"],
  settingsSchema: contactWhatsappCtaSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    { key: "body", type: "text", label: "Texto" },
    { key: "actionLabel", type: "text", label: "Botón" },
  ],
  motionZones: contactRevealZone,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const phone = contactPhone(context);
    if (!phone) return safeHtml("");
    const settings = context.settings;
    return moduleRoot(
      "contact-whatsapp-cta",
      context.section,
      safeHtml(
        `<section class="contact-whatsapp-cta" data-motion-zone="content"><div><h2>${escapeHtml(settings.title)}</h2><p>${escapeHtml(settings.body)}</p></div><a class="catalog-primary-action" href="https://wa.me/${escapeAttribute(phone)}">${escapeHtml(settings.actionLabel)} →</a></section>`,
      ),
    );
  },
});

export const contactPurchaseInfo: ModuleDefinition<
  "contact-purchase-info",
  z.infer<typeof contactPurchaseInfoSettings>
> = contactModule({
  id: "contact-purchase-info",
  name: "Información de compra",
  description: "Franja editorial de envíos, pagos y cambios.",
  compatibleSettings: ["items"],
  settingsSchema: contactPurchaseInfoSettings,
  settingsFields: [
    {
      key: "items",
      type: "repeater",
      label: "Información",
      maxItems: 3,
      itemLabelKey: "title",
      fields: [
        { key: "icon", type: "text", label: "Ícono" },
        { key: "title", type: "text", label: "Título" },
        { key: "body", type: "text", label: "Texto" },
        { key: "href", type: "url", label: "Destino" },
        { key: "actionLabel", type: "text", label: "Acción" },
      ],
    },
  ],
  motionZones: contactItemsZone,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    return moduleRoot(
      "contact-purchase-info",
      context.section,
      safeHtml(
        `<section class="contact-purchase-info" data-motion-zone="items">${context.settings.items.map((item) => `<article><div>${contactIconMarkup(item.icon)}<strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p><a href="${escapeAttribute(safeUrl(item.href))}">${escapeHtml(item.actionLabel)} →</a></div></article>`).join("")}</section>`,
      ),
    );
  },
});

export const contactFaq: ModuleDefinition<
  "contact-faq",
  z.infer<typeof contactFaqSettings>
> = contactModule({
  id: "contact-faq",
  name: "Preguntas frecuentes de Contacto",
  description: "Acordeón editable de dudas frecuentes.",
  compatibleSettings: ["title", "body", "items"],
  settingsSchema: contactFaqSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    { key: "body", type: "text", label: "Texto" },
    {
      key: "items",
      type: "repeater",
      label: "Preguntas",
      maxItems: 8,
      itemLabelKey: "question",
      fields: [
        { key: "question", type: "text", label: "Pregunta" },
        { key: "answer", type: "text", label: "Respuesta" },
        { key: "enabled", type: "boolean", label: "Activa" },
      ],
    },
  ],
  motionZones: contactItemsZone,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const activeItems = context.settings.items.filter((item) => item.enabled);
    return moduleRoot(
      "contact-faq",
      context.section,
      safeHtml(
        `<section id="contact-faq" class="contact-faq" data-motion-zone="items"><header><h2>${escapeHtml(context.settings.title)}</h2><p>${escapeHtml(context.settings.body)}</p></header><div>${activeItems.map((item) => `<details><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join("")}</div></section>`,
      ),
    );
  },
});

export const contactLocation: ModuleDefinition<
  "contact-location",
  z.infer<typeof contactLocationSettings>
> = contactModule({
  id: "contact-location",
  name: "Ubicación de Contacto",
  description: "Local, horarios, mapa o fotografía opcional.",
  compatibleSettings: [
    "enabled",
    "title",
    "body",
    "address",
    "hoursText",
    "imageAssetId",
    "mapHref",
    "mapImageAssetId",
  ],
  settingsSchema: contactLocationSettings,
  settingsFields: [
    { key: "enabled", type: "boolean", label: "Mostrar ubicación" },
    { key: "title", type: "text", label: "Título" },
    { key: "body", type: "text", label: "Texto" },
    { key: "address", type: "text", label: "Dirección" },
    { key: "hoursText", type: "text", label: "Horarios" },
    { key: "imageAssetId", type: "asset", label: "Fotografía del local" },
    { key: "mapHref", type: "url", label: "URL Cómo llegar" },
    { key: "mapImageAssetId", type: "asset", label: "Imagen del mapa" },
  ],
  motionZones: contactRevealZone,
  styleAsset: scopedAssetId("catalog-modern"),
  render(context) {
    const settings = context.settings;
    if (
      !settings.enabled ||
      (!settings.address && !settings.imageAssetId && !settings.mapImageAssetId)
    ) {
      return safeHtml("");
    }
    const image = settings.imageAssetId
      ? renderImage(context.project, settings.imageAssetId, {
          className: "contact-location-image",
          loading: "lazy",
          sizes: "(max-width: 767px) 100vw, 50vw",
          fallbackAlt: settings.title,
        })
      : "";
    const map = settings.mapImageAssetId
      ? renderImage(context.project, settings.mapImageAssetId, {
          className: "contact-location-map",
          loading: "lazy",
          sizes: "(max-width: 767px) 100vw, 50vw",
          fallbackAlt: "Mapa de ubicación",
        })
      : "";
    return moduleRoot(
      "contact-location",
      context.section,
      safeHtml(
        `<section id="contact-location" class="contact-location" data-motion-zone="content"><header><h2>${escapeHtml(settings.title)}</h2><p>${escapeHtml(settings.body)}</p></header><div class="contact-location-grid">${image}${map}</div><div class="contact-location-meta">${settings.address ? `<p><strong>Dirección</strong>${escapeHtml(settings.address)}</p>` : ""}${settings.hoursText ? `<p><strong>Horarios</strong>${escapeHtml(settings.hoursText)}</p>` : ""}${settings.mapHref ? `<a class="solara-secondary-action" href="${escapeAttribute(safeUrl(settings.mapHref))}">Cómo llegar →</a>` : ""}</div></section>`,
      ),
    );
  },
});

export const contactV2Modules = [
  contactHero,
  contactForm,
  contactChannels,
  contactHelpGrid,
  contactWhatsappCta,
  contactPurchaseInfo,
  contactFaq,
  contactLocation,
] as const;

export const contactV2ModuleIds = new Set<string>(
  contactV2Modules.map((module) => module.manifest.id),
);
