# Revisión de Bugfixes 2026-08-09 — Implementation Plan

> **Para agentes:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan task por task. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Goal:** Corregir los defectos de código abiertos documentados en la revisión profunda (reportes `.superpowers/sdd/` y `docs/TECHNICAL_DEBT.md`), con test primero y gates completos al cierre.

**Architecture:** Ocho tareas de fix independientes ordenadas por riesgo (storefront → exporter → storage → editor) y una tarea de cierre. Cada fix toca un paquete o archivo acotado, con su prueba que falla primero; las tareas 1–2 son las únicas que tocan salida pública (runtime serializado y HTML), por lo que exigen también E2E.

**Tech Stack:** Node 22+ (release), pnpm 10.15.1 vía `corepack`, Vitest 3.2.4, Playwright Chromium, Node `fs` nativo (storage, sin dependencias), Dexie/fake-indexeddb (tests de Studio).

## Global Constraints

- No modificar `StoreProjectV2Schema` ni `schemaVersion: 2` (contrato persistido).
- No agregar dependencias de runtime.
- El preview y el sitio público deben usar el mismo renderer de `@solara/exporter` (un cambio de HTML afecta a ambos; el budget test `scripts/public-storefront-budget.test.ts` exige que production conserve el preload LCP).
- El runtime público es un string serializado: sus reglas CSS viven en `packages/storefront-runtime/src/index.ts`; el budget JS es ≤ 52 KiB (medido ~46.7 KiB).
- El servidor local conserva obligatoriamente: validación de rutas relativas, `409` de conflicto, lock por tienda, manifest atómico con rename y el hook `writeGuard` (sólo tests).
- `solara-request-handler.mjs` es compartido por HTTP y Electron: no cambiar el contrato de respuestas.
- Gates: por task `corepack pnpm --filter <paquete> test` + `typecheck`; al cerrar, `corepack pnpm check`, `corepack pnpm build`, `corepack pnpm check:budgets`, `corepack pnpm benchmark:export`, `corepack pnpm test:e2e`, `git diff --check`, `corepack pnpm check:repository`; si cambia la app, reconstruir ejecutables (`desktop:build`, `desktop:package`, `portable:smoke`).
- Commits breves en español, uno por task, `git add` de archivos explícitos; reportes de trabajo nunca al commit.
- No usar caracteres problemáticos en comentarios: verificar con grep de U+FFFD antes de commitear cualquier archivo con acentos.
- Windows + PowerShell: comandos con `corepack pnpm ...`; no usar `rg` (usar `Select-String`) ni bash.

---

### Task 1: `fill-mode: backwards` en presets de entrada del storefront (A1)

Defecto: los presets de entrada animan con `both` (índices ~1366–1396 de `packages/storefront-runtime/src/index.ts`); al terminar, el keyframe final congelado pisa los hovers de las zonas animadas. Los presets scroll-driven (`parallax` 1398, `scroll-progress` 1405) conservan `both` por diseño.

**Files:**
- Modify: `packages/storefront-runtime/src/index.ts:1366-1396`
- Test: `packages/storefront-runtime/src/index.test.ts`

