# Nosotros V2 Modular Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `/nosotros/` en una página editorial modular, editable desde Builder y compartida entre Preview y exportación sólo para `catalog-modern-v2`.

**Architecture:** Los defaults vivirán en `@solara/project-schema`, la página se normalizará mediante `ensureCatalogModernV2Sections`, y diez módulos `about-*` declararán schema, controles, markup y motion. `@solara/modules` registrará los módulos y los habilitará únicamente para `pages.about` de V2; `@solara/exporter` renderizará esas secciones en una ruta V2 específica y mantendrá intacto el renderer actual para V1/legacy.

**Tech Stack:** Node.js 22+, pnpm 10.15.1, TypeScript estricto, React 19, Zod, Vitest, Playwright Chromium, Biome y HTML/CSS/JavaScript estático sin dependencias públicas nuevas.

## Global Constraints

- `StoreProjectV2Schema` es la autoridad del modelo y `schemaVersion` permanece en `2`.
- `catalog-modern-v1` y `legacy-editorial-v1` conservan su renderer y contenido actuales.
- `pages.about.sections` es la fuente de verdad de Nosotros V2; Preview y exportación usan el mismo renderer.
- Los módulos públicos sólo devuelven `SafeHtml` y escapan texto, atributos, URLs y assets mediante `@solara/module-sdk`.
- Los repeaters tienen límites explícitos y cada setting editable aparece en `settingsFields`.
- No se agregan dependencias de runtime ni llamadas de red al storefront.
- Las imágenes usan assets del proyecto; un módulo opcional desactivado no genera markup ni espacio residual.
- Motion usa los atributos existentes, no listeners de scroll nuevos, y respeta `prefers-reduced-motion: reduce`.
- No se modifican los archivos ajenos ya presentes en el worktree: `apps/desktop/src/main.mjs`, `scripts/enganches.test.ts`, `scripts/recursos-check.test.ts`, `tests/e2e/lcp-cold.spec.ts` ni `diseño v2 codex/`.

---

## File Map

### Nuevos archivos

- `packages/project-schema/src/catalog-modern-about.ts`: defaults comerciales, ids de secciones y motion base de Nosotros V2.
- `packages/project-schema/src/index.ts`: export público de los defaults about.
- `packages/modules/src/about-v2.ts`: schemas Zod, metadata del inspector y renderer de los diez módulos `about-*`.
- `packages/modules/src/about-v2.test.ts`: contrato de registro, defaults, límites, escape, markup semántico y módulos opcionales.
- `tests/e2e/about-v2.spec.ts`: exportación servida en un servidor local, desktop/mobile, no-JS y contenido editable.

### Archivos modificados

- `packages/project-schema/src/catalog-modern-template.ts`: normalización composable de Contacto y Nosotros V2.
- `packages/project-schema/src/catalog-modern-v2-fixture.ts`: seed de las secciones about junto a Contacto V2.
- `packages/project-schema/src/catalog-modern-template.test.ts`: defaults idempotentes y aislamiento V1.
- `packages/modules/src/index.ts`: registro, tipos y gating por página/familia.
- `packages/modules/src/index.test.ts`: ids únicos y reconocimiento de módulos V2.
- `packages/modules/src/styles.ts`: layout editorial Nosotros, responsive, motion y reduced-motion.
- `apps/studio/src/lib/repository.ts`: reparación de proyectos V2 cargados desde IndexedDB/disco/recovery.
- `apps/studio/src/features/ThemeEditor.tsx`: seed de ambas páginas al activar V2.
- `apps/studio/src/features/builder/traza-contrato.test.ts`: incluye módulos about en el contrato del inspector.
- `apps/studio/src/features/builder/repeaterDefaults.test.ts`: verifica repeaters de módulos about.
- `tests/e2e/editor-builder.spec.ts`: selección, edición y disponibilidad de Nosotros V2 en Builder.
- `packages/exporter/src/index.ts`: normalización compartida y rama V2 de `/nosotros/`.
- `packages/exporter/src/index.test.ts`: contenido de secciones, HTML inicial, metadata y fallback.
- `tests/e2e/axe-site.spec.ts`: incluye `/nosotros/` en la auditoría del sitio.
- `CHANGELOG.md`: entrada de Nosotros V2 en español.

## Task 1: Defaults Y Normalización De Nosotros

**Files:**
- Create: `packages/project-schema/src/catalog-modern-about.ts`
- Modify: `packages/project-schema/src/index.ts`
- Modify: `packages/project-schema/src/catalog-modern-template.ts`
- Modify: `packages/project-schema/src/catalog-modern-v2-fixture.ts`
- Modify: `packages/project-schema/src/catalog-modern-template.test.ts`

**Interfaces:**
- Produces `defaultAboutV2Sections(): StoreSection[]`.
- Produces `ensureAboutV2Sections(project: StoreProjectV1): StoreProjectV1`.
- Produces `ensureCatalogModernV2Sections(project: StoreProjectV1): StoreProjectV1`.
- `ensureCatalogModernV2Sections` composes Contacto y Nosotros sin modificar proyectos que no sean `catalog-modern-v2`.

- [ ] **Step 1: Escribir las pruebas de normalización que inicialmente fallen**

Agregar a `packages/project-schema/src/catalog-modern-template.test.ts`:

```ts
import {
  buildCatalogModernProject,
  CATALOG_MODERN_TEMPLATE_VERSION,
  catalogModernCleanStore,
  ensureAboutV2Sections,
  ensureCatalogModernV2Sections,
  ensureContactV2Sections,
} from "./catalog-modern-template";

it("seedear Nosotros V2 con diez módulos y de forma idempotente", () => {
  const empty = structuredClone(catalogModernV2Store);
  empty.pages = empty.pages.map((page) =>
    page.kind === "about" ? { ...page, sections: [] } : page,
  );

  const normalized = ensureAboutV2Sections(empty);
  expect(normalized.pages.find((page) => page.kind === "about")?.sections.map((section) => section.moduleId)).toEqual([
    "about-hero",
    "about-history",
    "about-principles",
    "about-editorial-image",
    "about-process",
    "about-manifesto",
    "about-experience",
    "about-team",
    "about-stats",
    "about-products-cta",
  ]);
  expect(normalized.pages.find((page) => page.kind === "about")?.sections).toHaveLength(10);
  expect(ensureAboutV2Sections(normalized)).toEqual(normalized);
});

it("normaliza Contacto y Nosotros juntas sin tocar V1", () => {
  const empty = structuredClone(catalogModernV2Store);
  empty.pages = empty.pages.map((page) =>
    page.kind === "about" || page.kind === "contact" ? { ...page, sections: [] } : page,
  );
  const normalized = ensureCatalogModernV2Sections(empty);
  expect(normalized.pages.find((page) => page.kind === "about")?.sections).toHaveLength(10);
  expect(normalized.pages.find((page) => page.kind === "contact")?.sections).toHaveLength(8);

  const v1 = structuredClone(catalogModernCleanStore);
  expect(ensureAboutV2Sections(v1)).toEqual(v1);
  expect(ensureCatalogModernV2Sections(v1)).toEqual(v1);
  expect(ensureContactV2Sections(v1)).toEqual(v1);
});

it("mantiene el contenido explícito de una página about V2", () => {
  const project = structuredClone(catalogModernV2Store);
  const about = project.pages.find((page) => page.kind === "about");
  if (!about) throw new Error("Fixture sin página about");
  about.sections[0] = {
    ...about.sections[0],
    settings: { ...about.sections[0].settings, title: "Título escrito por la tienda" },
  };
  expect(ensureAboutV2Sections(project)).toEqual(project);
});
```

- [ ] **Step 2: Ejecutar el test de schema para confirmar el fallo**

Run: `corepack pnpm --filter @solara/project-schema test -- catalog-modern-template.test.ts`

Expected: FAIL porque no existen `ensureAboutV2Sections`, `ensureCatalogModernV2Sections` ni los ids `about-*`.

- [ ] **Step 3: Crear defaults deterministas y normalización composable**

