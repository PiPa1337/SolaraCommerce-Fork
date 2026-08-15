# Contacto V2 Modular Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `/contacto/` into a complete, editable `catalog-modern-v2` help and conversion page made from independent Builder modules.

**Architecture:** Store Contacto content in `project.pages[kind="contact"].sections`, register dedicated V2 contact modules, and render that section list from the shared exporter. Keep the current hardcoded Contacto renderer as the V1/legacy fallback. Add one minimal `contact` storefront capability for the WhatsApp form; all other behavior remains HTML-first.

**Tech Stack:** TypeScript, React 19, Zod, `@solara/modules`, `@solara/module-sdk`, Vite, Vitest, Playwright Chromium, shared exporter renderer, storefront runtime.

## Global Constraints

- Alcance: únicamente `catalog-modern-v2`.
- `catalog-modern-v1` y `legacy-editorial-v1` conservan su salida actual.
- `schemaVersion` permanece en `2`.
- `project.pages[kind="contact"].sections` es la fuente de verdad de Contacto V2.
- No crear un backend de formularios ni una bandeja de consultas.
- El formulario abre WhatsApp con los valores completados y no persiste datos personales.
- Preview y exportación usan el mismo renderer.
- El HTML inicial debe seguir siendo útil sin JavaScript.
- `prefers-reduced-motion: reduce` deja el contenido visible inmediatamente.
- No agregar dependencias de runtime sin justificar impacto en el sitio público y en los budgets existentes.
- No tocar cambios ajenos del worktree (`apps/desktop/src/main.mjs`, `scripts/enganches.test.ts`, `scripts/recursos-check.test.ts`, `tests/e2e/lcp-cold.spec.ts`, `diseño v2 codex/`).

## File Map

- Create: `packages/modules/src/contact-v2.ts` — schemas, defaults, manifests and renderers for the eight Contacto V2 modules.
- Modify: `packages/modules/src/index.ts` — registry exports and page availability filtering.
- Modify: `packages/modules/src/styles.ts` — isolated Contacto V2 layout, responsive rules, motion and no-JS presentation.
- Modify: `packages/exporter/src/index.ts` — V2 Contacto page rendering, ContactPage structured data and WhatsApp form attributes.
- Modify: `packages/exporter/src/index.test.ts` — exported HTML, SEO and fallback contracts.
- Modify: `packages/project-schema/src/catalog-modern-template.ts` — clean-project defaults and page section seed.
- Modify: `packages/project-schema/src/catalog-modern-v2-fixture.ts` — deterministic V2 Contacto sections.
- Create: `packages/modules/src/contact-v2.test.ts` — settings defaults, render markup and conditional output tests.
- Modify: `apps/studio/src/features/Builder.tsx` — page-aware module picker and section editing for Contacto.
- Modify: `apps/studio/src/features/builder/SettingsInspector.tsx` — expose all Contacto field types through the existing inspector controls.
- Modify: `apps/studio/src/lib/repository.ts` — backfill empty Contacto sections for existing V2 projects without changing `schemaVersion`.
- Modify: `packages/storefront-runtime/src/index.ts` — minimal `contact` capability for form-to-WhatsApp enhancement.
- Modify: `packages/storefront-runtime/src/index.test.ts` — runtime contract for the Contacto form.
- Modify: `packages/exporter/src/index.test.ts` — route, SEO and fallback coverage.
- Create: `tests/e2e/contact-v2.spec.ts` — Builder, desktop, mobile, WhatsApp URL, optional location, no-JS and accessibility paths.
- Modify: `CHANGELOG.md` — Spanish Keep a Changelog entry after implementation.

---

### Task 1: Define Contacto V2 Module Contracts

**Files:**
- Create: `packages/modules/src/contact-v2.ts`
- Create: `packages/modules/src/contact-v2.test.ts`

**Interfaces:**
- Produces `contactV2Modules`, `contactV2ModuleIds`, and the eight typed `ModuleDefinition` values consumed by the registry.
- Each module uses `manifest.slots: ["content"]`, `manifest.family: "catalog-modern-v1"` for current Catalog Modern registry compatibility, and `manifest.availability: "default"`; page/family filtering is added in Task 2.
- Each render receives `RenderContext<Settings>` and returns `SafeHtml` through `moduleRoot`.

