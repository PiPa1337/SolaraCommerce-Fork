import {
  type CanvasBinding,
  canvasEntityAttributes,
  canvasImageAttributes,
  canvasRepeaterItemAttributes,
  canvasTextAttributes,
  escapeAttribute,
  escapeHtml,
  type ModuleDefinition,
  type MotionZoneDefinition,
  moduleRoot,
  type RenderContext,
  renderImage,
  type SafeHtml,
  type SettingsFieldDefinition,
  safeHtml,
  safeUrl,
  sanitizeRichText,
} from "@solara/module-sdk";
import {
  aboutDefaultExperience,
  aboutDefaultHistoryParagraphs,
  aboutDefaultPrinciples,
  aboutDefaultProcess,
  aboutDefaultStats,
  aboutDefaultTeam,
} from "@solara/project-schema";
import { z } from "zod";
import { renderCatalogModernEditorialHero } from "./catalog-modern";
import { scopedAssetId } from "./helpers";

const aboutRevealZone = [
  {
    id: "content",
    label: "Contenido",
    selector: '[data-motion-zone="content"]',
    allowedPresets: ["none", "fade", "fade-up", "slide", "scale"] as const,
  },
] as const satisfies readonly MotionZoneDefinition[];

const aboutItemsZone = [
  {
    id: "items",
    label: "Elementos",
    selector: '[data-motion-zone="items"]',
    allowedPresets: ["none", "fade", "fade-up", "stagger"] as const,
  },
] as const satisfies readonly MotionZoneDefinition[];

const aboutManifest = <Id extends string>(input: {
  id: Id;
  name: string;
  description: string;
  compatibleSettings: readonly string[];
}) => ({
  ...input,
  version: 1 as const,
  family: "catalog-modern-v2" as const,
  availability: "default" as const,
  slots: ["content"] as const,
});

type AboutModuleInput<Id extends string, Settings> = {
  id: Id;
  name: string;
  description: string;
  compatibleSettings: readonly string[];
  settingsSchema: z.ZodType<Settings>;
  settingsFields: readonly SettingsFieldDefinition<Settings>[];
  motionZones: readonly MotionZoneDefinition[];
  canvasBindings?: readonly CanvasBinding[];
  render(context: RenderContext<Settings>): SafeHtml;
};

const aboutModule = <Id extends string, Settings>(
  input: AboutModuleInput<Id, Settings>,
): ModuleDefinition<Id, Settings> => ({
  manifest: aboutManifest(input),
  settingsSchema: input.settingsSchema,
  settingsFields: input.settingsFields,
  motionZones: input.motionZones,
  ...(input.canvasBindings === undefined ? {} : { canvasBindings: input.canvasBindings }),
  styleAsset: scopedAssetId("catalog-modern"),
  render: input.render,
});

function aboutCanvasContext(context: Pick<RenderContext<unknown>, "canvas" | "section">) {
  return {
    editorMode: context.canvas?.editorMode === true,
    sectionId: context.section.id,
  } as const;
}

const iconPaths: Record<string, string> = {
  bag: '<path d="M5 8h14l1 12H4z"></path><path d="M8 8a4 4 0 0 1 8 0"></path>',
  chat: '<path d="M4 5h16v11H9.5L4 19.5z"></path>',
  eye: '<path d="M2.5 12s3.3-5 9.5-5 9.5 5 9.5 5-3.3 5-9.5 5-9.5-5-9.5-5z"></path><circle cx="12" cy="12" r="2.2"></circle>',
  minus: '<path d="M5 12h14"></path>',
  shield: '<path d="M12 3l7 2.5v5.5c0 4.2-2.9 7.2-7 8.5-4.1-1.3-7-4.3-7-8.5V5.5z"></path>',
  spark:
    '<path d="m12 2 1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6z"></path><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6z"></path>',
  truck:
    '<path d="M2 6.5h10.5V15H2z"></path><path d="M12.5 9.5H17l3.5 3.5v2h-8"></path><circle cx="6.5" cy="15.5" r="1.7"></circle><circle cx="16.5" cy="15.5" r="1.7"></circle>',
  user: '<circle cx="12" cy="8" r="3.5"></circle><path d="M4.5 20a7.5 7.5 0 0 1 15 0"></path>',
};

const aboutIcon = (name: string, attributes = ""): string =>
  `<span class="solara-about-icon" aria-hidden="true"${attributes}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name] ?? iconPaths.spark}</svg></span>`;

const aboutLink = (href: string, label: string, className = ""): string =>
  href.trim()
    ? `<a${className ? ` class="${escapeAttribute(className)}"` : ""} href="${escapeAttribute(safeUrl(href))}">${escapeHtml(label)} →</a>`
    : "";