Crear `packages/project-schema/src/catalog-modern-about.ts` con el mismo contrato de `catalog-modern-contact.ts`. Los defaults deben usar estos valores concretos:

```ts
import type { StoreSection } from "./index";

export const aboutDefaultHistoryParagraphs = [
  { id: "about-history-1", body: "Nació de una idea simple: elegir mejor, sin llenar de ruido el camino." },
  { id: "about-history-2", body: "Recorremos marcas, materiales y detalles para encontrar piezas que se usan, se disfrutan y permanecen." },
  { id: "about-history-3", body: "Compartimos una selección pequeña para que comprar se sienta claro, directo y personal." },
] as const;

export const aboutDefaultPrinciples = [
  { id: "about-principle-selection", number: "01", icon: "spark", title: "Selección", body: "Elegimos productos que realmente sumaríamos a nuestro día a día." },
  { id: "about-principle-quality", number: "02", icon: "shield", title: "Calidad", body: "Priorizamos materiales, terminaciones y durabilidad." },
  { id: "about-principle-simplicity", number: "03", icon: "minus", title: "Simplicidad", body: "Una experiencia de compra directa y sin complicaciones." },
  { id: "about-principle-attention", number: "04", icon: "chat", title: "Atención", body: "Hablás directamente con nosotros cuando lo necesitás." },
] as const;

export const aboutDefaultProcess = [
  { id: "about-process-discover", number: "01", title: "Descubrimos", body: "Buscamos marcas, materiales e ideas con algo para decir.", href: "" },
  { id: "about-process-evaluate", number: "02", title: "Evaluamos", body: "Probamos, comparamos y miramos cada detalle.", href: "" },
  { id: "about-process-select", number: "03", title: "Seleccionamos", body: "Nos quedamos con lo que cumple y merece un lugar.", href: "" },
  { id: "about-process-share", number: "04", title: "Compartimos", body: "Lo acercamos a vos con información clara.", href: "/buscar/" },
] as const;

export const aboutDefaultExperience = [
  { id: "about-experience-direct", icon: "bag", title: "Compra directa", body: "Elegís sin vueltas y coordinás con nosotros." },
  { id: "about-experience-attention", icon: "user", title: "Atención personalizada", body: "Respondemos cada consulta de forma cercana." },
  { id: "about-experience-shipping", icon: "truck", title: "Envíos", body: "Coordinamos entregas a todo el país." },
  { id: "about-experience-clear", icon: "eye", title: "Información clara", body: "Sabés qué estás eligiendo antes de comprar." },
] as const;

export const aboutDefaultStats = [
  { id: "about-stat-products", icon: "spark", title: "Productos seleccionados", body: "Una curaduría con intención." },
  { id: "about-stat-shipping", icon: "truck", title: "Envíos a todo el país", body: "Coordinamos cada entrega." },
  { id: "about-stat-direct", icon: "chat", title: "Compra directa", body: "Sin intermediarios innecesarios." },
  { id: "about-stat-attention", icon: "user", title: "Atención personalizada", body: "Estamos para ayudarte." },
] as const;

const defaultAboutMotion: StoreSection["motion"] = {
  preset: "fade-up",
  intensity: 4,
  direction: "up",
  distance: 18,
  duration: 0.45,
  delay: 0,
  stagger: 0.08,
  easing: "cubic-bezier(.16,1,.3,1)",
  entryPoint: 0.2,
  once: true,
};

const section = (id: string, moduleId: string, settings: Record<string, unknown>, enabled = true): StoreSection => ({
  id: id as StoreSection["id"],
  slot: "content",
  moduleId,
  enabled,
  settings,
  motion: { ...defaultAboutMotion },
});
```

Completar en el mismo archivo `defaultAboutV2Sections()` con este array exacto. `about-hero` usa `imageAssetId: "asset-hero"`; `about-editorial-image` usa `imageAssetId: "asset-manta"`; `about-team` inicia con la sección y el setting desactivados e `items: []`.

```ts
export function defaultAboutV2Sections(): StoreSection[] {
  return [
    section("about-section-hero", "about-hero", {
      eyebrow: "NUESTRA MIRADA",
      title: "Una selección pensada para moverte.",
      body: "Elegimos piezas con intención para acompañar tu forma de vivir.",
      imageAssetId: "asset-hero",
    }),
    section("about-section-history", "about-history", {
      title: "Cómo empezó todo",
      paragraphs: structuredClone(aboutDefaultHistoryParagraphs),
      year: "DESDE 2026",
      city: "BUENOS AIRES",
      country: "ARGENTINA",
    }),
    section("about-section-principles", "about-principles", {
      title: "Lo que nos guía",
      items: structuredClone(aboutDefaultPrinciples),
    }),
    section("about-section-editorial-image", "about-editorial-image", {
      enabled: true,
      eyebrow: "NUESTRA FORMA DE ELEGIR",
      title: "Menos ruido. Mejores elecciones.",
      body: "Buscamos piezas que tengan sentido, se usen de verdad y puedan quedarse con vos.",
      imageAssetId: "asset-manta",
    }),
    section("about-section-process", "about-process", {
      title: "Cómo seleccionamos",
      items: structuredClone(aboutDefaultProcess),
    }),
    section("about-section-manifesto", "about-manifesto", {
      quote: "No buscamos tener de todo. Buscamos tener lo que vale la pena.",
      accentLabel: "Nuestra manera de hacer las cosas",
    }),
    section("about-section-experience", "about-experience", {
      title: "La experiencia",
      items: structuredClone(aboutDefaultExperience),
    }),
    section(
      "about-section-team",
      "about-team",
      { enabled: false, title: "Detrás de la tienda", items: [] },
      false,
    ),
    section("about-section-stats", "about-stats", {
      items: structuredClone(aboutDefaultStats),
    }),
    section("about-section-products-cta", "about-products-cta", {
      title: "Conocé nuestra selección.",
      body: "Encontrá piezas elegidas para acompañarte todos los días.",
      actionLabel: "Explorar productos",
      actionHref: "/buscar/",
    }),
  ];
}
```

Modificar `packages/project-schema/src/index.ts` para exportar desde `catalog-modern-about.ts` `aboutDefaultHistoryParagraphs`, `aboutDefaultPrinciples`, `aboutDefaultProcess`, `aboutDefaultExperience`, `aboutDefaultStats` y `defaultAboutV2Sections`, igual que hoy exporta `defaultContactV2Sections`.

- [ ] **Step 4: Agregar los helpers al template y seedear la fixture V2**

Modificar `catalog-modern-template.ts` para importar `defaultAboutV2Sections` y agregar:

```ts
export function ensureAboutV2Sections(project: StoreProjectV1): StoreProjectV1 {
  if (project.commerceTemplates.designFamily !== "catalog-modern-v2") return project;
  const page = project.pages.find((candidate) => candidate.kind === "about");
  if (!page || page.sections.length > 0) return project;
  return {
    ...project,
    pages: project.pages.map((candidate) =>
      candidate.kind === "about"
        ? { ...candidate, sections: defaultAboutV2Sections() }
        : candidate,
    ),
  };
}

export function ensureCatalogModernV2Sections(project: StoreProjectV1): StoreProjectV1 {
  return ensureAboutV2Sections(ensureContactV2Sections(project));
}
```

Modificar `catalog-modern-v2-fixture.ts` para importar `ensureCatalogModernV2Sections` y pasar la fixture por ese helper. Mantener `ensureContactV2Sections` disponible para los tests y consumidores que sólo necesiten reparar Contacto.

- [ ] **Step 5: Ejecutar los tests de schema**

Run: `corepack pnpm --filter @solara/project-schema test -- catalog-modern-template.test.ts`

Expected: PASS, incluyendo diez secciones about, ocho contact, idempotencia y aislamiento V1.

- [ ] **Step 6: Commitear el contrato de datos**

```bash
git add packages/project-schema/src/catalog-modern-about.ts packages/project-schema/src/index.ts packages/project-schema/src/catalog-modern-template.ts packages/project-schema/src/catalog-modern-v2-fixture.ts packages/project-schema/src/catalog-modern-template.test.ts
git commit -m "feat: agregar defaults de Nosotros V2"
```

