# Revamp de movimiento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. This plan runs in PARALLEL waves on disjoint files.

**Goal:** Modernizar la capa de movimiento del storefront Catalog Modern (hovers, scroll/appear, atmósfera, micro-interacciones) + módulos ligeros FAQ/stats, entregando la candidata "Predeterminado Revamp" sin tocar la Predeterminado actual.

**Architecture:** (1A) motor runtime: 2 presets nuevos + capability `micro` (tilt/magnetic/spotlight/hero parallax/back-to-top/kinetic); (1B) CSS de efectos en módulos; (2A) seed `revamp` + módulos `catalog-faq`/`catalog-stats` + candidata; (2B) specs de budgets/E2E; (3E) gate + changelog + ejecutables.

**Tech Stack:** Node 22+ (release), pnpm 10.15.1, Vitest, Playwright Chromium.

## Global Constraints

- No modificar la forma de `StoreProjectV2Schema`/`schemaVersion: 2`; sólo literales ADITIVOS en `MotionPresetSchema` ("zoom-in", "blur-in") con tests.
- Runtime serializado por `fn.toString()`: toda función nueva vive dentro de `storefrontBoot` y es autocontenida; `check:runtime-serialization` sigue verde.
- Static-first: HTML útil sin JS; estados finales visibles; `prefers-reduced-motion` desactiva todo efecto nuevo; teclado/foco intactos; efectos sólo con `transform/opacity/filter` (nunca layout).
- Budgets: JS runtime ≤ 52 KiB (esperado ~49.2), CSS runtime ≤ 8 KiB (~7.3), storefront.css ≤ 780 KiB. Verificar con `check:budgets`.
- Sin CDN, sin deps nuevas, sin fuentes externas.
- Commits breves en español, uno por task (salvo indicación); `git add` SÓLO los archivos propios; si el commit falla por lock del índice (ola paralela), esperar 3 s y reintentar hasta 3 veces.
- `format:check` (Biome) y `git diff --check` limpios; no commitear `proyectos/`, `.solara-runtime/`, `.release/`, `dist/`, `test-results/`, `.superpowers/`.
- Gate completo en 3E: `check`, `build`, `check:budgets`, `benchmark:export`, `test:e2e` + reconstruir ejecutables (`desktop:build`, `desktop:package`, `portable:smoke`).

---

### Task 1A: Motor runtime — presets zoom/blur + capability micro

**Files:**
- Modify: `packages/project-schema/src/index.ts` (`MotionPresetSchema` ~línea 200)
- Modify: `packages/project-schema/src/index.test.ts` (presets nuevos)
- Modify: `packages/storefront-runtime/src/index.ts` (features default ~línea 131, CSS de presets ~línea 1365+, bloque `micro` dentro de `storefrontBoot`)
- Modify: `packages/storefront-runtime/src/index.test.ts` (guard de serialización con marcador `micro`)

**Interfaces:**
- Produces: presets `"zoom-in"`/`"blur-in"` válidos en `MotionPresetSchema`; capability `"micro"` en la lista default de features; bloque `initMicroInteractions` DENTRO de `storefrontBoot` (autocontenido) con: tilt 3D en `[data-product-card]` (rotateX/Y ≤6°, perspectiva 800px vía `--rx/--ry`), botones magnéticos en `[data-magnetic]` (≤8px), spotlight en cards (`--mx/--my` en %), hero parallax en `[data-hero-parallax]` (capas `[data-parallax-layer]`, ±12px con lerp rAF), back-to-top `[data-back-to-top]` (aparece >600px, anillo SVG `[data-back-to-top-ring]` con `stroke-dashoffset`, click → smooth scroll), kinetic title `[data-kinetic-title]` (split por palabra en spans con `data-word`, stagger 40ms, rotación 2°).
- Gate de activación: `hasFeature("micro")` && `matchMedia("(hover: hover) and (pointer: fine)").matches` && !reduceMotion.

- [ ] **Step 1: Tests del schema primero**

En `packages/project-schema/src/index.test.ts`, dentro del describe de motion:

```ts
  it("acepta los presets zoom-in y blur-in en la validación", () => {
    const section = referenceStore.sections[0];
    const parsed = StoreProjectV2Schema.parse({
      ...referenceStore,
      sections: section
        ? [
            {
              ...section,
              motion: { ...section.motion, preset: "zoom-in" as const },
            },
          ]
        : [],
    });
    expect(parsed.sections[0]?.motion.preset).toBe("zoom-in");
  });
```

(Ajustar al archivo de tests real; el punto es fijar que los literales nuevos pasan la validación y el round-trip.)

- [ ] **Step 2: Schema**

En `packages/project-schema/src/index.ts`, `MotionPresetSchema`:

```ts
export const MotionPresetSchema = z.enum([
  "none",
  "fade",
  "fade-up",
  "slide",
  "scale",
  "stagger",
  "parallax",
  "scroll-progress",
  "layer-stack",
  "zoom-in",
  "blur-in",
]);
```

- [ ] **Step 3: Feature default + CSS de presets (runtime)**

En `packages/storefront-runtime/src/index.ts`:
1. Línea ~131, agregar `micro` a la lista default:

```ts
      ? "cart,checkout,product,category,search,hero,motion,variants,filters,video,micro"
```

2. En `STOREFRONT_RUNTIME_CSS`, junto a los selectores de presets existentes (~línea 1365), agregar:

```css
[data-motion-root][data-motion-visible="true"][data-motion-preset="zoom-in"] [data-motion-zone] {
  animation: solara-motion-zoom-in var(--motion-duration, 600ms) var(--motion-easing, cubic-bezier(.16, 1, .3, 1)) var(--motion-delay, 0ms) both;
}
[data-motion-root][data-motion-visible="true"][data-motion-preset="blur-in"] [data-motion-zone] {
  animation: solara-motion-blur-in var(--motion-duration, 700ms) var(--motion-easing, cubic-bezier(.16, 1, .3, 1)) var(--motion-delay, 0ms) both;
}
@keyframes solara-motion-zoom-in {
  from { opacity: 0; transform: scale(calc(1 + (0.06 * var(--motion-intensity, 1)))); }
}
@keyframes solara-motion-blur-in {
  from { opacity: 0; filter: blur(calc(10px * var(--motion-intensity, 1))); }
}
```

(El bloque `prefers-reduced-motion` existente ya neutraliza `[data-motion-zone]`.)

- [ ] **Step 4: Bloque `micro` dentro de storefrontBoot**

Antes del cierre de `storefrontBoot` (junto al bloque de motion existente), agregar (autocontenido, sin referencias externas):

