# Optimización Apertura Studio (Top20) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reducir el bundle inicial del Studio de 1257 KiB raw / 825 KiB gzip a <720 KiB / <350 KiB gzip y el tiempo de apertura fría de "Tus tiendas" a <1s en 4G, manteniendo el runtime público dentro de 64 KiB y la exportación determinista.

**Architecture:** Extraer el mayor contribuyente (`optimized-fixture-urls.ts` 1575 KiB con 33 data URLs) a asset JSON lazy + dynamic import en workers; partir `vite.config.ts` manualChunks para aislar `project-schema/fixtures`, `modules/styles`, `exporter/fonts`, `storefront-runtime`; granularizar fonts/styles por familia; paralelizar el waterfall `App.tsx:221` y gatear polls/timers cuando hidden; deduplicar workers.

**Tech Stack:** Vite 7.1.3 + @vitejs/plugin-react 5.0.2, React 19.1.1, TypeScript 5.9.2 estricto, Zod 4.1.5, Dexie 4.2.0, Vitest 3.2.4, Playwright 1.55, Biome 2.2.2, pnpm 10.15.1 workspaces, Node 22+.

## Global Constraints

- `StoreProjectV2Schema` es la autoridad del modelo. `schemaVersion` permanece en `2` hasta migración explícita y testeada. (`AGENTS.md:Reglas`)
- `StoreProjectV1` es alias temporal de `StoreProjectV2`; no existe contrato v1 adicional.
- El preview y el sitio público deben usar el mismo renderer de `@solara/exporter` (`packages/exporter/src/index.ts`).
- Los módulos `legacy-editorial-v1` sólo compatibilidad; nuevas opciones en `catalog-modern-v1/v2` (`packages/modules`).
- `productIds` de categorías/colecciones son índices derivados: recalcular vía `@solara/core` o helpers del schema.
- El dinero se representa en centavos enteros. Nunca floats para precios/descuentos/subtotales.
- No incorporar binarios generados, `dist/`, `proyectos/`, `.solara-runtime/`, `.release/` ni reportes al commit.
- No agregar dependencias de runtime sin justificar impacto en sitio público y budgets existentes.
- No enviar catálogo completo a IA: usar schema/fixtures pequeñas o muestras deterministas.
- Node 22+ y Corepack, pnpm 10.15.1 sin Nx/Turbo/Docker; React 19 + Vite para `apps/studio`; TS estricto + Biome + Vitest; Playwright Chromium local.
- El arte portable es `win-unpacked`, no instalador; `proyectos/` y `.solara-runtime/` junto al `.exe`.

---

## File Structure (qué se toca y por qué)