## Task 2: Módulos About V2 Y Registro Por Página

**Files:**
- Create: `packages/modules/src/about-v2.ts`
- Create: `packages/modules/src/about-v2.test.ts`
- Modify: `packages/modules/src/index.ts`
- Modify: `packages/modules/src/index.test.ts`
- Modify: `apps/studio/src/features/builder/traza-contrato.test.ts`
- Modify: `apps/studio/src/features/builder/repeaterDefaults.test.ts`

**Interfaces:**
- Produces `aboutV2Modules`, `aboutV2ModuleIds` and ten exported settings schemas.
- Every about module has `manifest.family === "catalog-modern-v2"`, `availability === "default"`, `slots === ["content"]` and `styleAsset === scopedAssetId("catalog-modern")`.
- `isModuleAvailableOnPage` allows only `aboutV2ModuleIds` plus `catalog-newsletter-cta` on `about` V2; it allows only `contactV2ModuleIds` plus newsletter on `contact` V2; it excludes both sets from all other pages.

- [ ] **Step 1: Escribir el contrato de módulos antes de implementarlos**

Crear `packages/modules/src/about-v2.test.ts` con estas pruebas:

```ts
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { describe, expect, it } from "vitest";
import {
  aboutEditorialImageSettings,
  aboutHero,
  aboutHeroSettings,
  aboutTeamSettings,
  aboutV2ModuleIds,
  aboutV2Modules,
} from "./about-v2";
import { getModuleDefinition, isCatalogModernModule, isModuleAvailableOnPage } from "./index";

describe("Nosotros V2 module contracts", () => {
  it("registra los diez módulos con ids estables", () => {
    expect(aboutV2Modules).toHaveLength(10);
    expect(aboutV2ModuleIds).toEqual(new Set([
      "about-hero",
      "about-history",
      "about-principles",
      "about-editorial-image",
      "about-process",
      "about-manifesto",
      "about-experience",
      "about-team",
      "about-stats",
      "about-products-cta",
    ]));
  });

  it("limita los módulos a Nosotros V2 y conserva el newsletter compartido", () => {
    const hero = getModuleDefinition("about-hero");
    const newsletter = getModuleDefinition("catalog-newsletter-cta");
    if (!hero || !newsletter) throw new Error("Faltan módulos registrados");
    expect(isCatalogModernModule(hero)).toBe(true);
    expect(isModuleAvailableOnPage(hero, "about", "catalog-modern-v2")).toBe(true);
    expect(isModuleAvailableOnPage(hero, "contact", "catalog-modern-v2")).toBe(false);
    expect(isModuleAvailableOnPage(hero, "about", "catalog-modern-v1")).toBe(false);
    expect(isModuleAvailableOnPage(newsletter, "about", "catalog-modern-v2")).toBe(true);
  });

  it("aplica defaults y límites de repeaters", () => {
    expect(aboutHeroSettings.parse({}).title).toBe("Una selección pensada para moverte.");
    expect(aboutHeroSettings.parse({}).imageAssetId).toBe("asset-hero");
    expect(aboutEditorialImageSettings.parse({}).enabled).toBe(true);
    expect(aboutTeamSettings.parse({}).enabled).toBe(false);
    expect(aboutTeamSettings.parse({}).items).toEqual([]);
    expect(aboutTeamSettings.safeParse({ items: Array.from({ length: 5 }, () => ({})) }).success).toBe(false);
  });

  it("renderiza un hero seguro y semántico", () => {
    const section = catalogModernV2Store.pages.find((page) => page.kind === "about")?.sections[0];
    if (!section) throw new Error("Fixture sin hero de Nosotros");
    const html = String(aboutHero.render?.({
      project: catalogModernV2Store,
      section,
      settings: aboutHeroSettings.parse({ title: "<Título>" }),
      pageType: "about",
    }));
    expect(html).toContain('data-solara-module="about-hero"');
    expect(html).toContain("&lt;Título&gt;");
    expect(html).toContain("<h1>");
    expect(html).toContain('data-motion-zone="content"');
    expect(html).toContain("modo-sur-hero.png");
  });

  it("no deja markup cuando los módulos opcionales están desactivados", () => {
    const section = catalogModernV2Store.pages.find((page) => page.kind === "about")?.sections[0];
    if (!section) throw new Error("Fixture sin sección");
    const editorial = getModuleDefinition("about-editorial-image");
    const team = getModuleDefinition("about-team");
    if (!editorial || !team) throw new Error("Faltan módulos opcionales");
    expect(String(editorial.render({ project: catalogModernV2Store, section, settings: aboutEditorialImageSettings.parse({ enabled: false }), pageType: "about" }))).toBe("");
    expect(String(team.render({ project: catalogModernV2Store, section, settings: aboutTeamSettings.parse({ enabled: false }), pageType: "about" }))).toBe("");
  });
});
```

- [ ] **Step 2: Ejecutar las pruebas para confirmar que faltan los módulos**

Run: `corepack pnpm --filter @solara/modules test -- about-v2.test.ts`

Expected: FAIL porque no existe `about-v2.ts`, los ids no están registrados y la fixture todavía no puede resolver los módulos.

- [ ] **Step 3: Crear helpers, schemas y metadata del inspector**

Crear `packages/modules/src/about-v2.ts` con este contrato base:

```ts
const aboutRevealZone = [
  {
    id: "content",
    label: "Contenido",
    selector: '[data-motion-zone="content"]',
    allowedPresets: ["none", "fade", "fade-up", "slide", "scale"] as const,
  },
] as const;

const aboutItemsZone = [
  {
    id: "items",
    label: "Elementos",
    selector: '[data-motion-zone="items"]',
    allowedPresets: ["none", "fade", "fade-up", "stagger"] as const,
  },
] as const;

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

const aboutModule = <Id extends string, Settings>(input: {
  id: Id;
  name: string;
  description: string;
  compatibleSettings: readonly string[];
  settingsSchema: z.ZodType<Settings>;
  settingsFields: readonly SettingsFieldDefinition<Settings>[];
  motionZones: typeof aboutRevealZone | typeof aboutItemsZone;
  render(context: RenderContext<Settings>): SafeHtml;
}): ModuleDefinition<Id, Settings> => ({
  manifest: aboutManifest(input),
  settingsSchema: input.settingsSchema,
  settingsFields: input.settingsFields,
  motionZones: input.motionZones,
  styleAsset: scopedAssetId("catalog-modern"),
  render: input.render,
});
```

Importar desde `@solara/module-sdk` `escapeAttribute`, `escapeHtml`, `moduleRoot`, `renderImage`, `safeHtml`, `safeUrl`, `type ModuleDefinition`, `type RenderContext`, `type SafeHtml`, `type SettingsFieldDefinition`; importar los defaults desde `@solara/project-schema` y usar `z` desde `zod`.

Definir exactamente estos schemas y controles:

```ts
export const aboutHeroSettings = z.object({
  eyebrow: z.string().default("NUESTRA MIRADA"),
  title: z.string().default("Una selección pensada para moverte."),
  body: z.string().default("Elegimos piezas con intención para acompañar tu forma de vivir."),
  imageAssetId: z.string().default("asset-hero"),
});

export const aboutHistorySettings = z.object({
  title: z.string().default("Cómo empezó todo"),
  paragraphs: z.array(z.object({ id: z.string().min(1), body: z.string().min(1) })).max(3).default([...aboutDefaultHistoryParagraphs]),
  year: z.string().default("DESDE 2026"),
  city: z.string().default("BUENOS AIRES"),
  country: z.string().default("ARGENTINA"),
});

export const aboutPrinciplesSettings = z.object({
  title: z.string().default("Lo que nos guía"),
  items: z.array(z.object({ id: z.string().min(1), number: z.string().min(1), icon: z.string().default("spark"), title: z.string().min(1), body: z.string().min(1) })).max(4).default([...aboutDefaultPrinciples]),
});

export const aboutEditorialImageSettings = z.object({
  enabled: z.boolean().default(true),
  eyebrow: z.string().default("NUESTRA FORMA DE ELEGIR"),
  title: z.string().default("Menos ruido. Mejores elecciones."),
  body: z.string().default("Buscamos piezas que tengan sentido, se usen de verdad y puedan quedarse con vos."),
  imageAssetId: z.string().default("asset-manta"),
});

export const aboutProcessSettings = z.object({
  title: z.string().default("Cómo seleccionamos"),
  items: z.array(z.object({ id: z.string().min(1), number: z.string().min(1), title: z.string().min(1), body: z.string().min(1), href: z.string().default("") })).max(4).default([...aboutDefaultProcess]),
});

export const aboutManifestoSettings = z.object({
  quote: z.string().default("No buscamos tener de todo. Buscamos tener lo que vale la pena."),
  accentLabel: z.string().default("Nuestra manera de hacer las cosas"),
});

export const aboutExperienceSettings = z.object({
  title: z.string().default("La experiencia"),
  items: z.array(z.object({ id: z.string().min(1), icon: z.string().default("spark"), title: z.string().min(1), body: z.string().min(1) })).max(4).default([...aboutDefaultExperience]),
});

export const aboutTeamSettings = z.object({
  enabled: z.boolean().default(false),
  title: z.string().default("Detrás de la tienda"),
  items: z.array(z.object({ id: z.string().min(1), imageAssetId: z.string().default(""), name: z.string().min(1), role: z.string().min(1), body: z.string().default("") })).max(4).default([]),
});

export const aboutStatsSettings = z.object({
  items: z.array(z.object({ id: z.string().min(1), icon: z.string().default("spark"), title: z.string().min(1), body: z.string().min(1) })).max(4).default([...aboutDefaultStats]),
});

export const aboutProductsCtaSettings = z.object({
  title: z.string().default("Conocé nuestra selección."),
  body: z.string().default("Encontrá piezas elegidas para acompañarte todos los días."),
  actionLabel: z.string().default("Explorar productos"),
  actionHref: z.string().default("/buscar/"),
});
```

Use `settingsFields` with these exact field types: hero text/text/text/asset; history text/repeater(text `body`)/text/text/text; principles text/repeater(text `number`, `icon`, `title`, `body`); editorial boolean/text/text/text/asset; process text/repeater(text `number`, `title`, `body`, url `href`); manifesto text/text; experience text/repeater(text `icon`, `title`, `body`); team boolean/text/repeater(asset `imageAssetId`, text `name`, `role`, `body`); stats repeater(text `icon`, `title`, `body`); CTA text/text/text/url. Set repeater maxima to 3, 4, 4, 4, 4, 4 and 4 according to the schemas above.

- [ ] **Step 4: Implementar los diez renderers con markup estable y seguro**

Cada renderer debe envolver su contenido con `moduleRoot` y usar únicamente las clases indicadas:

```ts
export const aboutHero = aboutModule({
  id: "about-hero",
  name: "Hero de Nosotros",
  description: "Introducción editorial de la marca con imagen vertical opcional.",
  compatibleSettings: ["eyebrow", "title", "body", "imageAssetId"],
  settingsSchema: aboutHeroSettings,
  settingsFields: [
    { key: "eyebrow", type: "text", label: "Antetítulo" },
    { key: "title", type: "text", label: "Título" },
    { key: "body", type: "text", label: "Descripción" },
    { key: "imageAssetId", type: "asset", label: "Imagen vertical" },
  ],
  motionZones: aboutRevealZone,
  render(context) {
    const settings = context.settings;
    const image = settings.imageAssetId
      ? renderImage(context.project, settings.imageAssetId, {
          className: "about-hero-image",
          loading: "eager",
          fetchPriority: "high",
          sizes: "(max-width: 767px) 100vw, 42vw",
          fallbackAlt: settings.title,
        })
      : "";
    return moduleRoot(
      "about-hero",
      context.section,
      safeHtml(`<div class="about-hero" data-motion-zone="content"><div class="about-hero-copy"><p class="solara-eyebrow">${escapeHtml(settings.eyebrow)}</p><h1>${escapeHtml(settings.title)}</h1><p>${escapeHtml(settings.body)}</p></div>${image ? `<div class="about-hero-media">${image}</div>` : ""}</div>`),
    );
  },
});
```

Implementar además estas salidas exactas:

- `about-history`: `.about-history` con `header h2`, `.about-history-copy` con un `<p>` por `paragraphs`, y `.about-history-meta` con `year`, `city`, `country` escapados.
- `about-principles`: `.about-principles` con `header h2` y `.about-principles-grid`; cada item es `.about-principle-item` con número, icono textual, `h3` y cuerpo.
- `about-editorial-image`: devolver `safeHtml("")` si `enabled` es falso o `imageAssetId` está vacío; si está activo, renderizar `.about-editorial-image` con una imagen horizontal `loading="lazy"`, eyebrow, `h2` y cuerpo.
- `about-process`: `.about-process` con `.about-process-grid`; cada `.about-process-item` muestra número, `h3`, cuerpo y un enlace sólo cuando `href` no está vacío, pasando el destino por `safeUrl`.
- `about-manifesto`: `.about-manifesto` con `<blockquote>` para `quote` y `<p class="about-manifesto-accent">` para `accentLabel` cuando exista.
- `about-experience`: `.about-experience` con `.about-experience-grid`; cada item usa `article`, icono, `h3` y cuerpo.
- `about-team`: devolver `safeHtml("")` si `enabled` es falso o `items` está vacío; si está activo, renderizar `.about-team` y una card `.about-team-member` por persona, usando `renderImage` sólo cuando `imageAssetId` exista y `fallbackAlt: member.name + " · " + member.role`.
- `about-stats`: `.about-stats` con `.about-stats-grid`; cada item usa `article`, icono, `strong` y descripción.
- `about-products-cta`: `.about-products-cta` con `h2`, párrafo y enlace `.catalog-primary-action` cuyo href pase por `safeUrl`.

Todos los valores provenientes de settings pasan por `escapeHtml` o `escapeAttribute`; no usar `innerHTML`, URLs sin `safeUrl`, ni copy concatenado sin escape.

- [ ] **Step 5: Registrar módulos y corregir el gating de página**

Modificar `packages/modules/src/index.ts` así:

```ts
import { aboutV2ModuleIds, aboutV2Modules } from "./about-v2";

export type AnyCatalogModernModule =
  | (typeof catalogModernModules)[number]
  | (typeof contactV2Modules)[number]
  | (typeof aboutV2Modules)[number];

export const moduleRegistry: Record<string, RegisteredModule> = Object.fromEntries(
  [...officialModules, ...catalogModernModules, ...contactV2Modules, ...aboutV2Modules].map((definition) => [
    definition.manifest.id,
    definition,
  ]),
);

export function isCatalogModernModule(definition: RegisteredModule): boolean {
  return definition.manifest.family === "catalog-modern-v1" || definition.manifest.family === "catalog-modern-v2";
}

export function isModuleAvailableOnPage(
  definition: RegisteredModule,
  pageKind: RenderPageType,
  designFamily?: string,
): boolean {
  if (!isAddableModule(definition)) return false;
  const moduleId = definition.manifest.id;
  if (pageKind === "about" && designFamily === "catalog-modern-v2") {
    return aboutV2ModuleIds.has(moduleId) || moduleId === "catalog-newsletter-cta";
  }
  if (pageKind === "contact" && designFamily === "catalog-modern-v2") {
    return contactV2ModuleIds.has(moduleId) || moduleId === "catalog-newsletter-cta";
  }
  return !aboutV2ModuleIds.has(moduleId) && !contactV2ModuleIds.has(moduleId);
}
```

Export `aboutV2Modules` and `aboutV2ModuleIds`. Update the module id uniqueness test to check `officialModules`, `catalogModernModules`, `contactV2Modules` and `aboutV2Modules` together. Update the two Builder contract tests so their `modules` arrays include `aboutV2Modules`; this ensures every new schema field and repeater payload is checked by existing generic tests.