```ts
  const initMicroInteractions = (): void => {
    if (!hasFeature("micro")) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (reduce || !fine) return;

    document.querySelectorAll<HTMLElement>("[data-product-card]").forEach((card) => {
      let frame = 0;
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty("--mx", `${((x + 0.5) * 100).toFixed(2)}%`);
        card.style.setProperty("--my", `${((y + 0.5) * 100).toFixed(2)}%`);
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          card.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
          card.style.setProperty("--ry", `${(x * 6).toFixed(2)}deg`);
        });
      });
      card.addEventListener("pointerleave", () => {
        cancelAnimationFrame(frame);
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });

    document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((button) => {
      button.addEventListener("pointermove", (event) => {
        const rect = button.getBoundingClientRect();
        const x = event.clientX - (rect.left + rect.width / 2);
        const y = event.clientY - (rect.top + rect.height / 2);
        const distance = Math.hypot(x, y);
        const pull = Math.min(8, distance * 0.15);
        const angle = Math.atan2(y, x);
        button.style.setProperty("--mx", `${(Math.cos(angle) * pull).toFixed(1)}px`);
        button.style.setProperty("--my", `${(Math.sin(angle) * pull).toFixed(1)}px`);
      });
      button.addEventListener("pointerleave", () => {
        button.style.setProperty("--mx", "0px");
        button.style.setProperty("--my", "0px");
      });
    });

    document.querySelectorAll<HTMLElement>("[data-hero-parallax]").forEach((root) => {
      const layers = Array.from(root.querySelectorAll<HTMLElement>("[data-parallax-layer]"));
      if (layers.length === 0) return;
      let targetX = 0;
      let targetY = 0;
      let currentX = 0;
      let currentY = 0;
      root.addEventListener("pointermove", (event) => {
        targetX = (event.clientX / window.innerWidth - 0.5) * 2;
        targetY = (event.clientY / window.innerHeight - 0.5) * 2;
      });
      const tick = (): void => {
        currentX += (targetX - currentX) * 0.08;
        currentY += (targetY - currentY) * 0.08;
        layers.forEach((layer, index) => {
          const depth = Number(layer.dataset.parallaxDepth ?? "1");
          layer.style.setProperty(
            "--px",
            `${(currentX * 12 * depth * (index + 1)).toFixed(2)}px`,
          );
          layer.style.setProperty(
            "--py",
            `${(currentY * 12 * depth * (index + 1)).toFixed(2)}px`,
          );
        });
        requestAnimationFrame(tick);
      };
      tick();
    });

    const backToTop = document.querySelector<HTMLElement>("[data-back-to-top]");
    if (backToTop) {
      const ring = backToTop.querySelector<SVGCircleElement>("[data-back-to-top-ring]");
      const update = (): void => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
        backToTop.hidden = window.scrollY < 600;
        if (ring && ring.r?.baseVal.value > 0) {
          const circumference = 2 * Math.PI * ring.r.baseVal.value;
          ring.style.strokeDashoffset = `${(circumference * (1 - progress)).toFixed(2)}`;
        }
      };
      window.addEventListener("scroll", update, { passive: true });
      update();
      backToTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    document.querySelectorAll<HTMLElement>("[data-kinetic-title]").forEach((title) => {
      const words = title.textContent?.split(/\s+/).filter(Boolean) ?? [];
      if (words.length < 2 || words.length > 14) return;
      title.textContent = "";
      words.forEach((word, index) => {
        const span = document.createElement("span");
        span.className = "solara-kinetic-word";
        span.textContent = word;
        span.style.setProperty("--word-index", String(index));
        title.append(span, " ");
      });
    });
  };
  initMicroInteractions();
```

- [ ] **Step 5: Guard de serialización**

En `packages/storefront-runtime/src/index.test.ts`, ampliar el guard existente:

```ts
    expect(STOREFRONT_RUNTIME_JS).toContain("initMicroInteractions");
    expect(STOREFRONT_RUNTIME_JS).toContain("data-back-to-top");
```

- [ ] **Step 6: Verificar**

Run: `corepack pnpm --filter @solara/project-schema test`, `--filter @solara/storefront-runtime test`, `--filter @solara/storefront-runtime typecheck`, `corepack pnpm exec vitest run scripts/runtime-serialization.test.ts`
Expected: PASS (el guard del schema nuevo falla primero en Step 1 → RED; luego GREEN). Registrar el tamaño raw de `STOREFRONT_RUNTIME_JS` (esperado ≤ 46 KiB) y CSS runtime (≤ 7.5 KiB).

- [ ] **Step 7: Commit**

```bash
git add packages/project-schema/src/index.ts packages/project-schema/src/index.test.ts packages/storefront-runtime/src/index.ts packages/storefront-runtime/src/index.test.ts
git commit -m "Agrega presets zoom y blur y la capability micro al runtime"
```

---

### Task 1B: CSS de efectos en módulos

**Files:**
- Modify: `packages/modules/src/styles.ts` (bloque nuevo de efectos al final, antes del cierre)
- Modify: `packages/modules/src/catalog-modern.ts` o `definitions.ts` (SOLO si un efecto necesita un marcador/atributo nuevo en el HTML del módulo — p. ej. `data-magnetic` en botones CTA del hero y `data-product-card` en grillas si no existe; verificar qué atributos ya emiten los módulos y agregar los mínimos necesarios)
- Test: `packages/modules/src/index.test.ts` o `packages/exporter/src/catalog-modern.test.ts` (un smoke que el CSS del sitio exportado contiene un selector nuevo, p. ej. `solara-card-lift`)