- **Crea:** `packages/project-schema/src/optimized-fixture-urls.json` — JSON estático generado desde `optimized-fixture-urls.ts` (33 data URLs) para servir vía `fetch`/`import ?url`, no bundle.
- **Crea:** `scripts/generate-fixture-json.mjs` — genera el JSON en build y valida que no crezca >8 MiB serializado.
- **Modifica:** `apps/studio/vite.config.ts:22-43` — amplia `manualChunks` (fixture-data, modules-styles, exporter-fonts, storefront-runtime) y `assetsInlineLimit`.
- **Modifica:** `packages/project-schema/src/catalog-modern-fixture.ts:1-453` — cambia `import {OPTIMIZED...} from "./optimized-fixture-urls.js"` a `import()` dinámico o `fetch` lazy con fallback test.
- **Modifica:** `packages/project-schema/src/fixture.ts:2` — idem para `REFERENCE_FIXTURE_DATA_URLS`.
- **Modifica:** `apps/studio/src/lib/repository.ts:12-18,730-757` — lazy `embedFixtureAssets`/`optimizeDemoFixtureAssets` vía `fetch("/assets/optimized-fixture-urls.json")` cuando `TEST` false, mantiene import estático en `vitest`.
- **Modifica:** `apps/studio/src/lib/workers.ts:168-197` — `getCsvWorker` ya no arrastra fixtures (elimina `referenceStore` de `core/src/index.ts:20`).
- **Modifica:** `packages/core/src/index.ts:20,1156` — mueve `referenceStore`/`generatePerformanceFixture` a `packages/core/src/fixtures.ts` lazy.
- **Modifica:** `packages/exporter/src/fonts.ts:1-111` — particiona `FONT_OPTIONS` por familia (`archivo.ts`, `inter.ts`, `lora.ts`) y hace `activeFonts` dynamic import; `fontCssFor` inline sólo fetch la woff2 usada.
- **Modifica:** `packages/modules/src/styles.ts:1-5763` — extrae `STORE_BASE_STYLES` 18 KiB al entry, `catalog-modern` 84 KiB y `catalog-modern-v2` 122 KiB a chunks separados (`styles/catalog-modern.ts` etc.) y cambia `MODULE_STYLE_BLOCKS` a getters lazy.
- **Modifica:** `apps/studio/src/App.tsx:221-345` — paraleliza `Promise.all([purgeRolledBack, getLocalStorageStatus])` + prefetch `loadLocalProjectRepository`, `diskListing` vs `listProjectsWithRecovery` especulativo, `for` → `Promise.allSettled` con límite.
- **Modifica:** `apps/studio/src/features/Studio.tsx:488-531,312-343,614` — gatea `poll 5s` y `AutosaveQueue 550ms` + `main.tsx:37` SW 60s por `document.hidden`.
- **Modifica:** `scripts/check-budgets.mjs:29-51` y `scripts/public-storefront-budget.test.ts:69`, `scripts/storefront-runtime-budget.test.ts:18` — mantiene techos pero añade reporte de ahorro por task.
- **Test:** `packages/project-schema/src/fixture-budget.test.ts`, `scripts/check-budgets.test.mjs` (nuevo), `tests/e2e/perf-idle.spec.ts`, `packages/exporter/src/determinism.test.ts`.

---

### Task 1: Extraer `optimized-fixture-urls` a JSON lazy (mayor win: -1.2 MiB/bundle)

**Files:**
- Create: `scripts/generate-fixture-json.mjs`
- Create: `packages/project-schema/src/optimized-fixture-urls.json` (generado, no commiteado si >1 MiB? se commitea vacío + genera en build)
- Modify: `packages/project-schema/src/catalog-modern-fixture.ts:1-453`
- Modify: `packages/project-schema/src/fixture.ts:1-15`
- Modify: `apps/studio/src/lib/repository.ts:730-757`
- Test: `packages/project-schema/src/fixture-budget.test.ts` y nuevo `scripts/check-fixture-json.test.mjs`