- [ ] **Step 6: Ejecutar el contrato de módulos**

Run: `corepack pnpm --filter @solara/modules test -- about-v2.test.ts index.test.ts`

Expected: PASS, incluido gating about/contact, escaping del hero, módulos opcionales vacíos y ids únicos.

- [ ] **Step 7: Commitear los módulos y el registro**

```bash
git add packages/modules/src/about-v2.ts packages/modules/src/about-v2.test.ts packages/modules/src/index.ts packages/modules/src/index.test.ts apps/studio/src/features/builder/traza-contrato.test.ts apps/studio/src/features/builder/repeaterDefaults.test.ts
git commit -m "feat: registrar módulos Nosotros V2"
```

## Task 3: Estilos Editoriales, Responsive Y Reduced Motion

**Files:**
- Modify: `packages/modules/src/styles.ts`

**Interfaces:**
- Consumes the class names emitted by `about-v2.ts`.
- Produces a scoped `.cm.v2` stylesheet with desktop, mobile and reduced-motion behavior.

- [ ] **Step 1: Agregar el bloque CSS V2 con tokens existentes**

Insertar después del bloque Contacto V2 en `styles.ts`. Mantener todos los selectores bajo `.cm.v2` y usar los tokens existentes `--catalog-border`, `--catalog-ink`, `--catalog-paper`, `--catalog-muted` y `--catalog-sale`.

```css
.cm.v2 .solara-about-page {
  width: min(calc(100% - 3rem), var(--catalog-v2-wide));
  margin-inline: auto;
}
.cm.v2 .solara-about-sections {
  display: grid;
}
.cm.v2 .solara-about-sections > [data-solara-module] {
  min-width: 0;
  border-top: 1px solid var(--catalog-border);
}
.cm.v2 .about-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, .75fr);
  gap: clamp(3rem, 9vw, 10rem);
  align-items: stretch;
  padding-block: clamp(3rem, 8vw, 7rem);
}
.cm.v2 .about-hero-copy {
  align-self: center;
  max-width: 48rem;
}
.cm.v2 .about-hero-copy h1 {
  max-width: 9ch;
  margin: .65rem 0 1.1rem;
  font-family: var(--solara-font-display, Georgia, "Times New Roman", serif);
  font-size: clamp(4rem, 8vw, 8.5rem);
  font-weight: 500;
  letter-spacing: -.07em;
  line-height: .86;
  text-wrap: balance;
}
.cm.v2 .about-hero-copy > p:last-child,
.cm.v2 .about-history-copy > p,
.cm.v2 .about-editorial-image-copy > p {
  max-width: 42ch;
  color: var(--catalog-muted);
}
.cm.v2 .about-hero-media img {
  width: 100%;
  aspect-ratio: 9 / 16;
  object-fit: cover;
}
.cm.v2 .about-history {
  display: grid;
  grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr);
  gap: clamp(2rem, 8vw, 9rem);
  padding-block: clamp(3rem, 8vw, 7rem);
}
.cm.v2 .about-history h2,
.cm.v2 .about-principles h2,
.cm.v2 .about-editorial-image h2,
.cm.v2 .about-process h2,
.cm.v2 .about-experience h2,
.cm.v2 .about-team h2 {
  margin: 0 0 1rem;
  font-family: var(--solara-font-display, Georgia, "Times New Roman", serif);
  font-size: clamp(2rem, 4vw, 4.5rem);
  font-weight: 500;
  letter-spacing: -.06em;
  line-height: .95;
}
.cm.v2 .about-history-copy,
.cm.v2 .about-editorial-image-copy {
  display: grid;
  gap: 1rem;
}
.cm.v2 .about-history-meta {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem 1.2rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--catalog-border);
  color: var(--catalog-muted);
  font-size: .75rem;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.cm.v2 .about-principles,
.cm.v2 .about-process,
.cm.v2 .about-experience,
.cm.v2 .about-team,
.cm.v2 .about-stats {
  padding-block: clamp(3rem, 7vw, 6rem);
}
.cm.v2 .about-principles-grid,
.cm.v2 .about-experience-grid,
.cm.v2 .about-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  border: 1px solid var(--catalog-border);
}
.cm.v2 .about-principle-item,
.cm.v2 .about-experience-grid article,
.cm.v2 .about-stats-grid article {
  display: grid;
  align-content: start;
  gap: .7rem;
  min-width: 0;
  min-height: 12rem;
  padding: 1.25rem;
  border-right: 1px solid var(--catalog-border);
}
.cm.v2 .about-principle-item:last-child,
.cm.v2 .about-experience-grid article:last-child,
.cm.v2 .about-stats-grid article:last-child { border-right: 0; }
.cm.v2 .about-principle-number,
.cm.v2 .about-process-number { color: var(--catalog-sale); font-size: .78rem; letter-spacing: .08em; }
.cm.v2 .about-principle-item h3,
.cm.v2 .about-experience-grid h3,
.cm.v2 .about-team-member h3 { margin: 0; font-size: 1rem; }
.cm.v2 .about-principle-item p,
.cm.v2 .about-experience-grid p,
.cm.v2 .about-stats-grid p,
.cm.v2 .about-team-member p { margin: 0; color: var(--catalog-muted); font-size: .82rem; line-height: 1.5; }
.cm.v2 .about-editorial-image { padding-block: clamp(3rem, 7vw, 6rem); }
.cm.v2 .about-editorial-image-media img { width: 100%; aspect-ratio: 16 / 8; object-fit: cover; }
.cm.v2 .about-editorial-image-copy { grid-template-columns: minmax(0, .8fr) minmax(0, 1fr); gap: 2rem 8vw; padding-top: 1.5rem; }
.cm.v2 .about-process-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; margin-top: 1.5rem; border-block: 1px solid var(--catalog-border); }
.cm.v2 .about-process-item { position: relative; display: grid; gap: .7rem; min-height: 11rem; padding: 1.4rem 1.2rem; border-right: 1px solid var(--catalog-border); }
.cm.v2 .about-process-item:last-child { border-right: 0; }
.cm.v2 .about-process-item a { align-self: end; color: var(--catalog-sale); font-size: .78rem; text-decoration: none; }
.cm.v2 .about-manifesto,
.cm.v2 .about-products-cta { padding: clamp(3rem, 8vw, 8rem) clamp(1.5rem, 7vw, 8rem); background: var(--catalog-ink); color: var(--catalog-paper); }
.cm.v2 .about-manifesto blockquote { max-width: 18ch; margin: 0; font-family: var(--solara-font-display, Georgia, "Times New Roman", serif); font-size: clamp(2.6rem, 6vw, 7rem); letter-spacing: -.07em; line-height: .92; }
.cm.v2 .about-manifesto-accent { margin: 2rem 0 0; color: var(--catalog-sale); font-size: .75rem; letter-spacing: .1em; text-transform: uppercase; }
.cm.v2 .about-team-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1.2rem; }
.cm.v2 .about-team-member img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; margin-bottom: 1rem; }
.cm.v2 .about-team-member h3 { font-family: var(--solara-font-display, Georgia, serif); font-size: 1.35rem; font-weight: 500; }
.cm.v2 .about-team-member-role { display: block; margin: .25rem 0 .7rem; color: var(--catalog-sale); font-size: .72rem; letter-spacing: .08em; text-transform: uppercase; }
.cm.v2 .about-stats-grid { border-inline: 0; }
.cm.v2 .about-stats-grid article { min-height: 9rem; padding-inline: 0; border-right: 0; }
.cm.v2 .about-products-cta h2 { max-width: 10ch; margin: 0 0 1rem; font-family: var(--solara-font-display, Georgia, serif); font-size: clamp(2.8rem, 6vw, 7rem); font-weight: 500; letter-spacing: -.07em; line-height: .9; }
.cm.v2 .about-products-cta p { max-width: 42ch; color: color-mix(in srgb, var(--catalog-paper) 72%, transparent); }
.cm.v2 .about-products-cta .catalog-primary-action { margin-top: 1.5rem; background: var(--catalog-paper); color: var(--catalog-ink); }
```