export const aboutHeroSettings = z.object({
  eyebrow: z.string().default("NUESTRA MIRADA"),
  title: z.string().default("Una selección pensada para moverte."),
  body: z.string().default("Elegimos piezas con intención para acompañar tu forma de vivir."),
  actionLabel: z.string().default("Explorar selección"),
  actionHref: z.string().default("/buscar/"),
  imageAssetId: z.string().default("asset-about-hero"),
});

export const aboutHistorySettings = z.object({
  title: z.string().default("Cómo empezó todo"),
  paragraphs: z
    .array(z.object({ id: z.string().min(1), body: z.string().min(1) }))
    .max(3)
    .default([...aboutDefaultHistoryParagraphs]),
  year: z.string().default("DESDE 2026"),
  city: z.string().default("BUENOS AIRES"),
  country: z.string().default("ARGENTINA"),
});

export const aboutPrinciplesSettings = z.object({
  title: z.string().default("Lo que nos guía"),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        number: z.string().min(1),
        icon: z.string().default("spark"),
        title: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .max(4)
    .default([...aboutDefaultPrinciples]),
});

export const aboutEditorialImageSettings = z.object({
  enabled: z.boolean().default(true),
  eyebrow: z.string().default("NUESTRA FORMA DE ELEGIR"),
  title: z.string().default("Menos ruido. Mejores elecciones."),
  body: z
    .string()
    .default("Buscamos piezas que tengan sentido, se usen de verdad y puedan quedarse con vos."),
  imageAssetId: z.string().default("asset-manta"),
});

export const aboutProcessSettings = z.object({
  title: z.string().default("Cómo seleccionamos"),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        number: z.string().min(1),
        title: z.string().min(1),
        body: z.string().min(1),
        href: z.string().default(""),
      }),
    )
    .max(4)
    .default([...aboutDefaultProcess]),
});

export const aboutManifestoSettings = z.object({
  quote: z.string().default("No buscamos tener de todo. Buscamos tener lo que vale la pena."),
  accentLabel: z.string().default("Nuestra manera de hacer las cosas"),
});

export const aboutExperienceSettings = z.object({
  title: z.string().default("La experiencia"),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        icon: z.string().default("spark"),
        title: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .max(4)
    .default([...aboutDefaultExperience]),
});

export const aboutTeamSettings = z.object({
  enabled: z.boolean().default(true),
  title: z.string().default("Detrás de la tienda"),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        imageAssetId: z.string().default(""),
        name: z.string().min(1),
        role: z.string().min(1),
        body: z.string().default(""),
      }),
    )
    .max(4)
    .default([...aboutDefaultTeam]),
});

export const aboutStatsSettings = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        icon: z.string().default("spark"),
        title: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .max(4)
    .default([...aboutDefaultStats]),
});

export const aboutProductsCtaSettings = z.object({
  title: z.string().default("Conocé nuestra selección."),
  body: z.string().default("Encontrá piezas elegidas para acompañarte todos los días."),
  actionLabel: z.string().default("Explorar productos"),
  actionHref: z.string().default("/buscar/"),
});

export const aboutHero: ModuleDefinition<
  "about-hero",
  z.infer<typeof aboutHeroSettings>