**Interfaces:**
- Consumes: `STORE_RUNTIME_SERIALIZED` (o la exportación que expone index.test.ts; verificar su nombre real al implementar).
- Produces: ningún cambio de API; el string serializado contiene `both` sólo en los presets scroll-driven.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `packages/storefront-runtime/src/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("fill-mode de los presets de motion", () => {
  const runtime = /* la exportación serializada que ya usa index.test.ts */;

  it("los presets de entrada usan backwards y no congelan el hover", () => {
    for (const preset of ["fade", "fade-up", "slide", "scale", "stagger"]) {
      const rule = runtime.match(
        new RegExp(
          `\\[data-motion-root\\][^\\n]*data-motion-preset="${preset}"[^\\n]*\\n[^\\n]*animation:[^\\n]*`,
        ),
      );
      expect(rule?.[0], `preset ${preset}`).toMatch(/backwards/);
    }
  });

  it("los presets scroll-driven conservan both", () => {
    expect(runtime.match(/solara-parallax linear both/)?.[0]).toBeTruthy();
    expect(runtime.match(/solara-progress linear both/)?.[0]).toBeTruthy();
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `corepack pnpm --filter @solara/storefront-runtime test`
Expected: FAIL — las reglas de entrada contienen `both`, no `backwards`.

- [ ] **Step 3: Implementar el fix**

En `packages/storefront-runtime/src/index.ts`, cambiar el literal ` both` → ` backwards` SOLO en las 5 reglas de entrada (fade, fade-up, slide, scale y la regla de stagger). No tocar las reglas `@supports (animation-timeline: view())` (parallax/progress conservan ` both`). Reemplazo exacto sugerido (5 ocurrencias): `var(--motion-delay, 0ms) both` → `var(--motion-delay, 0ms) backwards`, y en la regla de stagger `... var(--motion-easing, ...) both` → `... backwards` (verificar las cadenas exactas al editar; la regla de stagger no tiene delay en el shorthand).

- [ ] **Step 4: Ejecutar los tests del paquete**

Run: `corepack pnpm --filter @solara/storefront-runtime test`
Expected: PASS (incluye el nuevo describe y los tests existentes de serialización/búsqueda).

- [ ] **Step 5: E2E: el hover funciona después del reveal**

En `tests/e2e/editor-motion.spec.ts`, agregar un test que: abra el preview de una página con preset de entrada (usar el patrón del spec existente), espere el reveal (`data-motion-visible="true"`), coloque el puntero sobre una zona animada con hover definido en CSS del módulo (p. ej. una card de producto o un botón con `.product-card:hover`) y verifique el cambio de estilo computado (o que el elemento siga bajo el puntero con `hover` activo vía `page.hover` sin excepción de estabilidad). Si el spec existente no tiene una página con preset de entrada + hover, verificar la fixture `catalogModernStore` y elegir el selector real; documentar el selector en el reporte.

Run: `corepack pnpm exec playwright test tests/e2e/editor-motion.spec.ts`
Expected: GREEN (el test nuevo valida que el hover no queda muerto; antes del fix, `page.hover` seguido de aserción de `:hover` calculado falla — verificar este orden en la implementación).

- [ ] **Step 6: Budget de runtime**

Run: `corepack pnpm exec vitest run scripts/public-storefront-budget.test.ts`
Expected: PASS (el JS sigue ≤ 52 KiB; el cambio es de 4 bytes por regla).

- [ ] **Step 7: Commit**

```bash
git add packages/storefront-runtime/src/index.ts packages/storefront-runtime/src/index.test.ts tests/e2e/editor-motion.spec.ts
git commit -m "Usa fill-mode backwards en los presets de entrada del storefront"
```

---

### Task 2: El preview no emite el preload LCP absoluto (A12)

Defecto: `renderPreviewHtml` emite `<link rel="preload" as="image" href="{dominio}/…">` absoluto (`packages/exporter/src/index.ts:1111-1115`); el iframe del preview (srcDoc) dispara una petición real al dominio del sitio, que en pruebas no existe. El Studio lo mitiga con `stripPreviewLcpPreload` (`apps/studio/src/features/Preview.tsx:56-64,271`); el fix canónico va al exporter.

**Files:**
- Modify: `packages/exporter/src/index.ts:1111-1115`
- Modify: `apps/studio/src/features/Preview.tsx` (remover la mitigación)
- Test: `packages/exporter/src/index.test.ts` (o el archivo de tests del exporter que exista; verificar)

**Interfaces:**
- Consumes: `renderPreviewHtml(project, mode, route, options)` — ya acepta `{ assetTransport: "parent" | "self" }`.
- Produces: con `assetTransport: "parent"` el HTML NO contiene `rel="preload" as="image"`; con `mode: "production"` lo conserva absoluto.

- [ ] **Step 1: Escribir el test que falla**

En el archivo de tests del exporter (verificar cuál usa; si no existe, crear `packages/exporter/src/preview.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { renderPreviewHtml } from "./index";
import { catalogModernStore } from "@solara/project-schema/src/catalog-modern-fixture";