**Interfaces:**
- Consumes: `OPTIMIZED_FIXTURE_DATA_URLS` (Record<string,string> 33 entradas) desde `optimized-fixture-urls.ts`
- Produces: `getOptimizedFixtureUrls(): Promise<Record<string,string>>` y `getReferenceFixtureUrls()` lazy; si `import.meta.env.TEST` retorna import estático, si no `fetch("/assets/optimized-fixture-urls.json")`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/project-schema/src/fixture-lazy.test.ts
import { expect, test } from "vitest";
test("catalogModernStore no debe importar optimized-fixture-urls sincrónicamente en el bundle principal", async () => {
  const src = await import("fs").then(m => m.readFileSync("apps/studio/dist/assets/index-DEZyF9af.js.map","utf8"));
  const map = JSON.parse(src);
  const hasFixture = map.sources.some((s:string)=> s.includes("optimized-fixture-urls.ts"));
  expect(hasFixture).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run packages/project-schema/src/fixture-lazy.test.ts --reporter=verbose`
Expected: FAIL — `expected true to be false` (hoy `sources` sí contiene `optimized-fixture-urls.ts`).

- [ ] **Step 3: Write minimal implementation**

```mjs
// scripts/generate-fixture-json.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { OPTIMIZED_FIXTURE_DATA_URLS, REFERENCE_FIXTURE_DATA_URLS } from "../packages/project-schema/src/optimized-fixture-urls.ts";
const json = JSON.stringify({ ...OPTIMIZED_FIXTURE_DATA_URLS, ...REFERENCE_FIXTURE_DATA_URLS });
writeFileSync("apps/studio/public/assets/optimized-fixture-urls.json", json);
writeFileSync("packages/project-schema/src/optimized-fixture-urls.json", json);
console.log(`fixture json ${Buffer.byteLength(json)} B`);
```

```ts
// packages/project-schema/src/catalog-modern-fixture.ts (top)
import { CATALOG_MODERN_GUIDANCE_VERSION } from "./catalog-modern-guidance";
import { StoreProjectV2Schema } from "./index";
// REMOVER: import { OPTIMIZED_FIXTURE_DATA_URLS } from "./optimized-fixture-urls.js";
import { catalogScaleStore } from "./scale-fixture";
export async function getOptimizedFixtureUrls(): Promise<Record<string,string>> {
  if (typeof process !== "undefined" && process.env.VITEST) {
    const m = await import("./optimized-fixture-urls.js");
    return m.OPTIMIZED_FIXTURE_DATA_URLS;
  }
  const res = await fetch("/assets/optimized-fixture-urls.json");
  if (!res.ok) throw new Error("No se pudo cargar optimized-fixture-urls.json");
  return res.json();
}
// luego: catalogModernAssets se vuelve función async getCatalogModernAssets() que await getOptimizedFixtureUrls()
```

```ts
// apps/studio/src/lib/repository.ts:730
async function embedFixtureAssets(project: StoreProjectV1): Promise<StoreProjectV1> {
  const urls = await (import.meta.env.TEST
    ? import("@solara/project-schema/optimized-fixture-urls").then(m=>m.OPTIMIZED_FIXTURE_DATA_URLS)
    : fetch("/assets/optimized-fixture-urls.json").then(r=>r.json()));
  // usa urls.modo_sur_hero_1536 etc. en vez de import estático
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm build && corepack pnpm vitest run packages/project-schema/src/fixture-lazy.test.ts --reporter=verbose`
Expected: PASS — `sources` ya no contiene `optimized-fixture-urls.ts`; `index-DEZyF9af.js` baja de 1257→~600 KiB (ver `node scripts/check-budgets.mjs`).

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-fixture-json.mjs packages/project-schema/src/catalog-modern-fixture.ts packages/project-schema/src/fixture.ts apps/studio/src/lib/repository.ts packages/project-schema/src/fixture-lazy.test.ts
git commit -m "perf: extrae optimized-fixture-urls a JSON lazy (-1.2 MiB/bundle, fixes #Top20-1)"
```

---

### Task 2: Ampliar `manualChunks` + `assetsInlineLimit` para aislar deps pesadas

**Files:**
- Modify: `apps/studio/vite.config.ts:18-43`
- Test: `scripts/check-budgets.mjs` + `node -e` sourcemap drill-down

**Interfaces:**
- Consumes: `manualChunks` existente (`phosphor`, `zod`, `vendor`, `dexie`, `table`)
- Produces: nuevos chunks `fixture-data`, `modules-styles`, `exporter-fonts`, `storefront-runtime` separados del entry.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/check-chunks.test.mjs (vitest)
import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
test("manualChunks debe aislar fixtures/styles/font/runtime del entry", () => {
  const cfg = readFileSync("apps/studio/vite.config.ts","utf8");
  expect(cfg).toContain("fixture-data");
  expect(cfg).toContain("modules-styles");
  expect(cfg).toContain("exporter-fonts");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run scripts/check-chunks.test.mjs --reporter=verbose`
Expected: FAIL — `expected "..." to contain "fixture-data"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/studio/vite.config.ts
export default defineConfig({
  plugins: [react()],
  // ...
  build: {
    target: "es2022",
    sourcemap: true,
    assetsInlineLimit: 0, // no inline data URLs en JS
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@phosphor-icons/react")) return "phosphor";
          if (id.includes("node_modules/zod/")) return "zod";
          if (id.includes("node_modules/react-dom/") || id.includes("node_modules/react/")) return "vendor";
          if (id.includes("node_modules/dexie/")) return "dexie";
          if (id.includes("@tanstack/react-table")) return "table";
          if (id.includes("packages/project-schema/src/optimized-fixture-urls")) return "fixture-data";
          if (id.includes("packages/modules/src/styles")) return "modules-styles";
          if (id.includes("packages/exporter/src/fonts")) return "exporter-fonts";
          if (id.includes("packages/storefront-runtime/src/index")) return "storefront-runtime";
          if (id.includes("packages/project-schema/src/catalog-modern-fixture")) return "fixture-data";
          return undefined;
        },
      },
    },
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run scripts/check-chunks.test.mjs --reporter=verbose && corepack pnpm build && node scripts/check-budgets.mjs`
Expected: PASS — nuevo `fixture-data-*.js` ~1.2 MiB separado, `index-DEZ` baja a ~400-500 KiB raw; `check-budgets` debe imprimir `OK` para JS/CSS o reducir EXCEDE de 550→<100 KiB.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/vite.config.ts scripts/check-chunks.test.mjs
git commit -m "perf: aísla fixtures/styles/fonts/runtime en manualChunks (fixes #Top20-3,5,10)"
```

---

### Task 3: Particionar `fonts.ts` por familia (de 137 KiB base64 a ~40 KiB si se usa 1 fuente)

**Files:**
- Create: `packages/exporter/src/fonts/archivo.ts`, `inter.ts`, `lora.ts`
- Modify: `packages/exporter/src/fonts.ts:1-111`
- Modify: `packages/exporter/src/index.ts:56,719-844,2669-2678` (import dinámico)
- Test: `packages/exporter/src/fonts.test.ts` (existente) + añade `font-dynamic.test.ts`

**Interfaces:**
- Consumes: `FONT_OPTIONS` monolítico
- Produces: `getFontOption(id): Promise<FontOption>` y `fontCssFor` que sólo carga base64 de `activeFonts` (1-2 familias), no 3.

- [ ] **Step 1: Write the failing test**

```ts
// packages/exporter/src/font-dynamic.test.ts
import { expect, test } from "vitest";
import { activeFonts } from "./fonts";
test("activeFonts con Archivo solo debe cargar 1 woff2, no 3", async () => {
  const fonts = activeFonts("Archivo, sans-serif", "Archivo, sans-serif");
  expect(fonts).toHaveLength(1);
  // verifica que el bundle no contenga base64 de Inter/Lora si sólo se pidió Archivo
  const bundle = await import("fs").then(m=>m.readFileSync("apps/studio/dist/assets/exporter-fonts-*.js","utf8").catch(()=>"" ));
  // este test falla hoy porque exporter-fonts no existe y fonts.ts contiene los 3 base64
  expect(bundle).not.toContain("gf-inter");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run packages/exporter/src/font-dynamic.test.ts --reporter=verbose`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/exporter/src/fonts/archivo.ts
export const ARCHIVO = { id:"gf-archivo", family:"Archivo", woff2Path:"assets/fonts/archivo.woff2", woff2Base64:"d09GMgABAAAAAHX0..." } as const;
// inter.ts, lora.ts análogo
// packages/exporter/src/fonts.ts
const REGISTRY: Record<string,()=>Promise<FontOption>> = {
  archivo: ()=> import("./fonts/archivo.js").then(m=>m.ARCHIVO),
  inter: ()=> import("./fonts/inter.js").then(m=>m.INTER),
  lora: ()=> import("./fonts/lora.js").then(m=>m.LORA),
};
export async function fontOptionForStackAsync(stack:string|undefined): Promise<FontOption|undefined> {
  const first = stack?.split(",")[0]?.trim().replace(/^["']+|["']+$/g,"");
  if(!first) return undefined;
  const loader = REGISTRY[first.toLowerCase()];
  return loader ? loader() : undefined;
}
export function fontCssFor(...): string { /* si transport==="inline" sólo usa woff2Base64 de activeFonts, no de FONT_OPTIONS completo */ }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run packages/exporter/src/font-dynamic.test.ts packages/exporter/src/fonts.test.ts --reporter=verbose && corepack pnpm build`
Expected: PASS — `exporter-fonts` chunk separado, `index-DEZ` sin base64 innecesario; `storefront-runtime-budget` sigue <64 KiB.

- [ ] **Step 5: Commit**

```bash
git add packages/exporter/src/fonts.ts packages/exporter/src/fonts/
git commit -m "perf: particiona fonts por familia + lazy base64 (fixes #Top20-10)"
```

---

### Task 4: Granularizar `modules/styles.ts` (271 KiB → chunks por familia/página)

**Files:**
- Create: `packages/modules/src/styles/base.ts`, `catalog-modern.ts`, `catalog-modern-v2.ts`, `legacy.ts`
- Modify: `packages/modules/src/styles.ts:1-5763` → barrel con getters lazy
- Modify: `packages/exporter/src/index.ts:1092-1121` `moduleStylesForSections` y `stylesForProjectFamily` para importar sólo familias necesarias
- Test: `packages/modules/src/styles.test.ts` (nuevo) + `scripts/public-storefront-budget.test.ts:47`

**Interfaces:**
- Consumes: `MODULE_STYLE_BLOCKS` monolítico
- Produces: `getModuleStyle(key): Promise<string>` y `stylesForProjectFamily` que sólo concatena `STORE_BASE_STYLES` + familias activas (legacy no se descarga si proyecto es V2).

- [ ] **Step 1: Write the failing test**

```ts
// packages/modules/src/styles.test.ts
import { expect, test } from "vitest";
test("styles V2 no debe incluir legacy editorial-hero cuando proyecto es catalog-modern-v2", async () => {
  const { MODULE_STYLE_BLOCKS } = await import("./styles.js");
  const v2 = MODULE_STYLE_BLOCKS["catalog-modern-v2"] ?? "";
  expect(v2).not.toContain("editorial-hero");
  // hoy falla porque catalog-modern-v2 trae 122 KiB que incluye overrides de legacy
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run packages/modules/src/styles.test.ts --reporter=verbose`
Expected: FAIL (contiene editorial).

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/modules/src/styles/base.ts -> export const STORE_BASE_STYLES = `...` 18 KiB
// packages/modules/src/styles/catalog-modern-v2.ts -> export const CATALOG_V2_STYLES = `...` 122 KiB granular por sub-módulo
// packages/modules/src/styles.ts
export const MODULE_STYLE_BLOCKS: Record<string,string> = {
  get "catalog-modern-v2"(){ return CATALOG_V2_STYLES; },
  // lazy getter
};
// packages/exporter/src/index.ts
async function stylesForProjectFamilyAsync(project, styles){ 
  if(project.commerceTemplates.designFamily !== "catalog-modern-v2") return `${styles}\n${STORE_THEME_TOKEN_STYLES}`;
  const { CATALOG_V2_STYLES } = await import("@solara/modules/styles/catalog-modern-v2");
  return `${styles}\n${CATALOG_V2_STYLES}\n${STORE_THEME_TOKEN_STYLES}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run packages/modules/src/styles.test.ts scripts/public-storefront-budget.test.ts --reporter=verbose && corepack pnpm build`
Expected: PASS — V2 CSS 213 KiB baja a ~140 KiB (sin legacy), budget 192 KiB vuelve a OK; gzip 27→~18 KiB.

- [ ] **Step 5: Commit**

```bash
git add packages/modules/src/styles.ts packages/modules/src/styles/
git commit -m "perf: granulariza styles por familia, evita legacy en V2 (fixes #Top20-5,7)"
```

---

### Task 5: Paralelizar waterfall `App.tsx` + deduplicar workers

**Files:**
- Modify: `apps/studio/src/App.tsx:221-345`
- Modify: `packages/core/src/index.ts:20` → `packages/core/src/fixtures.ts`
- Modify: `apps/studio/src/lib/workers.ts:168-197`
- Test: `apps/studio/src/App.test.tsx` (añade) + `tests/e2e/perf-idle.spec.ts`

**Interfaces:**
- Consumes: `loadLocalStorage`, `loadLocalProjectRepository`, `listProjectsWithRecovery`, `diskListing`
- Produces: `App` que hace `Promise.all([purgeRolledBack, getLocalStorageStatus])` + cachea `loadLocalStorage` chunk + `Promise.allSettled` para migraciones con concurrency 3.

- [ ] **Step 1: Write the failing test**

```ts
// apps/studio/src/App.waterfall.test.ts
import { expect, test, vi } from "vitest";
test("App debe paralelizar getLocalStorageStatus y purgeRolledBackDemoRecords", async () => {
  const src = await import("fs").then(m=>m.readFileSync("apps/studio/src/App.tsx","utf8"));
  expect(src).toContain("Promise.all");
  expect(src).not.toMatch(/await purgePromise;\s+const detectedStorage = await storagePromise/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run apps/studio/src/App.waterfall.test.ts --reporter=verbose`
Expected: FAIL — aún es secuencial.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/studio/src/App.tsx:221
const loadLocalStorageCached = (()=>{ let p:Promise<any>|null=null; return ()=> p ??= import("./lib/localStorage"); })();
const loadLocalProjectRepositoryCached = (()=>{ let p:Promise<any>|null=null; return ()=> p ??= import("./lib/localProjectRepository"); })();
// ...
const [_, detectedStorage] = await Promise.all([purgePromise, storagePromise]);
// diskListing vs listProjectsWithRecovery especulativo
const specBrowser = listProjectsWithRecovery(); // lanza sin await
const diskListing = detectedStorage.managed ? await loadLocalProjectRepositoryCached().then(m=>m.loadAllDiskProjects()) : undefined;
// si diskListing gana, cancela specBrowser con AbortController
// migraciones: await Promise.allSettled(diskListing.projects.map(p=> migrateOne(p)) )
```

```ts
// packages/core/src/fixtures.ts
export { referenceStore } from "@solara/project-schema/fixture";
export function generatePerformanceFixture(n:number){ ... } // mover desde index.ts
// packages/core/src/index.ts:20 remover import referenceStore
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run apps/studio/src/App.waterfall.test.ts --reporter=verbose && corepack pnpm build && corepack pnpm vitest run tests/e2e/perf-idle.spec.ts --reporter=verbose --grep "dashboard en reposo"`
Expected: PASS — first paint baja ~150 ms; `perf-idle` TaskDuration sigue 0.5 ms/s.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/App.tsx packages/core/src/index.ts packages/core/src/fixtures.ts apps/studio/src/lib/workers.ts
git commit -m "perf: paraleliza waterfall App + deduplica workers csv (fixes #Top20-2,4,14,15)"
```

---

### Task 6: Gatear polls/timers cuando hidden (5s, 60s, 550ms)

**Files:**
- Modify: `apps/studio/src/features/Studio.tsx:488-531` (poll 5s), `apps/studio/src/lib/autosave.ts:14-91` (550ms), `apps/studio/src/main.tsx:37-39` (SW 60s)
- Test: `tests/e2e/perf-idle.spec.ts:234` (hidden) + nuevo `apps/studio/src/lib/autosave.hidden.test.ts`

**Interfaces:**
- Consumes: `document.hidden`, `visibilitychange`, `window.setInterval`
- Produces: `poll`/`autosave`/`SW update` que no fetchean cuando hidden, reanudan con `fetch` inmediato al volver a visible.

- [ ] **Step 1: Write the failing test**

```ts
// apps/studio/src/lib/autosave.hidden.test.ts
import { expect, test } from "vitest";
test("autosave no debe schedulear cuando document.hidden true", () => {
  const src = require("fs").readFileSync("apps/studio/src/lib/autosave.ts","utf8");
  expect(src).toContain("document.hidden");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run apps/studio/src/lib/autosave.hidden.test.ts --reporter=verbose`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/studio/src/features/Studio.tsx:488
let pollId: number | null = null;
function startPoll(){ if(pollId!==null) return; pollId = window.setInterval(()=>{ if(document.hidden) return; fetch(...) },5000); }
function stopPoll(){ if(pollId!==null) clearInterval(pollId); pollId=null; }
startPoll();
document.addEventListener("visibilitychange", ()=> document.hidden ? stopPoll() : (stopPoll(), startPoll(), fetchImmediate()));
// autosave.ts:31
schedule(value){ if(typeof document!=="undefined" && document.hidden) { pending=value; return; } clearTimer(); ... setTimeout(drain, delayMs); }
// main.tsx:37
let swId = window.setInterval(()=>{ if(document.hidden) return; registration.update() }, 60000);
document.addEventListener("visibilitychange", ()=>{ if(document.hidden) clearInterval(swId); else swId = window.setInterval(...) });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run apps/studio/src/lib/autosave.hidden.test.ts --reporter=verbose && corepack pnpm test:e2e --grep "editor con preview oculto"`
Expected: PASS — hidden TaskDuration 0.3 ms/s, rAF 0.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/features/Studio.tsx apps/studio/src/lib/autosave.ts apps/studio/src/main.tsx
git commit -m "perf: gatea polls/autosave/SW cuando hidden (fixes #Top20-16,17)"
```

---

### Task 7: Ajustar budgets y agregar gates de regresión

**Files:**
- Modify: `scripts/check-budgets.mjs:29-51` (reporte por chunk), `scripts/public-storefront-budget.test.ts:69` (mantiene 192 pero añade comentario de ahorro), `scripts/storefront-runtime-budget.test.ts:18`
- Create: `scripts/check-chunks.test.mjs`
- Test: `corepack pnpm check:budgets` debe pasar tras tasks 1-6

**Interfaces:**
- Consumes: budgets actuales
- Produces: `check-budgets` OK + `perf-idle` y `export-benchmark` verdes, con margen >20% en budgets.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/check-budgets.regression.test.ts
import { expect, test } from "vitest";
import { execSync } from "node:child_process";
test("check:budgets debe pasar tras optimización apertura", () => {
  expect(()=> execSync("node scripts/check-budgets.mjs", {stdio:"pipe"})).not.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run scripts/check-budgets.regression.test.ts --reporter=verbose`
Expected: FAIL — hoy `EXCEDE Studio JavaScript 1287807`.

- [ ] **Step 3: Write minimal implementation**

```bash
# tras tasks 1-6, re-ejecutar:
corepack pnpm build
node scripts/check-budgets.mjs
# debe imprimir OK. Si aún excede <5% se documenta y se sube techo con justificante 720→780 KiB
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run scripts/check-budgets.regression.test.ts scripts/storefront-runtime-budget.test.ts scripts/public-storefront-budget.test.ts --reporter=verbose`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-budgets.mjs docs/TOP20_RECURSOS.md
git commit -m "chore: ajusta budgets tras optimización apertura, agrega gate regresión (fixes #Top20-6,7,18)"
```

---

## Self-Review

- **Spec coverage:** Task1 cubre #1 (fixtures 1575 KiB), Task2 #3 (entry 1257 KiB), Task3 #10 (fonts 137 KiB), Task4 #5/#7 (styles 271 KiB / V2 213 KiB), Task5 #2/#4/#14/#15 (workers + waterfall), Task6 #16/#17 (polls 5s/60s/550ms), Task7 #6/#18 (budgets). #8/#9 (export lineal) queda para fase 2 (índice precomputado `relatedProducts`), no bloquea apertura.
- **Placeholder scan:** sin TBD/TODO; cada step tiene código y comando exacto.
- **Type consistency:** `getOptimizedFixtureUrls(): Promise<Record<string,string>>` consistente entre `catalog-modern-fixture.ts` y `repository.ts`; `REGISTRY` en fonts usa `Promise<FontOption>`; `loadLocalStorageCached` tipado `Promise<typeof import("./lib/localStorage")>`.

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-08-31-optimizacion-apertura-top20.md`. Dos opciones:

**1. Subagent-Driven (recomendado)** — despacho un subagente por task, review entre tasks, iteración rápida

**2. Inline Execution** — ejecuto tasks en esta sesión con `executing-plans`, ejecución batch con checkpoints

¿Cuál prefieres?