- [ ] **Step 2: Agregar responsive y motion**

Agregar al mismo bloque:

```css
.cm.v2 [data-solara-module^="about-"][data-motion-visible="true"] [data-motion-zone] {
  --hero-v2-rise: 16px;
  animation: solara-hero-rise 460ms var(--catalog-v2-ease-out) 60ms backwards;
}
.cm.v2 [data-solara-module="about-principles"][data-motion-visible="true"] .about-principle-item,
.cm.v2 [data-solara-module="about-process"][data-motion-visible="true"] .about-process-item,
.cm.v2 [data-solara-module="about-experience"][data-motion-visible="true"] article,
.cm.v2 [data-solara-module="about-stats"][data-motion-visible="true"] article {
  --hero-v2-rise: 12px;
  animation: solara-hero-rise 420ms var(--catalog-v2-ease-out) 140ms backwards;
}
.cm.v2 [data-solara-module="about-principles"][data-motion-visible="true"] .about-principle-item:nth-child(2),
.cm.v2 [data-solara-module="about-process"][data-motion-visible="true"] .about-process-item:nth-child(2),
.cm.v2 [data-solara-module="about-experience"][data-motion-visible="true"] article:nth-child(2),
.cm.v2 [data-solara-module="about-stats"][data-motion-visible="true"] article:nth-child(2) { animation-delay: calc(140ms + var(--motion-stagger, 70ms)); }
.cm.v2 [data-solara-module="about-principles"][data-motion-visible="true"] .about-principle-item:nth-child(3),
.cm.v2 [data-solara-module="about-process"][data-motion-visible="true"] .about-process-item:nth-child(3),
.cm.v2 [data-solara-module="about-experience"][data-motion-visible="true"] article:nth-child(3),
.cm.v2 [data-solara-module="about-stats"][data-motion-visible="true"] article:nth-child(3) { animation-delay: calc(140ms + var(--motion-stagger, 70ms) * 2); }
.cm.v2 [data-solara-module="about-principles"][data-motion-visible="true"] .about-principle-item:nth-child(4),
.cm.v2 [data-solara-module="about-process"][data-motion-visible="true"] .about-process-item:nth-child(4),
.cm.v2 [data-solara-module="about-experience"][data-motion-visible="true"] article:nth-child(4),
.cm.v2 [data-solara-module="about-stats"][data-motion-visible="true"] article:nth-child(4) { animation-delay: calc(140ms + var(--motion-stagger, 70ms) * 3); }
@media (max-width: 767px) {
  .cm.v2 .solara-about-page { width: min(calc(100% - 1.5rem), var(--catalog-v2-wide)); }
  .cm.v2 .about-hero,
  .cm.v2 .about-history,
  .cm.v2 .about-editorial-image-copy { grid-template-columns: minmax(0, 1fr); }
  .cm.v2 .about-hero { gap: 2rem; padding-block: 2.5rem 3rem; }
  .cm.v2 .about-hero-copy h1 { font-size: clamp(3.4rem, 15vw, 5.2rem); }
  .cm.v2 .about-principles-grid,
  .cm.v2 .about-experience-grid,
  .cm.v2 .about-stats-grid,
  .cm.v2 .about-team-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cm.v2 .about-process-grid { grid-template-columns: minmax(0, 1fr); }
  .cm.v2 .about-principle-item:nth-child(2n),
  .cm.v2 .about-experience-grid article:nth-child(2n) { border-right: 0; }
  .cm.v2 .about-principle-item:nth-child(n+3),
  .cm.v2 .about-experience-grid article:nth-child(n+3) { border-top: 1px solid var(--catalog-border); }
  .cm.v2 .about-process-item { min-height: 0; border-right: 0; border-bottom: 1px solid var(--catalog-border); }
  .cm.v2 .about-process-item:last-child { border-bottom: 0; }
  .cm.v2 .about-manifesto,
  .cm.v2 .about-products-cta { padding: 3.5rem 1.25rem; }
  .cm.v2 .about-manifesto blockquote { font-size: clamp(2.4rem, 11vw, 4.5rem); }
}
@media (prefers-reduced-motion: reduce) {
  .cm.v2 [data-solara-module^="about-"] [data-motion-zone],
  .cm.v2 [data-solara-module^="about-"] article,
  .cm.v2 [data-solara-module^="about-"] .about-process-item,
  .cm.v2 [data-solara-module^="about-"] .about-principle-item {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
}
```

- [ ] **Step 3: Ejecutar formato y tests de módulos**

Run: `corepack pnpm exec biome check packages/modules/src/styles.ts packages/modules/src/about-v2.ts`

Expected: PASS.

Run: `corepack pnpm --filter @solara/modules test`

Expected: PASS sin regresiones de estilos ni registro.

- [ ] **Step 4: Commitear los estilos**

```bash
git add packages/modules/src/styles.ts
git commit -m "feat: diseñar Nosotros V2 editorial responsive"
```

## Task 4: Integración De Defaults En Studio Y Builder

**Files:**
- Modify: `apps/studio/src/lib/repository.ts`
- Modify: `apps/studio/src/features/ThemeEditor.tsx`
- Modify: `tests/e2e/editor-builder.spec.ts`

**Interfaces:**
- Todas las reparaciones de proyectos V2 usan `ensureCatalogModernV2Sections`.
- El Builder no añade defaults paralelos: obtiene módulos, fields y repeaters desde `@solara/modules`.
- `isModuleAvailableOnPage` ya limita el picker; no duplicar ids `about-*` en `Builder.tsx`.

- [ ] **Step 1: Escribir la prueba E2E de selección y edición de Nosotros**

Agregar en `tests/e2e/editor-builder.spec.ts`:

```ts
test("el Builder cambia a Nosotros V2 y muestra sus módulos editables", async ({ page }) => {
  await openBuilder(page);
  await page.getByRole("tab", { name: "Tema" }).click();
  await page.getByTestId("ui-design-family-v2").click();
  await page.getByRole("tab", { name: "Constructor" }).click();

  const pageSelector = page.getByLabel("Página de edición");
  await pageSelector.selectOption("about");
  await expect(page.locator('[data-section-select="about-section-hero"]')).toBeVisible();
  await expect(page.getByText("Hero de Nosotros", { exact: true }).first()).toBeVisible();

  await page.locator('[data-section-select="about-section-history"]').click();
  await expect(page.getByText("Historia de Nosotros", { exact: true }).first()).toBeVisible();

  await page.locator('[data-section-select="about-section-team"]').click();
  await expect(page.getByRole("checkbox", { name: "Mostrar equipo" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Mostrar equipo" })).not.toBeChecked();
});
```

Usar los nombres de módulo definidos en `about-v2.ts`: `Hero de Nosotros`, `Historia de Nosotros` y `Detrás de la tienda`.

- [ ] **Step 2: Ejecutar la prueba para observar el estado actual**

Run: `corepack pnpm exec playwright test tests/e2e/editor-builder.spec.ts -g "Nosotros V2"`

Expected: FAIL porque la fixture todavía no tiene secciones about y el registry no ofrece módulos about.

- [ ] **Step 3: Reemplazar el helper de normalización en Studio**

En `apps/studio/src/lib/repository.ts`, cambiar el import y cada llamada a `ensureContactV2Sections` por `ensureCatalogModernV2Sections`. Mantener `ensureContactV2Sections` sólo en el test específico de schema. En `apps/studio/src/features/ThemeEditor.tsx`, el callback queda:

```ts
const updateDesignFamily = (designFamily: "catalog-modern-v1" | "catalog-modern-v2") => {
  const nextProject = {
    ...project,
    commerceTemplates: { ...project.commerceTemplates, designFamily },
    updatedAt: new Date().toISOString(),
  };
  onChange(
    designFamily === "catalog-modern-v2"
      ? ensureCatalogModernV2Sections(nextProject)
      : nextProject,
  );
};
```