> = aboutModule({
  id: "about-hero",
  name: "Hero de Nosotros",
  description: "Introducción editorial de la marca con imagen vertical opcional.",
  compatibleSettings: ["eyebrow", "title", "body", "actionLabel", "actionHref", "imageAssetId"],
  settingsSchema: aboutHeroSettings,
  settingsFields: [
    { key: "eyebrow", type: "text", label: "Antetítulo" },
    { key: "title", type: "text", label: "Título" },
    { key: "body", type: "text", label: "Descripción" },
    { key: "actionLabel", type: "text", label: "Botón" },
    { key: "actionHref", type: "url", label: "Destino" },
    { key: "imageAssetId", type: "asset", label: "Imagen vertical" },
  ],
  motionZones: aboutRevealZone,
  canvasBindings: [
    {
      id: "title",
      label: "Título de Nosotros",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "title" },
      capabilities: ["edit-text"],
      multiline: true,
      maxLength: 200,
    },
    {
      id: "body",
      label: "Texto de Nosotros",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "body" },
      capabilities: ["edit-text"],
      multiline: true,
      maxLength: 600,
    },
    {
      id: "eyebrow",
      label: "Antetítulo de Nosotros",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "eyebrow" },
      capabilities: ["edit-text"],
      maxLength: 120,
    },
    {
      id: "actionLabel",
      label: "Botón de Nosotros",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "actionLabel" },
      capabilities: ["edit-text"],
      maxLength: 120,
    },
    {
      id: "actionHref",
      label: "Destino del botón de Nosotros",
      kind: "link",
      source: { kind: "section-setting", fieldKey: "actionHref" },
      capabilities: ["edit-link"],
    },
    {
      id: "imageAssetId",
      label: "Imagen de Nosotros",
      kind: "image",
      source: { kind: "section-setting", fieldKey: "imageAssetId" },
      capabilities: ["edit-image"],
    },
    {
      id: "asset-alt",
      label: "Texto alternativo de la imagen",
      kind: "text",
      source: { kind: "asset", entityId: "*", field: "alt" },
      capabilities: ["edit-alt", "edit-text"],
      maxLength: 500,
    },
  ],
  render(context) {
    const settings = context.settings;
    const editor = aboutCanvasContext(context);
    const actions = settings.actionLabel
      ? `<a class="catalog-primary-action" href="${escapeAttribute(safeUrl(settings.actionHref))}"${canvasTextAttributes(editor, "actionHref")}><span${canvasTextAttributes(editor, "actionLabel", 120)}>${escapeHtml(settings.actionLabel)}</span> →</a>`
      : "";
    return renderCatalogModernEditorialHero(context, {
      moduleId: "about-hero",
      rootClassName: "about-hero-module",
      innerClassName: "about-hero",
      imageClassName: "about-hero-image",
      eyebrow: settings.eyebrow,
      title: settings.title,
      body: settings.body,
      imageAssetId: settings.imageAssetId,
      benefits: [],
      actions,
      canvasBindingIds: ["eyebrow", "title", "body", "imageAssetId"],
    });
  },
});

export const aboutHistory: ModuleDefinition<
  "about-history",
  z.infer<typeof aboutHistorySettings>
> = aboutModule({
  id: "about-history",
  name: "Historia de Nosotros",
  description: "Relato editorial y metadatos de la marca.",
  compatibleSettings: ["title", "paragraphs", "year", "city", "country"],
  settingsSchema: aboutHistorySettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    {
      key: "paragraphs",
      type: "repeater",
      label: "Párrafos",
      maxItems: 3,
      itemLabelKey: "body",
      fields: [{ key: "body", type: "text", label: "Texto" }],
    },
    { key: "year", type: "text", label: "Año" },
    { key: "city", type: "text", label: "Ciudad" },
    { key: "country", type: "text", label: "País" },
  ],
  motionZones: aboutRevealZone,
  canvasBindings: [
    {
      id: "title",
      label: "Título de la historia",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "title" },
      capabilities: ["edit-text"],
      maxLength: 160,
    },
    {
      id: "paragraph-body",
      label: "Párrafo de historia",
      kind: "text",
      source: { kind: "section-repeater-item", fieldKey: "paragraphs", itemFieldKey: "body" },
      capabilities: ["edit-repeater-item", "edit-text"],
      multiline: true,
      maxLength: 1000,
    },
    {
      id: "year",
      label: "Año de la historia",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "year" },
      capabilities: ["edit-text"],
      maxLength: 40,
    },
    {
      id: "city",
      label: "Ciudad de la historia",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "city" },
      capabilities: ["edit-text"],
      maxLength: 80,
    },
    {
      id: "country",
      label: "País de la historia",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "country" },
      capabilities: ["edit-text"],
      maxLength: 80,
    },
  ],
  render(context) {
    const settings = context.settings;
    const editor = aboutCanvasContext(context);
    return moduleRoot(
      "about-history",
      context.section,
      safeHtml(
        `<div class="about-history" data-motion-zone="content"><header><p class="solara-eyebrow">Nuestra historia</p><h2${canvasTextAttributes(editor, "title", 160)}>${escapeHtml(settings.title)}</h2></header><div class="about-history-copy">${settings.paragraphs.map((paragraph) => `<p${canvasRepeaterItemAttributes(editor, "paragraph-body", paragraph.id)}>${escapeHtml(paragraph.body)}</p>`).join("")}<p class="about-history-meta"><span${canvasTextAttributes(editor, "year", 40)}>${escapeHtml(settings.year)}</span><span${canvasTextAttributes(editor, "city", 80)}>${escapeHtml(settings.city)}</span><span${canvasTextAttributes(editor, "country", 80)}>${escapeHtml(settings.country)}</span></p></div></div>`,
      ),
    );
  },
});

export const aboutPrinciples: ModuleDefinition<
  "about-principles",
  z.infer<typeof aboutPrinciplesSettings>