- [ ] **Step 1: Write failing schema/default tests**

Add tests that parse `{}` for each settings schema and assert exact defaults:

```ts
expect(contactHeroSettings.parse({}).title).toBe("Estamos para ayudarte.");
expect(contactHelpGridSettings.parse({}).items).toHaveLength(4);
expect(contactPurchaseInfoSettings.parse({}).items).toHaveLength(3);
expect(contactFaqSettings.parse({}).items).toHaveLength(6);
expect(contactLocationSettings.parse({}).enabled).toBe(false);
```

Test repeater caps at 4, 3 and 8 with `safeParse` returning `success: false` above the limit.

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
npx vitest run packages/modules/src/contact-v2.test.ts
```

Expected: FAIL because the schemas and module exports do not exist.

- [ ] **Step 3: Add schemas and defaults**

Define these exact settings shapes in `contact-v2.ts`:

```ts
const contactHeroSettings = z.object({
  eyebrow: z.string().default("HABLEMOS"),
  title: z.string().default("Estamos para ayudarte."),
  body: z.string().default("Respondemos consultas, disponibilidad y detalles de entrega por canales directos."),
  quickLinks: z.array(contactQuickLinkSchema).max(4).default(defaultQuickLinks),
});

const contactFormSettings = z.object({
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
  reasons: z.array(z.string().min(1)).max(12).default(defaultContactReasons),
});