También cambiar las llamadas de reparación en carga, importación, recuperación y guardado del repositorio para que una tienda V2 nunca quede con sólo una de las dos páginas modularizadas.

- [ ] **Step 4: Verificar que el Builder use metadata y no defaults duplicados**

No agregar una lista de ids a `Builder.tsx`. Confirmar que estas líneas existentes siguen siendo la única fuente de disponibilidad:

```ts
const modules = useMemo(
  () => allModules.filter((module) =>
    isModuleAvailableOnPage(module, pageKind, project.commerceTemplates.designFamily),
  ),
  [allModules, pageKind, project.commerceTemplates.designFamily],
);
```

Agregar a la prueba E2E una verificación del picker: al elegir `about` y abrir `Agregar sección`, aparece `Hero de Nosotros` y no aparece `Hero de Contacto`.

- [ ] **Step 5: Ejecutar typecheck y E2E focalizado**

Run: `corepack pnpm --filter @solara/studio typecheck`

Expected: PASS.

Run: `corepack pnpm exec playwright test tests/e2e/editor-builder.spec.ts -g "Nosotros V2"`

Expected: PASS.

- [ ] **Step 6: Commitear la integración de Studio**

```bash
git add apps/studio/src/lib/repository.ts apps/studio/src/features/ThemeEditor.tsx tests/e2e/editor-builder.spec.ts
git commit -m "feat: habilitar Nosotros V2 en el Builder"
```

## Task 5: Renderer Compartido Y Exportación De `/nosotros/`

**Files:**
- Modify: `packages/exporter/src/index.ts`
- Modify: `packages/exporter/src/index.test.ts`

**Interfaces:**
- `parseProject` normaliza con `ensureCatalogModernV2Sections` antes de Preview/export.
- V2 usa `renderProjectSections` para `pages.about.sections` dentro de `.solara-about-sections`.
- V1/legacy conserva exactamente el body actual.
- `AboutPage` mantiene canonical `/nosotros/`, breadcrumbs y metadata de `aboutConfig`.

- [ ] **Step 1: Escribir tests de exportación y preview que fallen**

Agregar a `packages/exporter/src/index.test.ts`:

```ts
it("renderiza Nosotros V2 desde sections editables y mantiene el orden", () => {
  const project = structuredClone(catalogModernV2Store);
  const about = project.pages.find((page) => page.kind === "about");
  if (!about) throw new Error("Fixture sin página about");
  about.sections[0] = {
    ...about.sections[0],
    settings: {
      ...about.sections[0].settings,
      title: "Título editable de Nosotros",
      body: "Descripción editable de Nosotros",
    },
  };

  const result = exportProject(project, { mode: "production" });
  const html = String(result.files.get("nosotros/index.html"));
  expect(html).toContain('class="solara-about-page solara-container"');
  expect(html).toContain('data-solara-module="about-hero"');
  expect(html).toContain('data-solara-module="about-history"');
  expect(html).toContain('data-solara-module="about-products-cta"');
  expect(html).toContain("Título editable de Nosotros");
  expect(html).toContain("Descripción editable de Nosotros");
  expect(html).not.toContain("Elegimos objetos para vivirlos.");
  expect(html).toContain("<title>Nosotros | Modo Sur</title>");
  expect(html).toContain('"@type":"AboutPage"');
  expect(html).toContain('rel="canonical"');
});

it("mantiene el fallback de Nosotros para proyectos no V2", () => {
  const project = structuredClone(catalogModernStore);
  const result = exportProject(project, { mode: "production" });
  const html = String(result.files.get("nosotros/index.html"));
  expect(html).toContain("solara-editorial-page");
  expect(html).toContain("solara-story-grid");
  expect(html).not.toContain('data-solara-module="about-hero"');
});

it("usa el mismo renderer de secciones en preview y exportación", () => {
  const project = structuredClone(catalogModernV2Store);
  const about = project.pages.find((page) => page.kind === "about");
  if (!about) throw new Error("Fixture sin página about");
  about.sections[0] = {
    ...about.sections[0],
    settings: { ...about.sections[0].settings, title: "Preview Nosotros" },
  };
  expect(renderPreviewHtml(project, "draft", "/nosotros/")).toContain("Preview Nosotros");
  expect(String(exportProject(project, { mode: "draft" }).files.get("nosotros/index.html"))).toContain("Preview Nosotros");
});
```

- [ ] **Step 2: Ejecutar los tests para confirmar que aún se usa el body antiguo**

Run: `corepack pnpm --filter @solara/exporter test -- index.test.ts`

Expected: FAIL porque `/nosotros/` todavía usa el header hardcodeado y no normaliza la fixture about.

- [ ] **Step 3: Cambiar la normalización del exporter**

En `packages/exporter/src/index.ts`, importar `ensureCatalogModernV2Sections` desde `@solara/project-schema/catalog-modern-template` y cambiar `parseProject` a:

```ts
function parseProject(projectInput: StoreProjectV1, operation: string): StoreProjectV1 {
  const result = StoreProjectV1Schema.safeParse(projectInput);
  if (result.success) return ensureCatalogModernV2Sections(result.data);
  const details = result.error.issues
    .map((issue) => `${issue.path.join(".") || "project"}: ${issue.message}`)
    .join("; ");
  throw new Error(`No se puede ${operation}: el proyecto es inválido. ${details}`);
}
```

- [ ] **Step 4: Agregar la rama V2 y mantener la rama legacy explícita**

En `buildPages`, antes de `aboutPage`, calcular:

```ts
const isAboutV2 = project.commerceTemplates.designFamily === "catalog-modern-v2";
const aboutV2Sections = editableSections("about");
const aboutHero = aboutV2Sections.find((section) => section.moduleId === "about-hero" && section.enabled);
const aboutPreloadImage = isAboutV2 && typeof aboutHero?.settings.imageAssetId === "string"
  ? imageUrl(project, aboutHero.settings.imageAssetId)
  : undefined;
const aboutV2Body = [
  renderProjectSections(project, sharedHeader, { pageType: "about" }),
  `<main class="solara-about-page solara-container"><nav class="solara-breadcrumbs" aria-label="Migas de pan"><a href="${internalHref(project, "/")}">Inicio</a><span aria-hidden="true">/</span><span aria-current="page">Nosotros</span></nav><div class="solara-about-sections">${renderProjectSections(project, aboutV2Sections, { pageType: "about" })}</div></main>`,
  renderProjectSections(project, sharedFooter, { pageType: "about" }),
].join("");
```

Set `aboutPage.body` to `isAboutV2 ? aboutV2Body : legacyAboutBody`, where `legacyAboutBody` is the unchanged current array:

```ts
const legacyAboutBody = [
  renderProjectSections(project, sharedHeader, { pageType: "about" }),
  `<main class="solara-editorial-page solara-container"><nav class="solara-breadcrumbs" aria-label="Migas de pan"><a href="${internalHref(project, "/")}">Inicio</a><span aria-hidden="true">/</span><span>Nosotros</span></nav><header class="solara-page-intro"><p class="solara-eyebrow">Nuestra mirada</p><h1>${escapeHtml(aboutConfig?.title ?? "Elegimos objetos para vivirlos.")}</h1><p>${escapeHtml(project.identity.description)}</p></header><section class="solara-story-grid"><div><h2>Lo que nos guía</h2><p>${escapeHtml(project.identity.description)}</p></div><div><h2>Información clara</h2><p>${escapeHtml(project.policies.shipping.summary)}</p><a class="solara-secondary-action" href="/contacto/">Conocé cómo contactarnos</a></div></section><section class="solara-values-grid"><article><h2>Selección</h2><p>${escapeHtml(project.collections[0]?.description ?? "Conocé nuestras colecciones.")}</p></article><article><h2>Entrega</h2><p>${escapeHtml(project.policies.shipping.summary)}</p></article><article><h2>Atención directa</h2><p>${escapeHtml(project.identity.email || project.identity.phone || "Escribinos para recibir asesoramiento.")}</p></article></section></main>`,
  editableSections("about").length
    ? renderProjectSections(project, editableSections("about"), { pageType: "about" })
    : "",
  renderProjectSections(project, sharedFooter, { pageType: "about" }),
].join("");
```