> = aboutModule({
  id: "about-principles",
  name: "Principios de Nosotros",
  description: "Cuatro principios editoriales de la marca.",
  compatibleSettings: ["title", "items"],
  settingsSchema: aboutPrinciplesSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    {
      key: "items",
      type: "repeater",
      label: "Principios",
      maxItems: 4,
      itemLabelKey: "title",
      fields: [
        { key: "number", type: "text", label: "Número" },
        { key: "icon", type: "text", label: "Ícono" },
        { key: "title", type: "text", label: "Título" },
        { key: "body", type: "text", label: "Texto" },
      ],
    },
  ],
  motionZones: aboutItemsZone,
  canvasBindings: [
    {
      id: "title",
      label: "Título de principios",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "title" },
      capabilities: ["edit-text"],
      maxLength: 160,
    },
    {
      id: "item-number",
      label: "Número de principio",
      kind: "repeater-item",
      source: { kind: "section-repeater-item", fieldKey: "items", itemFieldKey: "number" },
      capabilities: ["edit-repeater-item", "edit-text"],
      maxLength: 40,
    },
    {
      id: "item-icon",
      label: "Ícono de principio",
      kind: "repeater-item",
      source: { kind: "section-repeater-item", fieldKey: "items", itemFieldKey: "icon" },
      capabilities: ["edit-repeater-item", "edit-text"],
      maxLength: 40,
    },
    {
      id: "item-title",
      label: "Título de principio",
      kind: "repeater-item",
      source: { kind: "section-repeater-item", fieldKey: "items", itemFieldKey: "title" },
      capabilities: ["edit-repeater-item", "edit-text"],
      maxLength: 160,
    },
    {
      id: "item-body",
      label: "Texto de principio",
      kind: "repeater-item",
      source: { kind: "section-repeater-item", fieldKey: "items", itemFieldKey: "body" },
      capabilities: ["edit-repeater-item", "edit-text"],
      multiline: true,
      maxLength: 600,
    },
  ],
  render(context) {
    const settings = context.settings;
    const editor = aboutCanvasContext(context);
    return moduleRoot(
      "about-principles",
      context.section,
      safeHtml(
        `<section class="about-principles" data-motion-zone="items"><header><p class="solara-eyebrow">Criterio</p><h2${canvasTextAttributes(editor, "title", 160)}>${escapeHtml(settings.title)}</h2></header><div class="about-principles-grid">${settings.items.map((item) => `<article class="about-principle-item"><span class="about-principle-number"${canvasRepeaterItemAttributes(editor, "item-number", item.id)}>${escapeHtml(item.number)}</span>${aboutIcon(item.icon, canvasRepeaterItemAttributes(editor, "item-icon", item.id))}<h3${canvasRepeaterItemAttributes(editor, "item-title", item.id)}>${escapeHtml(item.title)}</h3><p${canvasRepeaterItemAttributes(editor, "item-body", item.id)}>${escapeHtml(item.body)}</p></article>`).join("")}</div></section>`,
      ),
    );
  },
});

export const aboutEditorialImage: ModuleDefinition<
  "about-editorial-image",
  z.infer<typeof aboutEditorialImageSettings>