**Interfaces:**
- Produces: clases/selectores de efectos con prefijo `solara-` y scope por atributo raíz de módulo (`[data-solara-module="..."]`), todo bajo `@media (prefers-reduced-motion: reduce)` desactivado.

- [ ] **Step 1: Inventario de atributos**

Leer `packages/modules/src/catalog-modern.ts` y `definitions.ts` para confirmar qué atributos ya existen: `data-product-card` (grillas), botones CTA del hero (¿`data-magnetic`? no existe — agregarlo en los CTA del hero y del banner), `data-hero-parallax`/`data-parallax-layer` (no existen — agregarlos al hero con capas: media, texto, eyebrow), `data-kinetic-title` (agregarlo al título del hero), `data-back-to-top` (agregarlo como botón fijo del shell en el footer o al final del body — mejor: el FOOTER del módulo emite el botón con el anillo SVG). Documentar en el reporte cada atributo agregado y su módulo.

- [ ] **Step 2: CSS de efectos (catálogo A y C del spec)**

En `packages/modules/src/styles.ts`, agregar una sección `/* Revamp: efectos de movimiento */` con (valores exactos del spec):

1. `[data-solara-module] .solara-card-lift` o equivalente sobre cards existentes: `transition: transform 450ms cubic-bezier(.22,1,.36,1), box-shadow 450ms cubic-bezier(.22,1,.36,1), border-color 300ms;` + hover: `transform: translateY(-4px); box-shadow: 0 18px 40px -12px var(--solara-shadow, rgba(0,0,0,.18));` (usar tokens existentes del tema; si no existe `--solara-shadow`, definir con color del tema).
2. Borde gradiente animado en cards: `@property --solara-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }` + `.solara-card-glow::before` con `conic-gradient` y `animation: solara-angle-spin 6s linear infinite`; `@supports not (background: paint(worklet))` no aplica — usar `@property` con fallback: sin `@property`, borde estático.
3. Spotlight: `.solara-spotlight` con `background: radial-gradient(240px circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,.08), transparent 65%); opacity: 0; transition: opacity 300ms;` + hover `opacity: 1`.
4. Botones: `[data-magnetic]` con `transform: translate(var(--mx,0), var(--my,0))` y `transition: transform 200ms cubic-bezier(.34,1.56,.64,1);` + `.solara-btn-shine::after` barrido 600ms delay 150ms + glow del accent en hover.
5. Links navbar: underline `scaleX` 350ms con gradiente.
6. Bento: scale 1.03 500ms + overlay gradiente 300ms.
7. Testimonios/newsletter: elevación (mismo lenguaje).
8. Imagen pan: `.solara-image-pan img { transition: transform 800ms cubic-bezier(.22,1,.36,1); }` hover `scale(1.08)` (o 1.12 en cards grandes).
9. Focus-visible: `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent); }` (scope módulo).
10. Noise: `body::after` con data-URI `feTurbulence` SVG (opacity .04, `pointer-events:none`, `position:fixed; inset:0; z-index:9999`), + `animation: solara-grain 8s steps(4) infinite` (background-position shifts) — el data-URI: `url("data:image/svg+xml,...feTurbulence baseFrequency='0.8' numOctaves='2'...")` con `filter: url(#noise)` NO (no funciona en data-URI con fragment); usar `feTurbulence` rasterizado: simplemente SVG con `<filter id="n"><feTurbulence .../></filter><rect filter="url(#n)" .../>` — verificar en el navegador; fallback: opacidad 0 si no carga.
11. Marquee: `.solara-marquee-track { animation: solara-marquee 28s linear infinite; }` + `@keyframes solara-marquee { to { transform: translateX(-50%); } }` + pausa en hover (el HTML del brand strip debe duplicar el contenido — verificar el módulo; si no duplica, agregar el duplicado en el render del módulo con `aria-hidden="true"`).
12. Gradient-shift: `.solara-gradient-text { background: linear-gradient(90deg, ...); background-size: 200% 100%; animation: solara-gradient-shift 6s ease-in-out infinite alternate; }`.
13. Pulse rings: `.solara-pulse-ring` con 3 `::before/::after`/spans y `@keyframes solara-pulse { 0% {transform: scale(.6); opacity:.5} 100% {transform: scale(1.8); opacity:0} }` delays 0/.8s/1.6s, loop 3s — aplicado donde exista contenido de envíos (si el módulo no tiene sección de envíos, aplicar al hero en el badge de ubicación o al CTA primario; documentar la decisión).
14. Dots: `.solara-dot { animation: solara-dot 2.4s ease-in-out infinite; animation-delay: calc(var(--i) * .2s); }`.
15. Shimmer: `.solara-shimmer::after` barrido diagonal 1.2s.
16. Scrollbar: `html { scrollbar-color: var(--accent) transparent; }` + `::-webkit-scrollbar { width: 10px }` + thumb gradiente + hover glow + `::selection { background: color-mix(in srgb, var(--accent) 30%, transparent); }`.
17. Anuncio: `.solara-announcement::after` línea gradiente animada.
18. Scroll-reveal de títulos de sección: `@supports (animation-timeline: view()) { .solara-scroll-title { animation: solara-reveal linear both; animation-timeline: view(); animation-range: entry 10% cover 30%; } }` + keyframes opacity/translate.
19. Clip-path reveal: `.solara-clip-reveal { animation: solara-clip linear both; animation-timeline: view(); animation-range: entry 5% cover 35%; }` + `@keyframes solara-clip { from { clip-path: inset(12% 6% 12% 6%); transform: scale(1.05); } to { clip-path: inset(0); transform: scale(1); } }` (fallback sin `view()`: sin animación).
20. Kinetic words: `.solara-kinetic-word { display:inline-block; opacity:0; animation: solara-word-in 500ms cubic-bezier(.22,1,.36,1) forwards; animation-delay: calc(var(--word-index) * 40ms); transform: rotate(2deg); }` + `@keyframes solara-word-in { to { opacity:1; transform: rotate(0); } }` (el JS de 1A crea los spans; el CSS los anima).
21. Tilt: `[data-product-card] { transform: perspective(800px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)); transition: transform 200ms cubic-bezier(.22,1,.36,1); }` (solo bajo `(hover:hover) and (pointer:fine)` para no afectar táctil; con `@media (hover: hover) and (pointer: fine)`).
22. Back-to-top: `.solara-back-to-top` posicionado fixed abajo-derecha, anillo SVG con `stroke-dasharray` = circunferencia, `transition: opacity 300ms`, `[hidden]` opacity 0.