describe("renderPreviewHtml sin preload absoluto", () => {
  it("no emite preload de imagen cuando el transporte es parent", () => {
    const html = renderPreviewHtml(catalogModernStore, "draft", "index", {
      assetTransport: "parent",
    });
    expect(html).not.toMatch(/rel="preload" as="image"/);
    expect(html).not.toMatch(/https?:\/\/[^"']+\/assets\//);
  });

  it("conserva el preload absoluto en producción", () => {
    const html = renderPreviewHtml(catalogModernStore, "production", "index", {});
    expect(html).toMatch(/rel="preload" as="image"/);
  });
});
```

Nota: verificar el path del import de la fixture (`catalogModernStore` vive en `packages/project-schema/src/catalog-modern-fixture.ts`) y los tipos exactos de `renderPreviewHtml` (tercer parámetro route y cuarto options) al implementar.

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `corepack pnpm --filter @solara/exporter test`
Expected: FAIL — el preload absoluto aparece también con transporte parent.

- [ ] **Step 3: Implementar el fix**

En `packages/exporter/src/index.ts`, condicionar la emisión del preload al modo/transporte: emitir sólo cuando `mode === "production"` (el transporte parent sólo se usa en preview). Si el valor `assetTransport` no está disponible en esa función, usar el parámetro `mode` existente (verificar la firma; `renderPreviewHtml` ya recibe `mode`). El bloque `aiContextLinks` ya condiciona por `mode === "production"` — seguir ese patrón.

- [ ] **Step 4: Remover la mitigación del Studio**

En `apps/studio/src/features/Preview.tsx`, eliminar `stripPreviewLcpPreload` (función 56-64 y su uso en 271) y verificar que ningún otro archivo la importe (grep `stripPreviewLcpPreload` en `apps/studio/src`).

- [ ] **Step 5: Tests del Studio + E2E**

Run: `corepack pnpm --filter @solara/studio test` — PASS (no debe quedar referencia a la función removida).
Run: `corepack pnpm exec playwright test tests/e2e/editor-preview.spec.ts` (o el spec de preview existente; verificar nombre) — GREEN (el preview sigue cargando sin 404 de preload; si hay un spec que aseraba el strip, actualizarlo).

- [ ] **Step 6: Budget test (production conserva el preload)**

Run: `corepack pnpm exec vitest run scripts/public-storefront-budget.test.ts`
Expected: PASS (la aserción `rel="preload" as="image"` en producción sigue verde).

- [ ] **Step 7: Commit**

```bash
git add packages/exporter/src/index.ts packages/exporter/src/preview.test.ts apps/studio/src/features/Preview.tsx tests/e2e/editor-preview.spec.ts
git commit -m "No emite el preload LCP absoluto en el preview del editor"
```

---

### Task 3: Variantes CSS completas del Tooltip (A13)

Defecto: `primitives.tsx` expone `position: "top" | "bottom" | "left" | "right"` pero `base/components.css` sólo define `--bottom`; `left`/`right` renderizan como `top`.

**Files:**
- Modify: `apps/studio/src/base/components.css:85-120` (bloque `.ui-tooltip`)
- Modify: `tests/e2e/editor-a11y.spec.ts` (nueva aserción)

**Interfaces:**
- Consumes: `Tooltip`/`IconButton` de `apps/studio/src/components/primitives.tsx` (span `.ui-tooltip.ui-tooltip--<position>` con `data-tip`).
- Produces: cuatro variantes posicionales funcionales.

- [ ] **Step 1: Escribir el test E2E que falla**

En `tests/e2e/editor-a11y.spec.ts`, agregar un test: abrir el editor, hacer `page.hover` sobre el toggle de tema (`[data-testid="ui-theme-toggle"]`, que usa `position="bottom"` por B1), y asertar que aparece la burbuja `.ui-tooltip::after` visible (verificar `opacity: 1` vía `getComputedStyle` o clase); también asertar que el `title` nativo está presente (AT fallback). Antes del fix el test ya pasa para bottom — el objetivo es blindar la regresión del wiring; la parte de variantes se verifica por inspección: elegir un botón real con `position="top"` o `"left"` si existe en el editor (grep `position=` en Studio.tsx/Preview.tsx) y asertar que el tooltip aparece en el cuadrante esperado (comparar `getBoundingClientRect` del botón vs. la burbuja).

- [ ] **Step 2: Ejecutar para verificar el estado actual**

Run: `corepack pnpm exec playwright test tests/e2e/editor-a11y.spec.ts`
Expected: el test de bottom pasa; si se eligió una variante top/left, documentar si pasa o falla (según lo que haya en el editor).

- [ ] **Step 3: Implementar las variantes CSS**

En `apps/studio/src/base/components.css`, después de `.ui-tooltip--bottom::after` (línea ~112), agregar:

```css
.ui-tooltip--top::after {
  top: auto;
  bottom: calc(100% + 7px);
}

.ui-tooltip--left::after {
  left: auto;
  right: calc(100% + 7px);
  top: 50%;
  bottom: auto;
  transform: translateY(-50%) translateX(3px);
}

.ui-tooltip--right::after {
  left: calc(100% + 7px);
  top: 50%;
  bottom: auto;
  transform: translateY(-50%) translateX(-3px);
}
```

Ajustar el hover compartido (líneas ~117-120) para que `--left`/`--right` vuelvan a `translateY(-50%) translateX(0)`: reemplazar el bloque compartido por:

```css
.ui-tooltip:hover::after,
.ui-tooltip:focus-within::after {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.ui-tooltip--left:hover::after,
.ui-tooltip--left:focus-within::after,
.ui-tooltip--right:hover::after,
.ui-tooltip--right:focus-within::after {
  transform: translateY(-50%) translateX(0);
}
```

Verificar que no existan otras reglas `.ui-tooltip` fuera de `base/components.css` (grep en `editorial.css` — B1 movió geometría a wrappers `.ui-tooltip.editor-pane-close`; no romperlas).

- [ ] **Step 4: Verificar**

Run: `corepack pnpm --filter @solara/studio typecheck` — PASS.
Run: `corepack pnpm exec playwright test tests/e2e/editor-a11y.spec.ts tests/e2e/editor-console.spec.ts` — GREEN (el tooltip no rompe el flujo; las aserciones nuevas pasan).

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/base/components.css tests/e2e/editor-a11y.spec.ts
git commit -m "Completa las variantes posicionales del tooltip"
```

---

### Task 4: Los junctions/symlinks dentro de `proyectos/` son visibles en `list()` (A4)

Defecto: `list()` y `findManifest()` saltan por tipo de entrada (`entry.isDirectory()`) a los reparse points; un junction/symlink dentro de `proyectos/` no aparece en `list()` ni en `recovery`, sin señal para el usuario. `assertNoReparsePoints` sólo revisa la ruta destino, no el tipo de entrada (el dirent de un junction/symlink no es `isDirectory()`).

**Files:**
- Modify: `packages/exporter/scripts/local-project-storage.mjs` (`list()` ~279-300, `findManifest()` ~255-275)
- Test: `packages/exporter/src/local-project-storage.test.mjs`

**Interfaces:**
- Consumes: helpers del test (`projectJson()`, `siteMap([...])`, `upload`, `beginSave`, `commit`), `mkdtemp(join(tmpdir(), ...))`, `fs.symlink`.
- Produces: `list().recovery` incluye una entrada `{ message: /enlace simbólico|junction/i, folder }` para cada entrada de tipo symlink en `projectsRoot`.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final del `describe` de `local-project-storage.test.mjs`:

```js
it("reporta en recovery un junction/symlink dentro de proyectos/", async () => {
  const root = await mkdtemp(join(tmpdir(), "solara-storage-junction-"));
  try {
    const storage = createLocalProjectStorage({ applicationRoot: root });
    const outside = join(root, "fuera-de-proyectos");
    await mkdir(outside, { recursive: true });
    const projectsRoot = join(root, "proyectos");
    await mkdir(projectsRoot, { recursive: true });
    await symlink(outside, join(projectsRoot, "tienda-enlazada"), "junction");

    const listing = await storage.list();
    const report = listing.recovery.find((r) => r.folder === "tienda-enlazada");
    expect(report).toBeDefined();
    expect(report.message).toMatch(/enlace simbólico|junction/i);
    expect(listing.projects.some((p) => p.folder === "tienda-enlazada")).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

Importar `symlink` en el bloque de imports del archivo. Nota Windows: `fs.symlink(target, path, "junction")` no requiere elevación; en POSIX usar `"dir"` (condicional `process.platform === "win32" ? "junction" : "dir"`).

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `corepack pnpm --filter @solara/exporter test`
Expected: FAIL — el junction se salta silenciosamente (`recovery` no lo contiene).

- [ ] **Step 3: Implementar el fix**

En `local-project-storage.mjs`, en `list()` (y en `findManifest()` por coherencia), antes de `if (!entry.isDirectory()) continue;`, detectar symlinks:

```js
if (entry.isSymbolicLink()) {
  recovery.push({
    projectId: null,
    folder: entry.name,
    message:
      "La carpeta es un enlace simbólico o junction y no se usa como tienda.",
  });
  continue;
}
```

Verificar que `recovery` ya esté declarado antes de ese punto en `list()` (está al inicio del loop según el código actual) y que el mensaje sobreviva al serializado JSON del endpoint (los strings viajan sin escapes problemáticos; usar acentos con normalidad — el archivo ya los contiene).

- [ ] **Step 4: Ejecutar los tests del storage**

Run: `corepack pnpm --filter @solara/exporter test`
Expected: PASS (el nuevo test y los 16 existentes, incl. los de `writeGuard`).

- [ ] **Step 5: E2E de storage**

Run: `corepack pnpm exec playwright test tests/e2e/local-storage.spec.ts`
Expected: GREEN (el endpoint `/projects` sigue devolviendo la misma forma; el campo nuevo es aditivo).

- [ ] **Step 6: Commit**

```bash
git add packages/exporter/scripts/local-project-storage.mjs packages/exporter/src/local-project-storage.test.mjs
git commit -m "Reporta los junctions y symlinks dentro de proyectos/ en recovery"
```

---

### Task 5: `ready()` en el sentinel de migración Dexie (A17)

Caveat: `markProjectMigration`/`getProjectMigration` (`apps/studio/src/lib/repository.ts:421-433`) no llaman `await ready()`, a diferencia del resto del módulo (p. ej. `clearRecoveryDraft`). Con Dexie la apertura es lazy; la llamada directa funciona pero es frágil si se añaden transacciones.

**Files:**
- Modify: `apps/studio/src/lib/repository.ts:421-433`
- Test: `apps/studio/src/lib/repository.test.ts:313-323` (existe y cubre el comportamiento)

**Interfaces:**
- Consumes: `ready()` ya definido en `repository.ts`.
- Produces: sin cambios de firma; ambas funciones se ejecutan tras `ready()`.

- [ ] **Step 1: Implementar (el test de comportamiento ya existe)**

Agregar `await ready();` como primera sentencia de `markProjectMigration` y de `getProjectMigration`.

- [ ] **Step 2: Verificar**

Run: `corepack pnpm --filter @solara/studio test` — PASS (incluye `repository.test.ts:313-323`).
Run: `corepack pnpm --filter @solara/studio typecheck` — PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/lib/repository.ts
git commit -m "Espera la apertura de Dexie en el sentinel de migración"
```

---

### Task 6: La barra de estado refresca la última exportación al volver al editor (A14)

Defecto aceptado en el informe B2: el valor se calcula por render; si el usuario exporta y permanece en la pestaña Exportar, el tiempo queda viejo hasta el próximo render.

**Files:**
- Create: `apps/studio/src/lib/statusBar.ts`
- Create: `apps/studio/src/lib/statusBar.test.ts`
- Modify: `apps/studio/src/features/Studio.tsx` (líneas del footer/statusbar ~783-795)

**Interfaces:**
- Consumes: `readExportHistory(slug)` de `apps/studio/src/lib/exportHistory.ts` (ya existente: `Array<{ at: string; mode: "draft" | "production" }>`), y el `LocalSaveReceipt` o el valor `lastExportedAt` que ya muestra la barra (verificar el nombre real de la prop en Studio.tsx).
- Produces: `formatLastExportLabel(entries, receiptAt: string | null | undefined, nowIso: string): string` — función pura que devuelve el rótulo: recibo de disco si `receiptAt` existe, sino el `at` del último entry si es reciente (≤ 30 días), sino `"—"`.

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, expect, it } from "vitest";
import { formatLastExportLabel } from "./statusBar";

describe("formatLastExportLabel", () => {
  const NOW = "2026-08-09T15:00:00.000Z";

  it("prioriza el recibo de disco", () => {
    const entries = [{ at: "2026-08-09T12:00:00.000Z", mode: "production" as const }];
    expect(formatLastExportLabel(entries, "2026-08-09T14:00:00.000Z", NOW)).toContain("14:00");
  });

  it("cae al historial del navegador cuando no hay recibo", () => {
    const entries = [{ at: "2026-08-09T12:00:00.000Z", mode: "draft" as const }];
    expect(formatLastExportLabel(entries, null, NOW)).toContain("12:00");
  });

  it("devuelve — sin historial", () => {
    expect(formatLastExportLabel([], null, NOW)).toBe("—");
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `corepack pnpm --filter @solara/studio test`
Expected: FAIL — `formatLastExportLabel` no existe (import falla).

- [ ] **Step 3: Implementar**

`apps/studio/src/lib/statusBar.ts`:

```ts
import { readExportHistory } from "./exportHistory";

export function formatLastExportLabel(
  entries: ReturnType<typeof readExportHistory>,
  receiptAt: string | null | undefined,
  nowIso: string,
): string {
  if (receiptAt) return formatTime(receiptAt);
  const latest = entries.at(-1);
  if (!latest) return "—";
  const ageMs = Date.parse(nowIso) - Date.parse(latest.at);
  if (Number.isNaN(ageMs) || ageMs < 0 || ageMs > 30 * 24 * 60 * 60 * 1000) return "—";
  return formatTime(latest.at);
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
```

- [ ] **Step 4: Conectar en Studio.tsx**

En `Studio.tsx`: agregar un estado `exportTick` y un `useEffect` que escuche `window.addEventListener("focus", ...)` y `document.visibilitychange` para incrementar `exportTick` (fuerza re-render al volver a la ventana); calcular el rótulo con `formatLastExportLabel(readExportHistory(project.slug), receiptAt, new Date().toISOString())` en el render del statusbar (usando `exportTick` en las dependencias o una const derivada). Mantener el texto exacto actual de la barra ("Última exportación: …") y el testid `ui-status-bar`.

- [ ] **Step 5: Verificar**

Run: `corepack pnpm --filter @solara/studio test` — PASS (los 3 tests nuevos + suite).
Run: `corepack pnpm --filter @solara/studio typecheck` — PASS.
Run: `corepack pnpm exec playwright test tests/e2e/editor-shell.spec.ts tests/e2e/editor-export.spec.ts` (si existe el segundo; verificar) — GREEN.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/lib/statusBar.ts apps/studio/src/lib/statusBar.test.ts apps/studio/src/features/Studio.tsx
git commit -m "Refresca la última exportación de la barra de estado al volver a la ventana"
```

---

### Task 7: Comentarios del budget test actualizados y libres de mojibake (A15/B23)

El comentario en `scripts/public-storefront-budget.test.ts:17-18` cita mediciones antiguas (storefront.css 634.124 B, storefront.js 41.475 B); hoy el css deduplicado es ~75 KB y el JS ~46.7 KiB. Además, el gate anti-U+FFFD exige archivos limpios.

**Files:**
- Modify: `scripts/public-storefront-budget.test.ts:17-18`

- [ ] **Step 1: Verificar el estado del archivo a nivel de bytes**

Run (PowerShell): `Select-String -Path scripts/public-storefront-budget.test.ts -Pattern ([char]0xFFFD)`
Expected: sin coincidencias (si las hay, el archivo está corrupto y hay que reescribir TODO el archivo con `write` en UTF-8, no sólo el comentario).

- [ ] **Step 2: Reemplazar el comentario**

En las líneas 17-18, reemplazar por:

```ts
  // Mediciones reales al 2026-08-09 (bytes crudos tras dedupe y rollback):
  // storefront.css ≈ 75.132 B, storefront.js ≈ 46.731 B. Topes con margen;
  // el css incluye los estilos generados por página del sitio exportado.
```

- [ ] **Step 3: Verificar**

Run: `corepack pnpm exec vitest run scripts/public-storefront-budget.test.ts` — PASS.
Run: `Select-String -Path scripts/public-storefront-budget.test.ts -Pattern ([char]0xFFFD)` — sin coincidencias.
Run: `corepack pnpm format:check` — PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/public-storefront-budget.test.ts
git commit -m "Actualiza las mediciones del budget público tras el dedupe"
```

---

### Task 8: Sin archivos huérfanos en `actual/` si falla el manifest (B7)

Caveat documentado: si `write-manifest` falla (writeGuard), `commit()` ya copió el `.solara.json` nuevo a `actual/` pero el manifest sigue apuntando a la versión anterior; el archivo queda huérfano hasta el próximo guardado.

**Files:**
- Modify: `packages/exporter/scripts/local-project-storage.mjs` (`commit()`, bloque `before-manifest` ~533-538)
- Test: `packages/exporter/src/local-project-storage.test.mjs`

**Interfaces:**
- Consumes: `writeGuard` (ops `write-manifest` ya cubierta), helpers `projectJson()`, `upload`, `beginSave`, `commit`, `abort`.
- Produces: tras un `commit` rechazado por `write-manifest`, `actual/` no contiene ningún `.solara.json` de la transacción fallida (el archivo huérfano se elimina y se re-lanza el error).

- [ ] **Step 1: Escribir el test que falla**

Agregar al final del `describe` de `local-project-storage.test.mjs`:

```js
it("no deja un respaldo huérfano en actual/ si falla el manifest", async () => {
  const root = await mkdtemp(join(tmpdir(), "solara-storage-orphan-"));
  try {
    let fail = false;
    const storage = createLocalProjectStorage({
      applicationRoot: root,
      writeGuard: async ({ op }) => {
        if (fail && op === "write-manifest") {
          const error = new Error("escritura rechazada: write-manifest");
          error.code = "ENOSPC";
          throw error;
        }
      },
    });
    const attempt = await storage.beginSave({
      projectId,
      name: "Prueba",
      slug: "prueba",
      projectUpdatedAt: "2026-08-07T10:00:00.000Z",
      expectedVersion: null,
    });
    await upload(storage, attempt.transactionId, "project", projectJson());
    fail = true;
    await expect(storage.commit(attempt.transactionId)).rejects.toThrow(/escritura rechazada/i);

    const actualRoot = join(root, "proyectos", "prueba", "actual");
    const orphans = await readdir(actualRoot);
    expect(orphans.filter((name) => name.endsWith(".solara.json"))).toEqual([]);
    await storage.abort(attempt.transactionId);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

Nota: verificar el nombre real de la carpeta de la tienda en el storage (`folder` se deriva del slug en `beginSave`; usar el mismo patrón que los tests existentes de `write-manifest` en la línea ~378 — pueden usar `join(root, "proyectos", "prueba", "actual")` o el helper que usen; copiar el patrón del test "simula disco lleno").

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `corepack pnpm --filter @solara/exporter test`
Expected: FAIL — `orphans` contiene el `.solara.json` de la transacción fallida.

- [ ] **Step 3: Implementar el fix**

En `commit()`, envolver el bloque `before-manifest` (guardWrite + writeJsonAtomic) en try/catch que elimine `archivePath` (sólo si existe) y re-lance:

```js
try {
  await checkpoint("before-manifest");
  await guardWrite("write-manifest", join(storeRoot, "manifest.json"));
  await writeJsonAtomic(join(storeRoot, "manifest.json"), manifest);
} catch (error) {
  await rm(archivePath, { force: true });
  throw error;
}
```

- [ ] **Step 4: Ejecutar los tests del storage**

Run: `corepack pnpm --filter @solara/exporter test`
Expected: PASS (el test nuevo y los 17 existentes).

- [ ] **Step 5: E2E de storage**

Run: `corepack pnpm exec playwright test tests/e2e/local-storage.spec.ts`
Expected: GREEN.

- [ ] **Step 6: Commit**

```bash
git add packages/exporter/scripts/local-project-storage.mjs packages/exporter/src/local-project-storage.test.mjs
git commit -m "Elimina el respaldo huérfano de actual/ cuando falla el manifest"
```

---

### Task 9: Cierre — deuda documentada, CHANGELOG, gates y publicación

**Files:**
- Modify: `docs/TECHNICAL_DEBT.md` (filas A1, A4, A13, A14, A15, A17, B7 → cerradas o actualizadas)
- Modify: `CHANGELOG.md` (entrada "Revisión de bugfixes (2026-08-09)")
- Modify (si aplica): `HANDOFF.md` (nota de cierre)

- [ ] **Step 1: Actualizar `docs/TECHNICAL_DEBT.md`**

Cerrar/marcar resueltas las filas correspondientes a las Tasks 1-8 (fill-mode, junctions, tooltip, status bar, comentario budget, ready() Dexie, huérfano de manifest) con referencia a la tarea o commit. Mantener abiertas: fflate/legacy-zip (release), matriz OS (job release), sandbox Electron (revisar al actualizar), Node 22 vs 24, checkout WhatsApp, publicación manual, 409 sin auto-merge.

- [ ] **Step 2: Agregar entrada al CHANGELOG**

Formato Keep a Changelog, en español, bajo `[Unreleased]`:

```markdown
### Revisión de bugfixes (2026-08-09)

- El storefront usa `fill-mode: backwards` en los presets de entrada: los
  hovers de las zonas animadas vuelven a funcionar al terminar el reveal
  (los presets scroll-driven conservan `both`).
- El preview del editor ya no emite el preload LCP absoluto del dominio;
  la mitigación `stripPreviewLcpPreload` del Studio se eliminó (el sitio
  público conserva el preload).
- El tooltip del editor tiene las cuatro variantes posicionales.
- Los junctions y symlinks dentro de `proyectos/` se reportan en recovery.
- El sentinel de migración espera la apertura de Dexie.
- La barra de estado refresca la última exportación al volver a la ventana.
- Sin respaldos huérfanos en `actual/` cuando falla la escritura del manifest.
- Mediciones del budget público actualizadas.
```

- [ ] **Step 3: Gates completos**

```bash
corepack pnpm check
corepack pnpm build
corepack pnpm check:budgets
corepack pnpm benchmark:export
corepack pnpm test:e2e
git diff --check
corepack pnpm check:repository
```

Todos PASS. Si Studio o el shell cambiaron (Tasks 2, 3, 6), reconstruir:
`corepack pnpm desktop:build`, `corepack pnpm desktop:package`, `corepack pnpm portable:smoke` (smoke OK).

- [ ] **Step 4: Commit y push**

```bash
git add docs/TECHNICAL_DEBT.md CHANGELOG.md HANDOFF.md
git commit -m "Documenta el cierre de la revisión de bugfixes"
git push origin main
```

- [ ] **Step 5: Verificación final**

`git log --oneline -12` (commits en orden), `git status --porcelain` vacío salvo reportes ignorados.

---

## Self-Review (completado por el autor del plan)

- **Cobertura:** A1→T1, A12→T2, A13→T3, A4→T4, A17→T5, A14→T6, A15/B23→T7, B7→T8, cierre→T9. A2/A3/A10/A6/A7/A8/A9/A11/A19 quedan fuera por ser jobs de release, decisiones de producto o dependencias de actualización — documentadas en T9 como fuera de alcance. A16 (distinctive de dedupe) se documenta, no se toca (cambio de riesgo sin beneficio).
- **Placeholders:** revisados; los pasos de "verificar el nombre real" indican explícitamente qué buscar y qué hacer si difiere.
- **Consistencia de tipos:** `readExportHistory` (existente) y `formatLastExportLabel` (nuevo) usan el mismo tipo de entrada; `renderPreviewHtml` conserva su firma; `writeGuard` ops ya existentes.