> = aboutModule({
  id: "about-editorial-image",
  name: "Imagen Editorial de Nosotros",
  description: "Imagen horizontal y texto sobre el criterio de selección.",
  compatibleSettings: ["enabled", "eyebrow", "title", "body", "imageAssetId"],
  settingsSchema: aboutEditorialImageSettings,
  settingsFields: [
    { key: "enabled", type: "boolean", label: "Mostrar imagen editorial" },
    { key: "eyebrow", type: "text", label: "Antetítulo" },
    { key: "title", type: "text", label: "Título" },
    { key: "body", type: "text", label: "Texto" },
    { key: "imageAssetId", type: "asset", label: "Imagen horizontal" },
  ],
  motionZones: aboutRevealZone,
  canvasBindings: [
    {
      id: "enabled",
      label: "Mostrar imagen editorial",
      kind: "boolean",
      source: { kind: "section-setting", fieldKey: "enabled" },
      capabilities: ["toggle-boolean"],
    },
    {
      id: "eyebrow",
      label: "Antetítulo editorial",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "eyebrow" },
      capabilities: ["edit-text"],
      maxLength: 120,
    },
    {
      id: "title",
      label: "Título editorial",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "title" },
      capabilities: ["edit-text"],
      maxLength: 160,
    },
    {
      id: "body",
      label: "Texto editorial",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "body" },
      capabilities: ["edit-text"],
      multiline: true,
      maxLength: 800,
    },
    {
      id: "imageAssetId",
      label: "Imagen editorial",
      kind: "image",
      source: { kind: "section-setting", fieldKey: "imageAssetId" },
      capabilities: ["edit-image"],
    },
    {
      id: "asset-alt",
      label: "Texto alternativo editorial",
      kind: "text",
      source: { kind: "asset", entityId: "*", field: "alt" },
      capabilities: ["edit-alt", "edit-text"],
      maxLength: 500,
    },
  ],
  render(context) {
    const settings = context.settings;
    if (!settings.enabled || !settings.imageAssetId) return safeHtml("");
    const image = renderImage(context.project, settings.imageAssetId, {
      className: "about-editorial-image-photo",
      loading: "lazy",
      sizes: "(max-width: 767px) 100vw, 90vw",
      fallbackAlt: settings.title,
    });
    const editor = aboutCanvasContext(context);
    const imageMarkup = image.replace(
      "<img",
      `<img${canvasEntityAttributes(editor, "asset-alt", "asset", settings.imageAssetId, "alt")}`,
    );
    return moduleRoot(
      "about-editorial-image",
      context.section,
      safeHtml(
        `<section class="about-editorial-image" data-motion-zone="content"><div class="about-editorial-image-media"${canvasImageAttributes(editor, "imageAssetId")}>${imageMarkup}</div><div class="about-editorial-image-copy"><div><p class="solara-eyebrow"${canvasTextAttributes(editor, "eyebrow", 120)}>${escapeHtml(settings.eyebrow)}</p><h2${canvasTextAttributes(editor, "title", 160)}>${escapeHtml(settings.title)}</h2></div><p${canvasTextAttributes(editor, "body", 800)}>${escapeHtml(settings.body)}</p></div></section>`,
      ),
    );
  },
});

export const aboutProcess: ModuleDefinition<
  "about-process",
  z.infer<typeof aboutProcessSettings>
> = aboutModule({
  id: "about-process",
  name: "Proceso de Selección",
  description: "Pasos editoriales que explican cómo se arma la selección.",
  compatibleSettings: ["title", "items"],
  settingsSchema: aboutProcessSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    {
      key: "items",
      type: "repeater",
      label: "Pasos",
      maxItems: 4,
      itemLabelKey: "title",
      fields: [
        { key: "number", type: "text", label: "Número" },
        { key: "title", type: "text", label: "Título" },
        { key: "body", type: "text", label: "Texto" },
        { key: "href", type: "url", label: "Destino" },
      ],
    },
  ],
  motionZones: aboutItemsZone,
  canvasBindings: [
    {
      id: "title",
      label: "Título del proceso",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "title" },
      capabilities: ["edit-text"],
      maxLength: 160,
    },
    {
      id: "item-number",
      label: "Número de paso",
      kind: "repeater-item",
      source: { kind: "section-repeater-item", fieldKey: "items", itemFieldKey: "number" },
      capabilities: ["edit-repeater-item", "edit-text"],
      maxLength: 40,
    },
    {
      id: "item-title",
      label: "Título de paso",
      kind: "repeater-item",
      source: { kind: "section-repeater-item", fieldKey: "items", itemFieldKey: "title" },
      capabilities: ["edit-repeater-item", "edit-text"],
      maxLength: 160,
    },
    {
      id: "item-body",
      label: "Texto de paso",
      kind: "repeater-item",
      source: { kind: "section-repeater-item", fieldKey: "items", itemFieldKey: "body" },
      capabilities: ["edit-repeater-item", "edit-text"],
      multiline: true,
      maxLength: 600,
    },
    {
      id: "item-href",
      label: "Destino de paso",
      kind: "repeater-item",
      source: { kind: "section-repeater-item", fieldKey: "items", itemFieldKey: "href" },
      capabilities: ["edit-repeater-item", "edit-link"],
    },
  ],
  render(context) {
    const settings = context.settings;
    const editor = aboutCanvasContext(context);
    return moduleRoot(
      "about-process",
      context.section,
      safeHtml(
        `<section class="about-process" data-motion-zone="items"><header><p class="solara-eyebrow">El proceso</p><h2${canvasTextAttributes(editor, "title", 160)}>${escapeHtml(settings.title)}</h2></header><div class="about-process-grid">${settings.items.map((item) => `<article class="about-process-item"><span class="about-process-number"${canvasRepeaterItemAttributes(editor, "item-number", item.id)}>${escapeHtml(item.number)}</span><h3${canvasRepeaterItemAttributes(editor, "item-title", item.id)}>${escapeHtml(item.title)}</h3><p${canvasRepeaterItemAttributes(editor, "item-body", item.id)}>${escapeHtml(item.body)}</p>${item.href.trim() ? `<a href="${escapeAttribute(safeUrl(item.href))}"${canvasRepeaterItemAttributes(editor, "item-href", item.id)}>Explorar →</a>` : ""}</article>`).join("")}</div></section>`,
      ),
    );
  },
});