TODO bajo el bloque `@media (prefers-reduced-motion: reduce) { ... }` que anule las animaciones/transiciones nuevas (patrón existente).

- [ ] **Step 3: Atributos mínimos en los módulos**

Agregar a `catalog-modern.ts` (render de módulos) SOLO los atributos necesarios: `data-magnetic` en los CTA del hero y del announcement/CTA newsletter; `data-hero-parallax` + `data-parallax-layer` (con `data-parallax-depth`) en el hero (media como capa 1, título como capa 2, eyebrow como capa 3); `data-kinetic-title` en el título del hero; `data-back-to-top` con anillo SVG en el footer del shell; duplicado `aria-hidden` del contenido del brand strip para el marquee (si el módulo no lo tiene). Documentar cada uno.

- [ ] **Step 4: Test smoke**

En `packages/modules/src/index.test.ts` o `packages/exporter/src/catalog-modern.test.ts`, un test que exporte `catalogModernStore` y aserte que el CSS del sitio (`assets/storefront.css`) contiene al menos dos selectores nuevos (p. ej. `solara-card-lift` y `@keyframes solara-marquee`).

- [ ] **Step 5: Verificar**

Run: `corepack pnpm --filter @solara/modules test`, `--filter @solara/exporter test`, `--filter @solara/studio build`, `corepack pnpm check:budgets` (storefront.css ≤ 780 KiB).
Expected: PASS. `format:check`/`git diff --check` limpios.

- [ ] **Step 6: Commit**