Do not alter this legacy array while adding the branch. Add `...(aboutPreloadImage ? { preloadImage: aboutPreloadImage } : {})` to the descriptor so the configured hero asset is critical only on V2.

- [ ] **Step 5: Ejecutar exporter y preview**

Run: `corepack pnpm --filter @solara/exporter test -- index.test.ts`

Expected: PASS, incluyendo V2 editable, preview/export parity, canonical/metadata y fallback V1.

Run: `corepack pnpm --filter @solara/exporter typecheck`

Expected: PASS.

- [ ] **Step 6: Commitear el renderer compartido**

```bash
git add packages/exporter/src/index.ts packages/exporter/src/index.test.ts
git commit -m "feat: renderizar Nosotros V2 desde secciones"
```

## Task 6: E2E De Storefront, Mobile, No-JS Y Accesibilidad

**Files:**
- Create: `tests/e2e/about-v2.spec.ts`
- Modify: `tests/e2e/axe-site.spec.ts`

**Interfaces:**
- Tests use `catalogModernV2Store` and `exportProject` as `contact-v2.spec.ts` does.
- The test server serves exported files and the four deterministic fixture images.
- No test mutates or deletes user project files.

- [ ] **Step 1: Crear servidor local y pruebas de contenido**

Crear `tests/e2e/about-v2.spec.ts` con la misma resolución de rutas y `fixtureFiles` de `contact-v2.spec.ts`. Las pruebas mínimas son:

```ts
test("Nosotros V2 renderiza sus módulos en orden y omite equipo por default", async ({ page }) => {
  await page.goto(new URL("/nosotros/", serverUrl).toString());
  const modules = await page.locator("[data-solara-module]").evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-solara-module")),
  );
  expect(modules).toEqual(expect.arrayContaining([
    "about-hero",
    "about-history",
    "about-principles",
    "about-editorial-image",
    "about-process",
    "about-manifesto",
    "about-experience",
    "about-stats",
    "about-products-cta",
    "catalog-newsletter-cta",
    "catalog-footer",
  ]));
  expect(await page.locator('[data-solara-module="about-team"]').count()).toBe(0);
  await expect(page.locator(".about-hero h1")).toHaveText("Una selección pensada para moverte.");
  await expect(page.locator(".about-principle-item")).toHaveCount(4);
  await expect(page.locator(".about-process-item")).toHaveCount(4);
  await expect(page.locator(".about-stats-grid article")).toHaveCount(4);
});

test("Nosotros V2 no desborda en mobile y conserva el copy sin JavaScript", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL("/nosotros/", serverUrl).toString());
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator(".about-hero-image")).toBeVisible();
  await expect(page.locator(".about-manifesto blockquote")).toBeVisible();

  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const noJsPage = await context.newPage();
  await noJsPage.goto(new URL("/nosotros/", serverUrl).toString());
  await expect(noJsPage.locator(".about-hero h1")).toHaveText("Una selección pensada para moverte.");
  await expect(noJsPage.getByRole("link", { name: "Explorar productos" })).toHaveAttribute("href", "/buscar/");
  await context.close();
});

test("Nosotros V2 respeta reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(new URL("/nosotros/", serverUrl).toString());
  await expect(page.locator('[data-solara-module="about-hero"] [data-motion-zone]')).toHaveCSS("animation-name", "none");
  await expect(page.locator(".about-hero h1")).toBeVisible();
});

test("Nosotros V2 conserva foco visible al navegar por teclado", async ({ page }) => {
  await page.goto(new URL("/nosotros/", serverUrl).toString());
  const cta = page.getByRole("link", { name: "Explorar productos" });
  await cta.focus();
  await expect(cta).toBeFocused();
  await expect(cta).toHaveCSS("outline-style", "solid");
});
```

- [ ] **Step 2: Ejecutar E2E focalizado para confirmar cualquier mismatch de markup**

Run: `corepack pnpm exec playwright test tests/e2e/about-v2.spec.ts`

Expected after implementation: 4 tests PASS.

- [ ] **Step 3: Incluir Nosotros en axe del sitio**

En `tests/e2e/axe-site.spec.ts`, agregar `"/nosotros/"` al array que devuelve `routesFor`. Ejecutar:

Run: `corepack pnpm exec playwright test tests/e2e/axe-site.spec.ts -g "axe sobre las rutas"`

Expected: cero violaciones nuevas para `catalogModern` y las otras fixtures.

- [ ] **Step 4: Commitear la cobertura de storefront**

```bash
git add tests/e2e/about-v2.spec.ts tests/e2e/axe-site.spec.ts
git commit -m "test: cubrir Nosotros V2 en storefront"
```

## Task 7: QA Final, Documentación Y Entrega

**Files:**
- Modify: `CHANGELOG.md`
- Verify only: all files from Tasks 1-6

- [ ] **Step 1: Agregar entrada de changelog sin modificar entradas históricas**

Insertar arriba de Contacto V2:

```md
### Nosotros V2 editorial y modular (2026-08-15)

- Nueva página `/nosotros/` para `catalog-modern-v2`, con hero editorial,
  historia, principios, proceso, manifiesto, experiencia, estadísticas y CTA.
- El Builder permite editar módulos, repeaters, assets y toggles de equipo e
  imagen editorial sin afectar Home, Contacto, V1 ni legacy.
- Preview y exportación comparten el renderer de secciones; la salida inicial
  conserva contenido sin JavaScript, `AboutPage`, canonical y breadcrumbs.
- Verificado: schema, módulos, exporter, Builder, E2E responsive/no-JS/axe,
  `corepack pnpm check`, build y portable smoke.
```

- [ ] **Step 2: Ejecutar gates proporcionales del código afectado**

Run: `corepack pnpm --filter @solara/project-schema test`

Expected: PASS.

Run: `corepack pnpm --filter @solara/modules test`

Expected: PASS.

Run: `corepack pnpm --filter @solara/exporter test`

Expected: PASS.

Run: `corepack pnpm --filter @solara/studio typecheck`

Expected: PASS.

Run: `corepack pnpm exec playwright test tests/e2e/about-v2.spec.ts tests/e2e/editor-builder.spec.ts -g "Nosotros V2|Nosotros"`

Expected: all focused Nosotros tests PASS; existing matching V2 tests remain green.

- [ ] **Step 3: Ejecutar gate completo y distribución**

Run: `corepack pnpm check`

Expected: repository, format, typecheck, all package tests, optimization and runtime serialization PASS.

Run: `corepack pnpm build`

Expected: all workspace builds PASS.

Run: `corepack pnpm desktop:build`

Expected: desktop build PASS.

Run: `corepack pnpm desktop:package`

Expected: portable distribution generated with the current source and preserved stores/runtime.

Run: `corepack pnpm portable:smoke`

Expected: portable smoke PASS.

- [ ] **Step 4: Revisar diff, artefactos y estado**

Run: `git diff --check`

Expected: no output.

Run: `corepack pnpm check:repository`

Expected: PASS; no `dist/`, `.release/`, `proyectos/`, `.solara-runtime/`, reports or binaries staged.

Run: `git status --short`

Expected: only the intended Nosotros V2 files remain modified before the final commit; unrelated pre-existing files remain unstaged.

- [ ] **Step 5: Commitear documentación y changelog**

```bash
git add CHANGELOG.md
git commit -m "docs: documentar Nosotros V2 editorial"
```

- [ ] **Step 6: Revisar el resultado visual antes de declarar terminado**

Use the existing visual review path with `/nosotros/` at 1440x900, 1024x900 and 390x844. Confirm hero image ratio, no horizontal overflow, clear type hierarchy, no rounded SaaS cards, optional team absence without a gap, visible focus, readable no-JS content and reduced-motion stability. Do not commit screenshots or reports.

## Final Handoff

After all tasks pass, report the implementation commits, focused test counts, full gate result, portable version, and any unrelated worktree changes left untouched. Do not claim completion if any required gate is unavailable or failing.