export const aboutManifesto: ModuleDefinition<
  "about-manifesto",
  z.infer<typeof aboutManifestoSettings>
> = aboutModule({
  id: "about-manifesto",
  name: "Manifiesto de Nosotros",
  description: "Frase de marca con tratamiento editorial oscuro.",
  compatibleSettings: ["quote", "accentLabel"],
  settingsSchema: aboutManifestoSettings,
  settingsFields: [
    { key: "quote", type: "text", label: "Manifiesto" },
    { key: "accentLabel", type: "text", label: "Acento" },
  ],
  motionZones: aboutRevealZone,
  canvasBindings: [
    {
      id: "quote",
      label: "Manifiesto",
      kind: "rich-text",
      source: { kind: "section-setting", fieldKey: "quote" },
      capabilities: ["edit-rich-text"],
      multiline: true,
      maxLength: 600,
    },
    {
      id: "accentLabel",
      label: "Acento del manifiesto",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "accentLabel" },
      capabilities: ["edit-text"],
      maxLength: 160,
    },
  ],
  render(context) {
    const settings = context.settings;
    const editor = aboutCanvasContext(context);
    return moduleRoot(
      "about-manifesto",
      context.section,
      safeHtml(
        `<section class="about-manifesto" data-motion-zone="content"><blockquote${canvasTextAttributes(editor, "quote", 600)}>${sanitizeRichText(settings.quote)}</blockquote>${settings.accentLabel ? `<p class="about-manifesto-accent"${canvasTextAttributes(editor, "accentLabel", 160)}>${escapeHtml(settings.accentLabel)}</p>` : ""}</section>`,
      ),
    );
  },
});

export const aboutExperience: ModuleDefinition<
  "about-experience",
  z.infer<typeof aboutExperienceSettings>
> = aboutModule({
  id: "about-experience",
  name: "Experiencia de Nosotros",
  description: "Cuatro garantías de una compra clara y cercana.",
  compatibleSettings: ["title", "items"],
  settingsSchema: aboutExperienceSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    {
      key: "items",
      type: "repeater",
      label: "Experiencias",
      maxItems: 4,
      itemLabelKey: "title",
      fields: [
        { key: "icon", type: "text", label: "Ícono" },
        { key: "title", type: "text", label: "Título" },
        { key: "body", type: "text", label: "Texto" },
      ],
    },
  ],
  motionZones: aboutItemsZone,
  canvasBindings: [
    {
      id: "title",
      label: "Título de experiencia",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "title" },
      capabilities: ["edit-text"],
      maxLength: 160,
    },
    {
      id: "item-icon",
      label: "Ícono de experiencia",
      kind: "repeater-item",
      source: { kind: "section-repeater-item", fieldKey: "items", itemFieldKey: "icon" },
      capabilities: ["edit-repeater-item", "edit-text"],
      maxLength: 40,
    },
    {
      id: "item-title",
      label: "Título de experiencia",
      kind: "repeater-item",
      source: { kind: "section-repeater-item", fieldKey: "items", itemFieldKey: "title" },
      capabilities: ["edit-repeater-item", "edit-text"],
      maxLength: 160,
    },
    {
      id: "item-body",
      label: "Texto de experiencia",
      kind: "repeater-item",
      source: { kind: "section-repeater-item", fieldKey: "items", itemFieldKey: "body" },
      capabilities: ["edit-repeater-item", "edit-text"],
      multiline: true,
      maxLength: 600,
    },
  ],
  render(context) {
    const settings = context.settings;
    const editor = aboutCanvasContext(context);
    return moduleRoot(
      "about-experience",
      context.section,
      safeHtml(
        `<section class="about-experience" data-motion-zone="items"><header><p class="solara-eyebrow">La diferencia</p><h2${canvasTextAttributes(editor, "title", 160)}>${escapeHtml(settings.title)}</h2></header><div class="about-experience-grid">${settings.items.map((item) => `<article>${aboutIcon(item.icon, canvasRepeaterItemAttributes(editor, "item-icon", item.id))}<h3${canvasRepeaterItemAttributes(editor, "item-title", item.id)}>${escapeHtml(item.title)}</h3><p${canvasRepeaterItemAttributes(editor, "item-body", item.id)}>${escapeHtml(item.body)}</p></article>`).join("")}</div></section>`,
      ),
    );
  },
});

export const aboutTeam: ModuleDefinition<
  "about-team",
  z.infer<typeof aboutTeamSettings>