```bash
git add packages/modules/src/styles.ts packages/modules/src/catalog-modern.ts packages/modules/src/index.test.ts
git commit -m "Agrega la capa de efectos visuales a los módulos catalog modern"
```

---

### Task 2A: Candidata — seed revamp + módulos FAQ/stats

**Files:**
- Modify: `packages/project-schema/src/catalog-modern-template.ts` (seed `revamp`)
- Modify: `packages/project-schema/src/catalog-modern-template.test.ts`
- Modify: `packages/modules/src/catalog-modern.ts` (módulos `catalog-faq`, `catalog-stats`)
- Modify: `packages/modules/src/styles.ts` (estilos FAQ/stats)
- Modify: `packages/modules/src/index.test.ts`
- Modify: `apps/studio/src/lib/repository.ts` (`ensureRevampDemoProject`)
- Modify: `apps/studio/src/lib/repository.test.ts`
- Modify: `apps/studio/src/App.tsx` (llamada del ensure)

**Interfaces:**
- Produces: `CatalogModernSeed = "clean" | "demo" | "revamp"`; `buildCatalogModernProject({ seed: "revamp" })` = clon de la demo con motion reconfigurado por sección; módulos `catalog-faq` (settings `{ title, items: [{ question, answer }] }`) y `catalog-stats` (settings `{ title, items: [{ value, suffix, label }] }`) registrados en `catalogModernModules`; `ensureRevampDemoProject(): Promise<boolean>` (ID `store-modo-sur-revamp`, nombre "Predeterminado Revamp", idempotente).

- [ ] **Step 1: Módulos FAQ y stats**

En `packages/modules/src/catalog-modern.ts`, siguiendo el patrón de los módulos existentes (settings schema Zod + `ModuleDefinition` con manifest/slots/settingsFields/motionZones/render/styleAsset):

- `faqSettings`: `{ title: z.string(), items: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).max(8) }` con defaults de 4-5 items genéricos (preguntas tipo "¿Hacen envíos a todo el país?" etc. — genéricas de ecommerce, deterministas).
- `statsSettings`: `{ title: z.string(), items: z.array(z.object({ value: z.number().int().min(0), suffix: z.string(), label: z.string() })).max(6) }` con defaults de 4 items (p. ej. 50 productos, 14 categorías, 60 variantes, 1 tienda — deterministas).
- Render de FAQ: `<section data-solara-module="catalog-faq" data-faq-root>` con `<h2>`, items `<details class="solara-faq-item">` (nativo: accesible, uno-abierto requiere JS — ver Step 3; usar `<details>` + JS para cerrar los demás), o `<button aria-expanded>` + panel `grid-template-rows`; elegir `<details>` + JS de exclusividad (más accesible por defecto sin JS).
- Render de stats: `<section data-solara-module="catalog-stats" data-stats-root>` con `<strong data-stat-value="N">` valores ESTÁTICOS (sin JS visibles) y `data-stat-target` para la animación.
- Registro en `catalogModernModules`.
- Estilos en `styles.ts` scoped por atributo raíz + reduced-motion.

- [ ] **Step 2: Runtime de FAQ (exclusividad) y stats (contadores)**

En `packages/storefront-runtime/src/index.ts`, dentro de `storefrontBoot` (autocontenido), un bloque `initFAQStats` activado por `hasFeature("micro")` (o "motion"):
- FAQ: `document.querySelectorAll<HTMLDetailsElement>("[data-faq-root] details")` → `toggle` event: al abrir uno, cerrar los demás del mismo root (`open = false`).
- Stats: `IntersectionObserver` sobre `[data-stat-target]` (threshold 0.5) → animar `[data-stat-value]` con rAF 1.2s easing expo-out desde 0 hasta el target, `toLocaleString("es-AR")`; respetar `prefers-reduced-motion` (fijar valor directo).

- [ ] **Step 3: Seed `revamp` en la plantilla**