const contactChannelsSettings = z.object({
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

const contactHelpGridSettings = z.object({
  title: z.string().default("¿En qué podemos ayudarte?"),
  body: z.string().default("Elegí el tema para que podamos asistirte de la mejor manera."),
  items: z.array(contactHelpItemSchema).max(4).default(defaultHelpItems),
});

const contactWhatsappCtaSettings = z.object({
  title: z.string().default("¿Preferís hablar directamente?"),
  body: z.string().default("Consultanos por WhatsApp y coordinamos tu compra de forma personalizada."),
  actionLabel: z.string().default("Iniciar conversación"),
});

const contactPurchaseInfoSettings = z.object({
  items: z.array(contactPurchaseItemSchema).max(3).default(defaultPurchaseItems),
});

const contactFaqSettings = z.object({
  title: z.string().default("Preguntas frecuentes"),
  body: z.string().default("Respondemos las dudas más comunes."),
  items: z.array(contactFaqItemSchema).max(8).default(defaultFaqItems),
});

const contactLocationSettings = z.object({
  enabled: z.boolean().default(false),
  title: z.string().default("Visitanos"),
  body: z.string().default("Conocé nuestro espacio y probá lo que te representa."),
  address: z.string().default(""),
  hoursText: z.string().default(""),
  imageAssetId: z.string().default(""),
  mapHref: z.string().default(""),
  mapImageAssetId: z.string().default(""),
});
```

Use `icon`, `title`, `body`, `href` and `actionLabel` fields for quick/help items; use `question`, `answer` and `enabled` for FAQ items; use `icon`, `title`, `body` and `href` for purchase items. Every repeater item has a required non-empty `id`.

- [ ] **Step 4: Implement module renderers**

Render these exact semantic roots:

```html
<section data-solara-module="contact-hero">...</section>
<section data-solara-module="contact-form">...</section>
<section data-solara-module="contact-channels">...</section>
<section data-solara-module="contact-help-grid">...</section>
<section data-solara-module="contact-whatsapp-cta">...</section>
<section data-solara-module="contact-purchase-info">...</section>
<section data-solara-module="contact-faq">...</section>
<section data-solara-module="contact-location">...</section>
```

The form must emit labeled controls with `name` values `name`, `email`, `phone`, `reason`, `orderNumber` and `message`, plus `data-solara-contact-form`. The form root carries the normalized WhatsApp phone in a data attribute only when a public phone exists. The fallback link is visible without JavaScript.

Use `<details><summary>` for FAQ. Return `safeHtml("")` from `contact-location` when `enabled` is false or both `address` and `imageAssetId`/`mapImageAssetId` are empty.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run packages/modules/src/contact-v2.test.ts
```

Expected: PASS for schemas, default content, semantic roots, repeaters and the disabled-location no-markup contract.

- [ ] **Step 6: Commit the self-contained module contracts**

```bash
git add packages/modules/src/contact-v2.ts packages/modules/src/contact-v2.test.ts
git commit -m "feat: define módulos modulares de Contacto V2"
```

### Task 2: Register Modules And Make Builder Page-Aware

**Files:**
- Modify: `packages/modules/src/index.ts`
- Modify: `apps/studio/src/features/Builder.tsx`
- Test: `packages/modules/src/contact-v2.test.ts`

**Interfaces:**
- Produces `contactV2ModuleIds: ReadonlySet<string>` and
  `isModuleAvailableOnPage(definition, pageKind, designFamily): boolean`.

- [ ] **Step 1: Add registry availability tests**

Assert that every contact module is addable on `contact` + `catalog-modern-v2`, not addable on Home, and not addable for V1:

```ts
expect(isModuleAvailableOnPage(contactHero, "contact", "catalog-modern-v2")).toBe(true);
expect(isModuleAvailableOnPage(contactHero, "home", "catalog-modern-v2")).toBe(false);
expect(isModuleAvailableOnPage(contactHero, "contact", "catalog-modern-v1")).toBe(false);
```

- [ ] **Step 2: Implement page-aware filtering**

Keep `isAddableModule` unchanged for existing Home behavior. Add a page-aware helper and use it in Builder’s `modules` and `replacementModules` calculations:

```ts
export function isModuleAvailableOnPage(
  definition: RegisteredModule,
  pageKind: RenderPageType,
  designFamily?: string,
): boolean {
  if (!isAddableModule(definition)) return false;
  if (contactV2ModuleIds.has(definition.manifest.id)) {
    return pageKind === "contact" && designFamily === "catalog-modern-v2";
  }
  return !contactV2ModuleIds.has(definition.manifest.id);
}
```

Builder passes `project.commerceTemplates.designFamily` and `pageKind` when filtering. The existing selected compatibility module remains visible as a compatibility entry, but a Contacto V2 picker only offers the new contact modules plus the already-supported newsletter module.

- [ ] **Step 3: Ensure page changes preserve selection safely**

When `pageKind` changes to `contact`, select `editablePage.sections[0]?.id ?? ""`; keep the current slot restriction to `catalog`/`content`. When the selected section disappears, keep the existing effect that selects the first remaining section.

- [ ] **Step 4: Run Builder tests and commit**

```bash
npx vitest run packages/modules/src/contact-v2.test.ts
npx playwright test tests/e2e/editor-builder.spec.ts --grep "Contacto"
git add packages/modules/src/index.ts apps/studio/src/features/Builder.tsx packages/modules/src/contact-v2.test.ts
git commit -m "feat: habilitar módulos de Contacto V2 en el Builder"
```

### Task 3: Seed And Normalize Contacto V2 Sections

**Files:**
- Modify: `packages/project-schema/src/catalog-modern-template.ts`
- Modify: `packages/project-schema/src/catalog-modern-v2-fixture.ts`
- Modify: `apps/studio/src/lib/repository.ts` — call the Contacto normalization at project load.
- Test: `packages/project-schema/src/catalog-modern-template.test.ts`
- Test: `apps/studio/src/lib/repository.test.ts`

**Interfaces:**
- Produces a pure `defaultContactV2Sections(): StoreSection[]` factory and
  `ensureContactV2Sections(project): StoreProjectV1` normalization helper.

- [ ] **Step 1: Test clean template and V2 fixture defaults**

Assert that a clean Catalog Modern project has Contacto sections in page order:

```ts
const contact = clean.pages.find((page) => page.kind === "contact");
expect(contact?.sections.map((section) => section.moduleId)).toEqual([
  "contact-hero",
  "contact-form",
  "contact-channels",
  "contact-help-grid",
  "contact-whatsapp-cta",
  "contact-purchase-info",
  "contact-faq",
  "contact-location",
  "catalog-newsletter-cta",
]);
```

The `contact-location` module is included in the default section list with `enabled: false`, so enabling it later does not require adding a section through code. Assert that the V2 fixture has the same module IDs and that V1 does not gain them.

- [ ] **Step 2: Implement defaults without changing the schema version**

Create stable IDs such as `contact-section-hero`, `contact-section-form`, `contact-section-channels`, `contact-section-help`, `contact-section-whatsapp`, `contact-section-purchase`, `contact-section-faq`, `contact-section-location` and `contact-section-newsletter`. Build each section with `createModuleSection`-compatible settings and the page’s existing motion defaults.

Add `ensureContactV2Sections(project)`:

```ts
if (project.commerceTemplates.designFamily !== "catalog-modern-v2") return project;
const page = project.pages.find((candidate) => candidate.kind === "contact");
if (!page || page.sections.length > 0) return project;
return {
  ...project,
  pages: project.pages.map((candidate) =>
    candidate.kind === "contact" ? { ...candidate, sections: defaultContactV2Sections() } : candidate,
  ),
};
```

Call the helper at the same managed-project load/normalization boundary used for existing Catalog Modern upgrades. Do not mutate V1, legacy or non-empty Contacto pages. Persist the normalized result only on the next valid save.

- [ ] **Step 3: Test normalization idempotence**

Assert that an empty V2 Contacto page receives defaults, a second call returns an equivalent project, and a non-empty Contacto page is byte/content-preserved. Assert `schemaVersion === "2"` or numeric `2` according to the existing inferred type.

- [ ] **Step 4: Run schema/repository tests and commit**

```bash
npx vitest run packages/project-schema/src/catalog-modern-template.test.ts apps/studio/src/lib/repository.test.ts
git add packages/project-schema/src/catalog-modern-template.ts packages/project-schema/src/catalog-modern-v2-fixture.ts apps/studio/src/lib/repository.ts packages/project-schema/src/catalog-modern-template.test.ts apps/studio/src/lib/repository.test.ts
git commit -m "feat: seedear y normalizar secciones de Contacto V2"
```

### Task 4: Render Contacto V2 From Page Sections

**Files:**
- Modify: `packages/exporter/src/index.ts`
- Modify: `packages/exporter/src/index.test.ts`
- Test: `tests/e2e/contact-v2.spec.ts`

**Interfaces:**
- Consumes `project.pages.find(page => page.kind === "contact").sections` and the registered contact modules.
- Produces the same `contact/index.html` route with V2 section markup and `ContactPage` JSON-LD.

- [ ] **Step 1: Add exporter tests before branching the renderer**

Create a V2 project fixture with one contact section and assert:

```ts
const html = String(exportProject(v2Project, { mode: "production" }).files.get("contacto/index.html"));
expect(html).toContain('data-solara-module="contact-hero"');
expect(html).toContain('data-solara-module="contact-form"');
expect(html).toContain('"@type":"ContactPage"');
```

Assert that the old hardcoded strings (`Lo que nos guía`, `Información clara`) do not appear in the V2 document unless supplied by a configured module.

- [ ] **Step 2: Branch V2 and keep fallback renderers**

In the Contact page descriptor:

```ts
const isContactV2 = project.commerceTemplates.designFamily === "catalog-modern-v2";
const contactSections = editableSections("contact");
const contactBody = isContactV2
  ? [
      renderProjectSections(project, sharedHeader, { pageType: "contact" }),
      `<main class="solara-contact-page solara-container">${breadcrumbMarkup}<div class="solara-contact-sections">${renderProjectSections(project, contactSections, { pageType: "contact" })}</div></main>`,
      renderProjectSections(project, sharedFooter, { pageType: "contact" }),
    ].join("")
  : existingContactBody;
```

Keep the existing Contacto body for V1/legacy. Make the `ContactPage` structured data and canonical remain identical regardless of the branch.

- [ ] **Step 3: Verify conditionals and route output**

Add tests for disabled location, no public WhatsApp, empty channels, and V1 fallback. Test that the Contacto page has one breadcrumb, one main landmark and no empty module wrapper for disabled sections.

- [ ] **Step 4: Run exporter tests and commit**

```bash
npx vitest run packages/exporter/src/index.test.ts
git add packages/exporter/src/index.ts packages/exporter/src/index.test.ts
git commit -m "feat: renderizar Contacto V2 desde secciones editables"
```

### Task 5: Add WhatsApp Form Capability

**Files:**
- Modify: `packages/exporter/src/index.ts` — add `contact` to runtime features when a `contact-form` module is active.
- Modify: `packages/storefront-runtime/src/index.ts` — add `connectContactForms`.
- Modify: `packages/storefront-runtime/src/index.test.ts` — runtime string and guard tests.
- Modify: `packages/modules/src/contact-v2.ts` — form attributes and no-JS fallback.

**Interfaces:**
- Markup: `<form data-solara-contact-form data-whatsapp-phone="...">`.
- Runtime function: `connectContactForms(): void`.

- [ ] **Step 1: Test runtime contract**

Assert the serialized runtime contains `connectContactForms`, `data-solara-contact-form`, `encodeURIComponent`, and the `wa.me` URL construction. Assert that it does not add `scroll` listeners or third-party calls.

- [ ] **Step 2: Implement the capability**

The handler reads `FormData`, builds this exact message shape, and opens WhatsApp:

```text
Hola {brandName}, quiero hacer una consulta.
Nombre: {name}
Email: {email}
Teléfono: {phone}
Motivo: {reason}
Número de pedido: {orderNumber}
Mensaje: {message}
```

Omit optional empty lines. Use `window.open("https://wa.me/" + phone + "?text=" + encodeURIComponent(message), "_blank", "noopener")`; preserve native form submission fallback by keeping a visible generic WhatsApp link and a `noscript` message.

Initialize only when the `contact` feature is declared and a matching form exists. Do not store form values in localStorage, IndexedDB or the project.

- [ ] **Step 3: Run runtime tests and commit**

```bash
npx vitest run packages/storefront-runtime/src/index.test.ts
git add packages/exporter/src/index.ts packages/storefront-runtime/src/index.ts packages/storefront-runtime/src/index.test.ts packages/modules/src/contact-v2.ts
git commit -m "feat: conectar formulario de Contacto con WhatsApp"
```

### Task 6: Style Contacto V2 And Motion

**Files:**
- Modify: `packages/modules/src/styles.ts`
- Test: `tests/e2e/contact-v2.spec.ts`

**Interfaces:**
- All selectors are scoped under `[data-solara-module="contact-..."]` or `.cm.v2 .solara-contact-page`.
- Existing Home V2 tokens (`--catalog-paper`, `--catalog-ink`, `--catalog-sale`, `--catalog-border`, spacing and easing vars) are reused.

- [ ] **Step 1: Add desktop layout rules**

Implement these structural rules without introducing new rounded-card patterns:

```css
.cm.v2 .solara-contact-page { width: min(calc(100% - 3rem), var(--catalog-v2-wide)); margin-inline: auto; }
.cm.v2 .contact-hero { display: grid; grid-template-columns: minmax(0, .9fr) minmax(20rem, 1fr); gap: clamp(3rem, 8vw, 9rem); }
.cm.v2 .contact-main-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: clamp(2rem, 5vw, 5rem); border-top: 1px solid var(--catalog-border); }
.cm.v2 .contact-help-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; }
.cm.v2 .contact-purchase-info { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; border-block: 1px solid var(--catalog-border); }
```

Use square blocks, thin separators and the same dark CTA pattern as the existing Home newsletter/WhatsApp blocks.

- [ ] **Step 2: Add mobile rules**

At `max-width: 767px`, collapse hero, form/channels, help and purchase grids to one column or an intentional two-column help grid; preserve minimum 44px controls; keep the module order and remove hidden location from flow.

- [ ] **Step 3: Add motion and reduced-motion rules**

Gate module animations with `[data-motion-visible="true"]`; use `solara-hero-rise` for hero copy and section headers and explicit 70ms item delays for help/FAQ/purchase items. Add all Contacto selectors to the existing reduced-motion block so `animation:none`, `transition:none` and visible content are guaranteed.

- [ ] **Step 4: Verify visual contracts**

The E2E test must assert no horizontal overflow at `1920x968`, `1024x768`, `768x1024` and `390x844`; assert hidden location produces no layout box; assert help/purchase separators stay within their modules.

- [ ] **Step 5: Commit styling**

```bash
git add packages/modules/src/styles.ts tests/e2e/contact-v2.spec.ts
git commit -m "feat: diseñar Contacto V2 con layout editorial y motion"
```

### Task 7: Integrate Builder, Defaults And Page E2E

**Files:**
- Modify: `apps/studio/src/features/Builder.tsx`
- Modify: `apps/studio/src/features/builder/SettingsInspector.tsx` only for any field rendering needed by Contacto repeaters.
- Create: `tests/e2e/contact-v2.spec.ts` — Builder navigation, section editing, form and conditional location coverage.
- Modify: `tests/e2e/editor-builder.spec.ts` — page selector and module picker coverage for Contacto.

- [ ] **Step 1: Add Builder navigation test**

Open the Builder, select `Contacto`, assert the page selector value is `contact`, and assert the first default section is `contact-hero`.

- [ ] **Step 2: Add module editing tests**

From the Builder, edit the hero title, disable location, add a FAQ item, reorder the help section, and assert the resulting project state/preview changes. Use `data-section-select` and existing settings field labels instead of CSS-only selectors.

- [ ] **Step 3: Add form and optional-location E2E**

On the exported V2 Contact page:

```ts
await expect(page.locator(".contact-location")).toHaveCount(0);
await page.locator('[data-solara-contact-form] input[name="name"]').fill("Ana");
await page.locator('[data-solara-contact-form] textarea[name="message"]').fill("Consulta");
await expect(page.locator('[data-solara-contact-form]')).toBeVisible();
```

Capture the `page.waitForEvent("popup")` URL after submit and assert it starts with `https://wa.me/` and contains encoded `Ana`/`Consulta`.

- [ ] **Step 4: Run Builder/contact E2E and commit**

```bash
npx playwright test tests/e2e/contact-v2.spec.ts tests/e2e/editor-builder.spec.ts
git add apps/studio/src/features/Builder.tsx apps/studio/src/features/builder/SettingsInspector.tsx tests/e2e/contact-v2.spec.ts tests/e2e/editor-builder.spec.ts
git commit -m "test: cubrir Contacto V2 editable desde el Builder"
```

### Task 8: Final Gates, Documentation And Portable Delivery

**Files:**
- Modify: `CHANGELOG.md`
- No generated artifacts committed: keep `dist/`, `.release/`, `proyectos/`, `.solara-runtime/` ignored.

- [ ] **Step 1: Run focused package tests**

```bash
npx vitest run packages/project-schema packages/modules packages/exporter packages/storefront-runtime
npx vitest run --configLoader runner apps/studio
```

Expected: all existing tests plus the new Contacto tests pass.

- [ ] **Step 2: Run proportional browser gates**

```bash
npx playwright test tests/e2e/contact-v2.spec.ts tests/e2e/editor-builder.spec.ts
npx playwright test tests/e2e/nojs-coverage.spec.ts tests/e2e/editor-a11y.spec.ts
```

- [ ] **Step 3: Run repository gates**

```bash
corepack pnpm check:budgets
corepack pnpm format:check
corepack pnpm typecheck
git diff --check
corepack pnpm check:repository
```

- [ ] **Step 4: Review output and update changelog**

Add a Spanish Keep a Changelog entry describing the modular Contacto V2 page,
the Builder integration, WhatsApp form behavior and optional location.

- [ ] **Step 5: Rebuild and preserve portable user data**

```bash
corepack pnpm build
corepack pnpm desktop:build
corepack pnpm desktop:package
corepack pnpm portable:smoke
```

Before reporting completion, verify the portable manifest version before and
after packaging; `create-portable-distribution.mjs` must preserve a newer
portable store and `.solara-runtime/`.

- [ ] **Step 6: Commit the final documentation and delivery state**

```bash
git add CHANGELOG.md
git commit -m "feat: completar página Contacto V2 modular y editable"
git push origin main
```

## Plan Self-Review

- Spec coverage: architecture, eight independent modules, Builder page scope,
  defaults/normalization, WhatsApp form, visual order, responsive behavior,
  optional location, SEO, accessibility, no-JS and QA are covered above.
- Placeholder scan: no unfinished task, fake implementation step or unspecified
  implementation remains in the plan.
- Type consistency: module IDs, settings names, data attributes and
  `isModuleAvailableOnPage` signatures are used consistently across tasks.
- Scope: all tasks belong to one Contacto V2 feature; V1/legacy are explicitly
  fallback boundaries and are not modified.