> = aboutModule({
  id: "about-team",
  name: "Equipo de Nosotros",
  description: "Presentación opcional de las personas detrás de la tienda.",
  compatibleSettings: ["enabled", "title", "items"],
  settingsSchema: aboutTeamSettings,
  settingsFields: [
    { key: "enabled", type: "boolean", label: "Mostrar equipo" },
    { key: "title", type: "text", label: "Título" },
    {
      key: "items",
      type: "repeater",
      label: "Personas",
      maxItems: 4,
      itemLabelKey: "name",
      fields: [
        { key: "imageAssetId", type: "asset", label: "Imagen" },
        { key: "name", type: "text", label: "Nombre" },
        { key: "role", type: "text", label: "Función" },
        { key: "body", type: "text", label: "Descripción" },
      ],
    },
  ],
  motionZones: aboutItemsZone,
  canvasBindings: [
    {
      id: "enabled",
      label: "Mostrar equipo",
      kind: "boolean",
      source: { kind: "section-setting", fieldKey: "enabled" },
      capabilities: ["toggle-boolean"],
    },
    {
      id: "title",
      label: "Título del equipo",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "title" },
      capabilities: ["edit-text"],
      maxLength: 160,
    },
    {
      id: "item-image",
      label: "Imagen de integrante",
      kind: "image",
      source: { kind: "section-repeater-item", fieldKey: "items", itemFieldKey: "imageAssetId" },
      capabilities: ["edit-repeater-item", "edit-image"],
    },
    {
      id: "item-name",
      label: "Nombre de integrante",
      kind: "repeater-item",
      source: { kind: "section-repeater-item", fieldKey: "items", itemFieldKey: "name" },
      capabilities: ["edit-repeater-item", "edit-text"],
      maxLength: 160,
    },
    {
      id: "item-role",
      label: "Función de integrante",
      kind: "repeater-item",
      source: { kind: "section-repeater-item", fieldKey: "items", itemFieldKey: "role" },
      capabilities: ["edit-repeater-item", "edit-text"],
      maxLength: 160,
    },
    {
      id: "item-body",
      label: "Descripción de integrante",
      kind: "repeater-item",
      source: { kind: "section-repeater-item", fieldKey: "items", itemFieldKey: "body" },
      capabilities: ["edit-repeater-item", "edit-text"],
      multiline: true,
      maxLength: 600,
    },
    {
      id: "asset-alt",
      label: "Texto alternativo del integrante",
      kind: "text",
      source: { kind: "asset", entityId: "*", field: "alt" },
      capabilities: ["edit-alt", "edit-text"],
      maxLength: 500,
    },
  ],
  render(context) {
    const settings = context.settings;
    if (!settings.enabled || settings.items.length === 0) return safeHtml("");
    const editor = aboutCanvasContext(context);
    return moduleRoot(
      "about-team",
      context.section,
      safeHtml(
        `<section class="about-team" data-motion-zone="items"><header><p class="solara-eyebrow">La marca</p><h2${canvasTextAttributes(editor, "title", 160)}>${escapeHtml(settings.title)}</h2></header><div class="about-team-grid">${settings.items
          .map((member) => {
            const image = member.imageAssetId
              ? renderImage(context.project, member.imageAssetId, {
                  className: "about-team-image",
                  loading: "eager",
                  sizes: "(max-width: 767px) 50vw, 25vw",
                  fallbackAlt: `${member.name} · ${member.role}`,
                })
              : "";
            const imageMarkup = image
              ? image.replace(
                  "<img",
                  `<img${canvasEntityAttributes(editor, "asset-alt", "asset", member.imageAssetId, "alt")}`,
                )
              : "";
            return `<article class="about-team-member">${imageMarkup ? `<div${canvasRepeaterItemAttributes(editor, "item-image", member.id)}>${imageMarkup}</div>` : ""}<h3${canvasRepeaterItemAttributes(editor, "item-name", member.id)}>${escapeHtml(member.name)}</h3><span class="about-team-member-role"${canvasRepeaterItemAttributes(editor, "item-role", member.id)}>${escapeHtml(member.role)}</span>${member.body ? `<p${canvasRepeaterItemAttributes(editor, "item-body", member.id)}>${escapeHtml(member.body)}</p>` : ""}</article>`;
          })
          .join("")}</div></section>`,
      ),
    );
  },
});

export const aboutStats: ModuleDefinition<
  "about-stats",
  z.infer<typeof aboutStatsSettings>