En `catalog-modern-template.ts`:
- `export type CatalogModernSeed = "clean" | "demo" | "revamp";`
- En el constructor, rama `"revamp"`: clon de la demo (`catalogModernStore`) con overrides de `motion` por sección:
  - `catalog-hero` → `preset: "layer-stack"`, distance 24, duration 0.6, easing overshoot `cubic-bezier(.34,1.56,.64,1)`;
  - `catalog-product-grid` → `preset: "stagger"`, stagger 0.07, distance 20;
  - `catalog-category-bento` → `preset: "scale"`, distance 0, duration 0.5;
  - `catalog-testimonials` → `preset: "fade-up"`, distance 22;
  - `catalog-brand-strip` → `preset: "fade"`, duration 0.4;
  - resto: `fade-up` sutil (distance 16).
- Determinista: mismo clon + overrides fijos.

- [ ] **Step 4: Candidata en el dashboard**

En `apps/studio/src/lib/repository.ts` (patrón `ensureScaleDemoProject`):
- `export const REVAMP_DEMO_PROJECT_ID = "store-modo-sur-revamp";`
- `ensureRevampDemoProject()`: si no existe el registro, `buildCatalogModernProject({ seed: "revamp", id: REVAMP_DEMO_PROJECT_ID, name: "Predeterminado Revamp", slug: "predeterminado-revamp" })`, agregar las secciones FAQ y stats (importando `defaultSettingsForModule`/`createModuleSection` de `@solara/modules` — studio ya depende de modules) insertadas antes del footer, con motion `fade-up`, y `saveProject`.
- `App.tsx`: llamar `ensureRevampDemoProject()` junto a `ensureScaleDemoProject()` con su aviso ("Se agregó la tienda Predeterminado Revamp para comparar la nueva experiencia de movimiento.").

- [ ] **Step 5: Tests**

- `catalog-modern-template.test.ts`: `buildCatalogModernProject({ seed: "revamp" })` → productos = demo (50), motion del hero = layer-stack, contiene secciones faq/stats tras el paso de repository (en repository.test.ts).
- `repository.test.ts` (fake-indexeddb): `ensureRevampDemoProject()` crea una vez e idempotente; las secciones faq/stats validan contra `StoreProjectV2Schema`.
- `modules`/`exporter`: render del proyecto revamp incluye `data-solara-module="catalog-faq"` y `catalog-stats`; settings parsean con los settingsSchema de los módulos.

- [ ] **Step 6: Verificar**

Run: `corepack pnpm --filter @solara/project-schema test`, `--filter @solara/modules test`, `--filter @solara/exporter test`, `--filter @solara/studio test`, `--filter @solara/studio typecheck`
Expected: PASS. Budgets y `format:check`/`git diff --check` limpios.

- [ ] **Step 7: Commits** (2 commits sugeridos)

```bash
git add packages/modules/src/catalog-modern.ts packages/modules/src/styles.ts packages/modules/src/index.test.ts packages/storefront-runtime/src/index.ts packages/storefront-runtime/src/index.test.ts
git commit -m "Agrega módulos FAQ y stats con su runtime"

git add packages/project-schema/src/catalog-modern-template.ts packages/project-schema/src/catalog-modern-template.test.ts apps/studio/src/lib/repository.ts apps/studio/src/lib/repository.test.ts apps/studio/src/App.tsx
git commit -m "Crea la tienda candidata Predeterminado Revamp"
```

---

### Task 2B: Specs de budgets y E2E

**Files:**
- Modify: `tests/e2e/catalog-modern.spec.ts` (o archivo nuevo `tests/e2e/revamp-motion.spec.ts`)
- Modify: `tests/e2e/scale-store.spec.ts` si aplica (no: solo catalog-modern)
- (Sin cambios de scripts salvo verificación)

**Interfaces:**
- Consumes: capability `micro` (1A), módulos FAQ/stats y candidata (2A), CSS de efectos (1B).
- Produces: specs que se ejecutan en la ola 3.

- [ ] **Step 1: Spec E2E de movimiento**

Nuevo `tests/e2e/revamp-motion.spec.ts` (patrón de servidor de los specs existentes, `studioUrl`):