> = aboutModule({
  id: "about-stats",
  name: "Datos de Nosotros",
  description: "Franja de cuatro datos breves de la marca.",
  compatibleSettings: ["items"],
  settingsSchema: aboutStatsSettings,
  settingsFields: [
    {
      key: "items",
      type: "repeater",
      label: "Datos",
      maxItems: 4,
      itemLabelKey: "title",
      fields: [
        { key: "icon", type: "text", label: "Ícono" },
        { key: "title", type: "text", label: "Título" },
        { key: "body", type: "text", label: "Texto" },
      ],
    },
  ],
  motionZones: aboutItemsZone,
  canvasBindings: [
    {
      id: "item-icon",
      label: "Ícono del dato",
      kind: "repeater-item",
      source: { kind: "section-repeater-item", fieldKey: "items", itemFieldKey: "icon" },
      capabilities: ["edit-repeater-item", "edit-text"],
      maxLength: 40,
    },
    {
      id: "item-title",
      label: "Título del dato",
      kind: "repeater-item",
      source: { kind: "section-repeater-item", fieldKey: "items", itemFieldKey: "title" },
      capabilities: ["edit-repeater-item", "edit-text"],
      maxLength: 160,
    },
    {
      id: "item-body",
      label: "Texto del dato",
      kind: "repeater-item",
      source: { kind: "section-repeater-item", fieldKey: "items", itemFieldKey: "body" },
      capabilities: ["edit-repeater-item", "edit-text"],
      multiline: true,
      maxLength: 600,
    },
  ],
  render(context) {
    const editor = aboutCanvasContext(context);
    return moduleRoot(
      "about-stats",
      context.section,
      safeHtml(
        `<section class="about-stats" data-motion-zone="items"><div class="about-stats-grid">${context.settings.items.map((item) => `<article>${aboutIcon(item.icon, canvasRepeaterItemAttributes(editor, "item-icon", item.id))}<strong${canvasRepeaterItemAttributes(editor, "item-title", item.id)}>${escapeHtml(item.title)}</strong><p${canvasRepeaterItemAttributes(editor, "item-body", item.id)}>${escapeHtml(item.body)}</p></article>`).join("")}</div></section>`,
      ),
    );
  },
});

export const aboutProductsCta: ModuleDefinition<
  "about-products-cta",
  z.infer<typeof aboutProductsCtaSettings>
> = aboutModule({
  id: "about-products-cta",
  name: "CTA de Productos de Nosotros",
  description: "Cierre editorial que lleva al catálogo.",
  compatibleSettings: ["title", "body", "actionLabel", "actionHref"],
  settingsSchema: aboutProductsCtaSettings,
  settingsFields: [
    { key: "title", type: "text", label: "Título" },
    { key: "body", type: "text", label: "Texto" },
    { key: "actionLabel", type: "text", label: "Botón" },
    { key: "actionHref", type: "url", label: "Destino" },
  ],
  motionZones: aboutRevealZone,
  canvasBindings: [
    {
      id: "title",
      label: "Título del cierre",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "title" },
      capabilities: ["edit-text"],
      maxLength: 120,
    },
    {
      id: "body",
      label: "Texto del cierre",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "body" },
      capabilities: ["edit-text"],
      multiline: true,
      maxLength: 400,
    },
    {
      id: "actionLabel",
      label: "Botón de productos",
      kind: "text",
      source: { kind: "section-setting", fieldKey: "actionLabel" },
      capabilities: ["edit-text"],
      maxLength: 120,
    },
    {
      id: "actionHref",
      label: "Destino del botón de productos",
      kind: "link",
      source: { kind: "section-setting", fieldKey: "actionHref" },
      capabilities: ["edit-link"],
    },
  ],
  render(context) {
    const settings = context.settings;
    const editor = aboutCanvasContext(context);
    return moduleRoot(
      "about-products-cta",
      context.section,
      safeHtml(
        `<section class="about-products-cta" data-motion-zone="content"><h2${canvasTextAttributes(editor, "title", 120)}>${escapeHtml(settings.title)}</h2><p${canvasTextAttributes(editor, "body", 400)}>${escapeHtml(settings.body)}</p><a class="catalog-primary-action" href="${escapeAttribute(safeUrl(settings.actionHref))}"${canvasTextAttributes(editor, "actionHref")}><span${canvasTextAttributes(editor, "actionLabel", 120)}>${escapeHtml(settings.actionLabel)}</span> →</a></section>`,
      ),
    );
  },
});

export const aboutV2Modules = [
  aboutHero,
  aboutHistory,
  aboutPrinciples,
  aboutEditorialImage,
  aboutProcess,
  aboutManifesto,
  aboutExperience,
  aboutTeam,
  aboutStats,
  aboutProductsCta,
] as const;

export const aboutV2ModuleIds = new Set<string>(aboutV2Modules.map((module) => module.manifest.id));