1. **FAQ**: abrir "Predeterminado Revamp" → ir a la home → `[data-faq-root] details` — abrir el primero (click) → `open === true`; abrir el segundo → el primero queda cerrado (exclusividad); teclado: tab hasta el summary + Enter abre.
2. **Stats**: los `[data-stat-value]` muestran los targets finales (esperar animación; `toHaveText("50")` etc. según el fixture de la candidata).
3. **Presets**: `[data-motion-root][data-motion-preset="layer-stack"]` existe en la home de la candidata; con `prefers-reduced-motion` (emular via `page.emulateMedia({ reducedMotion: "reduce" })`) el contenido es visible sin animaciones (`data-motion-visible="true"` presente tras el scroll).
4. **No-JS**: `page.goto` con `javaScriptEnabled: false` → home renderiza (título, grid, FAQ `<details>` sin JS) sin errores.
5. **Matriz**: viewports 390/768/1024/1440 → sin overflow horizontal en home y producto (`document.documentElement.scrollWidth <= clientWidth`).
6. **Tilt/magnetic**: `pointer: fine` emulado → mover el mouse sobre `[data-product-card]` → `--rx/--ry` cambian; `[data-magnetic]` → `--mx/--my` cambian. (Si Playwright no emula `hover:hover` fácil, usar `page.mouse.move` con viewport desktop default.)

- [ ] **Step 2: Verificar sintaxis**

Run: `corepack pnpm exec playwright test --list tests/e2e/revamp-motion.spec.ts`
Expected: PASS (solo listado; ejecución en 3E).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/revamp-motion.spec.ts
git commit -m "Agrega recorridos E2E de la nueva capa de movimiento"
```

---

### Task 3E: Gate, changelog y ejecutables

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Gate completo**

Run:
```
corepack pnpm check
corepack pnpm build
corepack pnpm check:budgets
corepack pnpm benchmark:export
corepack pnpm test:e2e
```
Expected: PASS en todos (incluye revamp-motion.spec.ts). Registrar: JS runtime raw (esperado ≤ 50 KiB), CSS runtime raw (≤ 7.5 KiB), storefront.css (≤ 780 KiB), benchmark ms.

- [ ] **Step 2: Changelog**

Entrada `### Revamp de movimiento (2026-08-07)`: presets zoom-in/blur-in, capability micro (tilt/magnetic/spotlight/parallax/back-to-top/kinetic, desktop y reduced-motion), efectos de hover y ambientales (noise, marquee, shimmer, pulse, scrollbar custom), scroll-reveal con CSS scroll-driven, módulos FAQ y stats, tienda candidata "Predeterminado Revamp" (comparar en el dashboard; la actual no cambia de contenido). Mencionar budgets finales.

- [ ] **Step 3: Ejecutables**

`corepack pnpm desktop:build`, `desktop:package`, `portable:smoke` — reconstruidos.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "Documenta el revamp de movimiento y cierra el gate"
```

---

## Self-review

- **Cobertura del spec:** todos los puntos del catálogo A-D + módulos + candidata tienen tarea (1A: presets/micro; 1B: A+C; 2A: candidata+FAQ/stats; 2B: E2E; 3E: gate). Sin placeholders: valores exactos por efecto en 1B y código completo en 1A/2A.
- **Consistencia:** los atributos que emiten los módulos (1B) son los que consume el runtime (1A): `data-magnetic`, `data-product-card`, `data-hero-parallax`/`data-parallax-layer`/`data-parallax-depth`, `data-kinetic-title`, `data-back-to-top`/`data-back-to-top-ring`, `data-faq-root`, `data-stat-value`/`data-stat-target`. El contrato se fija aquí; 1A y 1B son paralelos pero disjuntos (runtime vs modules) y el contrato de atributos está en este plan.
- **Paralelismo:** Ola 1: 1A (project-schema + storefront-runtime) ∥ 1B (modules) — disjuntos. Ola 2: 2A (project-schema/modules/repository/App) ∥ 2B (tests/e2e) — 2B escribe specs contra el contrato del plan; se ejecutan en 3E. Ola 3: cierre.
- **Budgets:** el límite real es JS runtime (44.8 → ~49-50 ≤ 52); CSS runtime +~0.7 (7.3 ≤ 8); storefront.css holgado.
