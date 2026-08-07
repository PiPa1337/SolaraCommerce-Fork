# Búsqueda con relevancia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is designed for PARALLEL execution: waves 1 and 2 dispatch multiple agents on disjoint files.

**Goal:** Mejorar la búsqueda del storefront con typo tolerance, ranking por tipo de coincidencia y campo, boost multi-término, disponibilidad como tiebreak y sugerencia de corrección, usando un índice con tokens precomputados.

**Architecture:** (1A) `normalizeSearchTokens` en `@solara/core` + tokens en `buildSearchIndex` del exporter; (1B) matcher puro en `packages/storefront-runtime/src/search.ts`; (2C) cableado en `index.ts` del runtime ampliando `STOREFRONT_RUNTIME_JS`; (2D) specs E2E; (3E) cierre y gate. El runtime se serializa por `toString()`, así que la cadena concatena el fuente de los helpers antes del IIFE de `storefrontBoot`.

**Tech Stack:** Node 22+ (release), pnpm 10.15.1 vía `corepack`, Vitest 3.2.4, Playwright Chromium.

## Global Constraints

- No modificar `StoreProjectV2Schema` ni `schemaVersion: 2`; no tocar el renderer compartido, el carrito ni el checkout.
- El índice `search-index.json` cambia de formato (agrega `tokens`); los campos planos existentes se conservan. Índice y runtime viajan juntos en cada export: no hay compatibilidad hacia atrás.
- Budget: `STOREFRONT_RUNTIME_JS` crudo ≤ 52 KiB (medido hoy 41.5 KiB; el matcher suma ~2–3 KiB). Verificar con `check:budgets` y el test de budget del runtime.
- El matcher debe ser autocontenido (sin imports dentro de las funciones serializadas): las funciones helper de `search.ts` sólo se referencian por nombre entre sí y con la cadena concatenada antes del IIFE.
- Commits breves en español, uno por task (salvo 2C que puede tener 2: cableado + sugerencia). No commitear `proyectos/`, `.solara-runtime/`, `.release/`, `dist/`, `test-results/`, `.superpowers/`.
- `format:check` (Biome) y `git diff --check` limpios en cada task; `corepack pnpm exec biome check --write <archivos>` antes de verificar.
- En ejecución paralela: si `git commit` falla por lock del índice, esperar 3 s y reintentar hasta 3 veces; `git add` SÓLO los archivos propios de la task.
- Gate completo en la Task 3E: `check`, `build`, `check:budgets`, `benchmark:export`, `test:e2e` (NO `test:e2e:release`).

---

### Task 1A: Normalización en core + tokens en el índice

**Files:**
- Modify: `packages/core/src/index.ts` (agregar `normalizeSearchTokens` al final)
- Create: `packages/core/src/normalize-search.test.ts`
- Modify: `packages/exporter/src/index.ts` (`buildSearchIndex` ~línea 1767)
- Modify: `packages/exporter/package.json` (dependencia `@solara/core: workspace:*`) + `pnpm-lock.yaml` (via `corepack pnpm install`)
- Modify: `packages/exporter/src/index.test.ts` o `catalog-modern.test.ts` (aseverar tokens normalizados)

**Interfaces:**
- Produces: `normalizeSearchTokens(value: string): string[]` en `@solara/core` — minúsculas es-AR + NFD sin diacríticos + trim + split + filter. El índice agrega por entrada: `tokens: { title, brand, tags, categories, description }` (arrays de strings normalizados; `categories` combina categoryNames + collectionNames). Los campos planos no cambian.

- [ ] **Step 1: Escribir el test que falla (core)**

Crear `packages/core/src/normalize-search.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeSearchTokens } from "./index";

describe("normalizeSearchTokens", () => {
  it("normaliza minúsculas, acentos y diacríticos", () => {
    expect(normalizeSearchTokens("ÁÉÍÓÚÜÑ áéíóúüñ")).toEqual([
      "aeiouun",
      "aeiouun",
    ]);
  });

  it("combina caracteres con diacríticos múltiples", () => {
    expect(normalizeSearchTokens("a\u0301 cafe\u0301")).toEqual(["a", "cafe"]);
  });

  it("separa por espacios múltiples y quita vacíos", () => {
    expect(normalizeSearchTokens("  taza   de   ceramica  ")).toEqual([
      "taza",
      "de",
      "ceramica",
    ]);
  });

  it("devuelve lista vacía para entrada vacía o sin tokens", () => {
    expect(normalizeSearchTokens("")).toEqual([]);
    expect(normalizeSearchTokens("   ")).toEqual([]);
    expect(normalizeSearchTokens(undefined as unknown as string)).toEqual([]);
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `corepack pnpm --filter @solara/core test`
Expected: FAIL — `normalizeSearchTokens` no existe.

- [ ] **Step 3: Implementar en core**

Agregar al final de `packages/core/src/index.ts`:

```ts
/** Normaliza texto de búsqueda: minúsculas es-AR, sin diacríticos, tokens. */
export function normalizeSearchTokens(value: string): string[] {
  return String(value ?? "")
    .toLocaleLowerCase("es-AR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}
```

- [ ] **Step 4: Ejecutar para verificar que pasa**

Run: `corepack pnpm --filter @solara/core test`
Expected: PASS.

- [ ] **Step 5: Agregar los tokens al índice (exporter)**

1. En `packages/exporter/package.json`, agregar a `dependencies`:

```json
    "@solara/core": "workspace:*",
```

y ejecutar `corepack pnpm install` (actualiza `pnpm-lock.yaml`).

2. En `packages/exporter/src/index.ts`, agregar el import (junto a los imports de paquetes):

```ts
import { normalizeSearchTokens } from "@solara/core";
```

3. Reemplazar `buildSearchIndex` (líneas 1767–1798) por:

```ts
function buildSearchIndex(project: StoreProjectV1): string {
  const entries = project.products
    .filter((product) => product.status === "active")
    .map((product) => {
      const prices = product.variants.map((variant) => variant.price);
      const image = imageUrl(project, product.imageIds[0]);
      const imageAsset = imageFor(project, product.imageIds[0]);
      const categoryIds = [...productCategoryScope(project, product)];
      const categoryNames = categoryIds
        .map((id) => project.categories.find((category) => category.id === id)?.title)
        .filter((value): value is string => Boolean(value));
      const collectionNames = product.collectionIds
        .map((id) => project.collections.find((collection) => collection.id === id)?.title)
        .filter((value): value is string => Boolean(value));
      return {
        id: product.id,
        slug: product.slug,
        title: product.title,
        brand: product.brand,
        description: product.description,
        tags: product.tags,
        categoryIds,
        collectionIds: product.collectionIds,
        categoryNames,
        collectionNames,
        ...(image ? { imageUrl: image } : {}),
        ...(imageAsset ? { imageWidth: imageAsset.width, imageHeight: imageAsset.height } : {}),
        priceMin: Math.min(...prices),
        available: product.variants.some((variant) => variant.available),
        path: `/productos/${product.slug}/`,
        tokens: {
          title: normalizeSearchTokens(product.title),
          brand: normalizeSearchTokens(product.brand),
          tags: normalizeSearchTokens((product.tags ?? []).join(" ")),
          categories: normalizeSearchTokens([...categoryNames, ...collectionNames].join(" ")),
          description: normalizeSearchTokens(product.description),
        },
      };
    });
  return JSON.stringify(entries);
}
```

- [ ] **Step 6: Tests del índice**

En `packages/exporter/src/catalog-modern.test.ts`, dentro del test "genera el catálogo completo y conserva la familia visual moderna" (o un test nuevo), agregar:

```ts
    const search = JSON.parse(String(exported.files.get("search-index.json"))) as Array<{
      title: string;
      tokens?: { title: string[]; brand: string[]; tags: string[]; categories: string[]; description: string[] };
    }>;
    const remera = search.find((entry) => entry.title === "Remera esencial de algodón");
    expect(remera?.tokens?.title).toContain("remera");
    expect(remera?.tokens?.description).toContain("dias");
    expect(remera?.tokens?.categories.length).toBeGreaterThan(0);
    expect(search.every((entry) => Array.isArray(entry.tokens?.title))).toBe(true);
```

(El test existente en la línea ~57 ya parsea `search-index.json`; verificar los nombres reales de productos y acentos del fixture antes de fijar `"dias"` — el fixture tiene descripciones con "días"; si no, usar otro token con tilde.)

- [ ] **Step 7: Verificar**

Run: `corepack pnpm --filter @solara/core test`, `corepack pnpm --filter @solara/exporter test`, `corepack pnpm --filter @solara/exporter typecheck`
Expected: PASS en los tres. Luego `corepack pnpm exec biome check --write` sobre los archivos tocados, `corepack pnpm format:check` y `git diff --check` limpios.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/normalize-search.test.ts packages/exporter/src/index.ts packages/exporter/package.json pnpm-lock.yaml packages/exporter/src/catalog-modern.test.ts
git commit -m "Precomputa tokens normalizados en el índice de búsqueda"
```

---

### Task 1B: Matcher puro del runtime

**Files:**
- Create: `packages/storefront-runtime/src/search.ts`
- Create: `packages/storefront-runtime/src/search.test.ts`

**Interfaces:**
- Produces (todas exportadas, autocontenidas, sin imports):
  - `normalizeSearchTokens(value: string): string[]` (copia del runtime; comentario: "Mantener en paridad con @solara/core — test de paridad en exporter").
  - `levenshtein(a: string, b: string): number` — distancia de edición con corte temprano por el límite máximo 2.
  - `type TokenMatch = "exact" | "prefix" | "substring" | "fuzzy" | null`
  - `matchToken(term: string, token: string): TokenMatch`
  - `interface SearchEntryTokens { title: string[]; brand: string[]; tags: string[]; categories: string[]; description: string[] }`
  - `scoreEntry(queryTerms: readonly string[], entry: SearchEntryTokens): number`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `packages/storefront-runtime/src/search.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  levenshtein,
  matchToken,
  normalizeSearchTokens,
  scoreEntry,
  type SearchEntryTokens,
} from "./search";

const entry: SearchEntryTokens = {
  title: ["taza", "de", "ceramica"],
  brand: ["casa", "luma"],
  tags: ["casa"],
  categories: ["cocina", "favoritos"],
  description: ["taza", "para", "todos", "los", "dias"],
};

describe("normalizeSearchTokens (runtime)", () => {
  it("normaliza igual que core", () => {
    expect(normalizeSearchTokens("ÁÉÍÓÚÜÑ áéíóúüñ")).toEqual(["aeiouun", "aeiouun"]);
    expect(normalizeSearchTokens("  taza   de  ")).toEqual(["taza", "de"]);
  });
});

describe("levenshtein", () => {
  it("calcula distancias conocidas", () => {
    expect(levenshtein("taza", "taza")).toBe(0);
    expect(levenshtein("tza", "taza")).toBe(1);
    expect(levenshtein("taz", "taza")).toBe(1);
    expect(levenshtein("xazat", "taza")).toBe(2);
    expect(levenshtein("", "taza")).toBe(4);
    expect(levenshtein("remera", "remeras")).toBe(1);
  });
});

describe("matchToken", () => {
  it("distingue exacto, prefijo y substring", () => {
    expect(matchToken("taza", "taza")).toBe("exact");
    expect(matchToken("taz", "taza")).toBe("prefix");
    expect(matchToken("aza", "taza")).toBe("substring");
    expect(matchToken("taz", "taz")).toBe("exact");
  });

  it("aplica fuzzy por longitud de token", () => {
    expect(matchToken("tza", "taza")).toBe("fuzzy"); // token 4 chars, dist 1
    expect(matchToken("tzaz", "taza")).toBeNull(); // token 4 chars, dist 2 > 1
    expect(matchToken("ceramica", "ceramik")).toBe("fuzzy"); // token 7 chars, dist 1
    expect(matchToken("ceramikx", "ceramica")).toBe("fuzzy"); // token 7 chars, dist 2
    expect(matchToken("ceramixx", "ceramica")).toBeNull(); // dist 3
  });

  it("no aplica fuzzy a términos o tokens cortos", () => {
    expect(matchToken("az", "taza")).toBeNull(); // término < 3
    expect(matchToken("taz", "ta")).toBeNull(); // token < 3
  });
});

describe("scoreEntry", () => {
  it("premia título exacto sobre coincidencia en descripción", () => {
    const titleHit = scoreEntry(["taza"], entry);
    const descriptionOnly = scoreEntry(["dias"], entry);
    expect(titleHit).toBeGreaterThan(descriptionOnly);
  });

  it("aplica pesos por campo y tipo", () => {
    const exactTitle = scoreEntry(["ceramica"], entry); // 10 * 3
    const prefixBrand = scoreEntry(["casa"], entry); // 7 * 2
    const substringDescription = scoreEntry(["ias"], entry); // 5 * 0.5
    expect(exactTitle).toBeGreaterThan(prefixBrand);
    expect(prefixBrand).toBeGreaterThan(substringDescription);
  });

  it("bonifica términos adicionales del mismo producto", () => {
    const oneTerm = scoreEntry(["taza"], entry);
    const twoTerms = scoreEntry(["taza", "ceramica"], entry);
    expect(twoTerms).toBeGreaterThan(oneTerm + 10 * 3); // +2 de bonus multi-término
  });

  it("devuelve 0 sin coincidencias", () => {
    expect(scoreEntry(["zzzzz", "qqqq"], entry)).toBe(0);
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `corepack pnpm --filter @solara/storefront-runtime test`
Expected: FAIL — `./search` no existe.

- [ ] **Step 3: Implementar search.ts**

Crear `packages/storefront-runtime/src/search.ts`:

```ts
/**
 * Matcher de búsqueda puro del storefront. Cada función es autocontenida:
 * el runtime público se serializa concatenando su fuente (ver
 * STOREFRONT_RUNTIME_JS en index.ts), por lo que NO deben importar nada.
 */

/** Copia del runtime; mantener en paridad con @solara/core (test en exporter). */
export function normalizeSearchTokens(value: string): string[] {
  return String(value ?? "")
    .toLocaleLowerCase("es-AR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (longer.length - shorter.length > 2) return longer.length;
  const previous = Array.from({ length: shorter.length + 1 }, (_, index) => index);
  let current = new Array<number>(shorter.length + 1);
  for (let i = 1; i <= longer.length; i++) {
    current[0] = i;
    for (let j = 1; j <= shorter.length; j++) {
      const cost = longer[i - 1] === shorter[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= shorter.length; j++) previous[j] = current[j];
  }
  return current[shorter.length];
}

export type TokenMatch = "exact" | "prefix" | "substring" | "fuzzy" | null;

export function matchToken(term: string, token: string): TokenMatch {
  if (term === token) return "exact";
  if (token.startsWith(term)) return "prefix";
  if (token.includes(term)) return "substring";
  if (term.length < 3 || token.length < 3) return null;
  const limit = token.length <= 4 ? 1 : 2;
  return levenshtein(term, token) <= limit ? "fuzzy" : null;
}

export interface SearchEntryTokens {
  title: string[];
  brand: string[];
  tags: string[];
  categories: string[];
  description: string[];
}

const MATCH_WEIGHT: Record<Exclude<TokenMatch, null>, number> = {
  exact: 10,
  prefix: 7,
  substring: 5,
  fuzzy: 3,
};

const FIELD_WEIGHT: Record<keyof SearchEntryTokens, number> = {
  title: 3,
  brand: 2,
  tags: 1.5,
  categories: 1,
  description: 0.5,
};

export function scoreEntry(queryTerms: readonly string[], entry: SearchEntryTokens): number {
  let total = 0;
  let matchedTerms = 0;
  for (const term of queryTerms) {
    let termScore = 0;
    for (const field of Object.keys(entry) as (keyof SearchEntryTokens)[]) {
      let best: TokenMatch = null;
      for (const token of entry[field]) {
        const match = matchToken(term, token);
        if (match !== null && (best === null || MATCH_WEIGHT[match] > MATCH_WEIGHT[best])) {
          best = match;
        }
      }
      if (best !== null) termScore = Math.max(termScore, MATCH_WEIGHT[best] * FIELD_WEIGHT[field]);
    }
    if (termScore > 0) {
      total += termScore;
      matchedTerms += 1;
    }
  }
  if (matchedTerms > 1) total += (matchedTerms - 1) * 2;
  return total;
}
```

- [ ] **Step 4: Ejecutar para verificar que pasan**

Run: `corepack pnpm --filter @solara/storefront-runtime test`
Expected: PASS (todos los tests del matcher).

- [ ] **Step 5: Verificar formato**

Run: `corepack pnpm exec biome check --write packages/storefront-runtime/src/search.ts packages/storefront-runtime/src/search.test.ts`, luego `corepack pnpm format:check` y `git diff --check` limpios.

- [ ] **Step 6: Commit**

```bash
git add packages/storefront-runtime/src/search.ts packages/storefront-runtime/src/search.test.ts
git commit -m "Agrega matcher de búsqueda con typo tolerance y ranking"
```

---

### Task 2C: Cableado del runtime (buscar + sugerencia + serialización)

**Files:**
- Modify: `packages/storefront-runtime/src/index.ts` (imports de `./search`, reemplazo del bloque de scoring ~líneas 978–1069, ampliación de `STOREFRONT_RUNTIME_JS` línea 1228, sugerencia)
- Modify: `packages/storefront-runtime/src/index.test.ts` (test guard de serialización + tipo del índice con tokens)
- Create: `packages/exporter/src/normalize-parity.test.ts` (paridad core vs runtime)

**Interfaces:**
- Consumes: `normalizeSearchTokens`, `levenshtein`, `matchToken`, `scoreEntry`, `SearchEntryTokens` de `./search` (Task 1B, ya mergeada); `normalizeSearchTokens` de `@solara/core` (Task 1A).
- Produces: búsqueda con el nuevo scoring; sugerencia "Quizás quisiste decir"; `STOREFRONT_RUNTIME_JS` con el fuente de los helpers concatenado.

- [ ] **Step 1: Test de paridad (exporter)**

Crear `packages/exporter/src/normalize-parity.test.ts`:

```ts
import { normalizeSearchTokens as coreTokens } from "@solara/core";
import { normalizeSearchTokens as runtimeTokens } from "@solara/storefront-runtime/src/search";
import { describe, expect, it } from "vitest";

const corpus = [
  "ÁÉÍÓÚÜÑ áéíóúüñ",
  "a\u0301 cafe\u0301 señor",
  "  Taza   DE   Cerámica  ",
  "campera quilted - 2026",
  "",
  "ñandú miércoles ü",
];

describe("paridad de normalización de búsqueda", () => {
  it("core y runtime producen los mismos tokens", () => {
    for (const value of corpus) {
      expect(runtimeTokens(value)).toEqual(coreTokens(value));
    }
  });
});
```

Verificar que la ruta de import del runtime funcione en Vitest del exporter (los exports de `@solara/storefront-runtime` apuntan a `./src/index.ts`; para `search.ts` puede necesitarse `../storefront-runtime/src/search` vía ruta relativa del workspace; si el import por nombre falla, usar ruta relativa `../../storefront-runtime/src/search` y documentar).

- [ ] **Step 2: Ejecutar para verificar que falla o pasa según el cableado**

Run: `corepack pnpm --filter @solara/exporter test`
Expected: FAIL si el import de `./search` del runtime no existe aún en la cadena (no: search.ts ya existe de 1B; el test de paridad debe PASAR ya). Si pasa, continuar al Step 3. Este test es el guard de paridad para el futuro.

- [ ] **Step 3: Cablear el runtime**

En `packages/storefront-runtime/src/index.ts`:

1. Agregar el import (después de la línea 6):

```ts
import {
  levenshtein,
  matchToken,
  normalizeSearchTokens,
  scoreEntry,
  type SearchEntryTokens,
} from "./search";
```

Nota: `levenshtein` y `matchToken` se usan en la sugerencia (Step 5); `scoreEntry` y `normalizeSearchTokens` en la búsqueda.

2. En el bloque de búsqueda (líneas ~978–1069):
   - Eliminar la definición local `const normalizeSearch = ...` (ahora importada).
   - Reemplazar `const terms = normalizeSearch(query);` por `const terms = normalizeSearchTokens(query);`.
   - Reemplazar el tipo de la respuesta del fetch para incluir `tokens?: SearchEntryTokens` (agregar el campo al tipo inline del `.json()`).
   - Reemplazar TODO el bloque de scoring (`.map((entry) => {...})` con pesos fijos) por:

```ts
            const ranked = entries
              .map((entry) => ({
                entry,
                score: scoreEntry(terms, entry.tokens ?? {
                  title: normalizeSearchTokens(entry.title),
                  brand: normalizeSearchTokens(entry.brand),
                  tags: normalizeSearchTokens((entry.tags ?? []).join(" ")),
                  categories: normalizeSearchTokens(
                    `${(entry.categoryIds ?? []).join(" ")} ${(entry.collectionIds ?? []).join(" ")} ${(entry.categoryNames ?? []).join(" ")} ${(entry.collectionNames ?? []).join(" ")}`,
                  ),
                  description: normalizeSearchTokens(entry.description),
                }),
              }))
              .filter((item) => item.score > 0)
              .sort(
                (left, right) =>
                  right.score - left.score ||
                  Number(right.entry.available) - Number(left.entry.available) ||
                  left.entry.title.localeCompare(right.entry.title),
              );
```

   (El fallback inline de tokens cubre índices viejos; la cadena `.slice(0, 48)` y el render del resultado quedan iguales.)

3. Ampliar `STOREFRONT_RUNTIME_JS` (línea 1228):

```ts
export const STOREFRONT_RUNTIME_JS = `${[
  normalizeSearchTokens,
  levenshtein,
  matchToken,
  scoreEntry,
]
  .map((fn) => fn.toString())
  .join("\n")}\n(${storefrontBoot.toString()})();`;
```

- [ ] **Step 4: Test guard de serialización + tests del índice**

En `packages/storefront-runtime/src/index.test.ts`, agregar:

```ts
  it("serializa los helpers de búsqueda dentro del runtime público", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("function levenshtein");
    expect(STOREFRONT_RUNTIME_JS).toContain("function matchToken");
    expect(STOREFRONT_RUNTIME_JS).toContain("function scoreEntry");
    expect(STOREFRONT_RUNTIME_JS).toContain("function normalizeSearchTokens");
    expect(STOREFRONT_RUNTIME_JS).toContain("storefrontBoot");
  });
```

- [ ] **Step 5: Sugerencia "Quizás quisiste decir"**

En el mismo bloque de búsqueda, cuando `ranked.length === 0` (antes del "No encontramos productos"), insertar:

```ts
            if (ranked.length === 0) {
              const suggestion = suggestCorrection(terms, entries);
              if (suggestion) {
                const url = `/buscar/?q=${encodeURIComponent(suggestion)}`;
                searchResults.innerHTML = `<p class="solara-search-summary">No encontramos resultados para “${escapeText(query)}”. ¿Quisiste decir <a href="${escapeAttribute(url)}">${escapeText(suggestion)}</a>?</p>`;
                return;
              }
            }
```

Y definir `suggestCorrection` como función local del bloque de búsqueda (dentro de `storefrontBoot`, para serializarse):

```ts
    const suggestCorrection = (terms: string[], entries: SearchEntryWithTokens[]): string | undefined => {
      let best: { term: string; distance: number } | undefined;
      for (const term of terms) {
        for (const entry of entries) {
          const candidates = [
            ...(entry.tokens?.title ?? normalizeSearchTokens(entry.title)),
            ...(entry.tokens?.brand ?? normalizeSearchTokens(entry.brand)),
          ];
          for (const token of candidates) {
            const distance = levenshtein(term, token);
            if (distance <= 2 && (!best || distance < best.distance)) {
              best = { term: token, distance };
            }
          }
        }
      }
      return best?.term;
    };
```

(Definir `SearchEntryWithTokens` como el tipo del fetch con `tokens?: SearchEntryTokens`.) La sugerencia sólo aparece con 0 resultados.

- [ ] **Step 6: Verificar**

Run: `corepack pnpm --filter @solara/storefront-runtime test`, `corepack pnpm --filter @solara/exporter test`, `corepack pnpm --filter @solara/storefront-runtime typecheck`, `corepack pnpm --filter @solara/studio typecheck`
Expected: PASS en todos. Luego `corepack pnpm check:budgets` (runtime JS crudo ≤ 52 KiB) y `format:check`/`git diff --check` limpios.

- [ ] **Step 7: Commit**

```bash
git add packages/storefront-runtime/src/index.ts packages/storefront-runtime/src/index.test.ts packages/exporter/src/normalize-parity.test.ts
git commit -m "Cablea el matcher de búsqueda con sugerencia en el runtime"
```

---

### Task 2D: Specs E2E de búsqueda

**Files:**
- Modify: `tests/e2e/catalog-modern.spec.ts`
- Modify: `tests/e2e/scale-store.spec.ts`

**Interfaces:**
- Consumes: el comportamiento definido en el spec (typo tolerance, ranking, sugerencia). NO se ejecutan en esta task: se escriben y se corren en la Task 3E.

- [ ] **Step 1: Test de typo tolerance y sugerencia (catalog-modern)**

En `tests/e2e/catalog-modern.spec.ts`, después del test de búsqueda existente (líneas ~329–352), agregar:

```ts
test("la búsqueda tolera errores de tipeo y sugiere correcciones", async ({ page }) => {
  await page.goto(`${studioUrl}/buscar/?q=Remra`);
  await expect(page.locator("[data-search-results] .solara-search-result").first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator("[data-search-results]")).toContainText("Remera");

  await page.goto(`${studioUrl}/buscar/?q=xazat`);
  await expect(page.locator("[data-search-results]")).toContainText("¿Quisiste decir", {
    timeout: 15_000,
  });
  await expect(page.locator("[data-search-results]")).toContainText("taza");
});
```

(Verificar el `studioUrl`/naming real del spec existente — usar las mismas variables del archivo; el fixture de Catalog Modern tiene "Remera esencial de algodón" y "Taza" en productos; ajustar el término typo si el fixture cambia.)

- [ ] **Step 2: Test de typo en la escala (scale-store)**

En `tests/e2e/scale-store.spec.ts`, después del test de búsqueda existente (líneas ~135–136), agregar:

```ts
  await page.goto("http://127.0.0.1:4176/buscar/?q=Csa");
  await expect(page.locator("[data-search-results]")).toContainText("Pieza de escala 01", {
    timeout: 15_000,
  });
```

(Replicar el patrón de servidor/puerto del test existente — si el test usa otra URL base, usar la misma.)

- [ ] **Step 3: Verificar sintaxis**

Run: `corepack pnpm exec playwright test --list tests/e2e/catalog-modern.spec.ts tests/e2e/scale-store.spec.ts`
Expected: PASS (sólo lista; la ejecución real ocurre en 3E).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/catalog-modern.spec.ts tests/e2e/scale-store.spec.ts
git commit -m "Agrega recorridos E2E de typo tolerance y sugerencia de búsqueda"
```

---

### Task 3E: Budgets, changelog y gate completo

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/README.md` (sección Catálogo/búsqueda si menciona el comportamiento actual) — sólo si aplica
- (Sin cambios de código salvo que el gate falle)

**Interfaces:**
- Consumes: Tasks 1A–2D mergeadas (HEAD = la de 2D).

- [ ] **Step 1: Verificar presupuestos**

Run: `corepack pnpm build` y `corepack pnpm check:budgets`
Expected: PASS — registrar los bytes crudos de `STOREFRONT_RUNTIME_JS` (esperado ~43–45 KiB, techo 52 KiB) y el tamaño de `search-index.json` del export de `catalogModernStore` (medirlo con un test temporal o el baseline de optimización; documentar el crecimiento con los tokens).

- [ ] **Step 2: Changelog**

Agregar bajo `[Unreleased]`:

```markdown
### Búsqueda con relevancia (2026-08-07)

La búsqueda del storefront ahora tolera errores de tipeo (hasta 2 ediciones
según la longitud), ordena por relevancia (coincidencia exacta > prefijo >
substring > fuzzy, con pesos por campo: título, marca, etiquetas, categorías
y descripción), bonifica los productos que coinciden en varios términos,
prioriza los disponibles y sugiere una corrección cuando no hay resultados.
El índice `search-index.json` ahora incluye tokens precomputados y
normalizados; el presupuesto del runtime público se mantiene en ≤ 52 KiB
crudos.
```

- [ ] **Step 3: Gate completo**

Run:
```
corepack pnpm check
corepack pnpm build
corepack pnpm check:budgets
corepack pnpm benchmark:export
corepack pnpm test:e2e
```
Expected: PASS en todos (incluye los E2E nuevos de 2D y los existentes de búsqueda). Si un E2E falla: re-ejecutar el spec aislado, corregir la causa real (probablemente el término typo elegido o el texto de la sugerencia) y documentar; NO debilitar aserciones sin causa. NO ejecutar `test:e2e:release`.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md docs/README.md
git commit -m "Documenta la búsqueda con relevancia y cierra el gate"
```

---

## Self-review

- **Cobertura del spec:** índice con tokens (1A), normalización compartida + paridad (1A/2C), matcher con fuzzy y pesos (1B), cableado + sugerencia + serialización (2C), E2E (2D), budgets + changelog (3E). Todos los puntos del spec aprobado tienen tarea.
- **Consistencia de tipos:** `SearchEntryTokens` definido en search.ts (1B) y usado por el tipo del fetch (2C); `scoreEntry(queryTerms, entry)` coincide con el fallback inline de 2C; `normalizeSearchTokens` exportado por core y por search.ts con test de paridad; `STOREFRONT_RUNTIME_JS` concatena exactamente las cuatro funciones de search.ts.
- **Serialización:** cada función de search.ts es autocontenida (sin imports; se referencian por nombre dentro de la misma cadena). El test guard (2C Step 4) evita regresiones silenciosas.
- **Paralelismo:** 1A y 1B no comparten archivos (core+exporter vs storefront-runtime/search.ts). 2C y 2D tampoco (index.ts+tests vs tests/e2e). El contrato (formato del índice + firmas del matcher) queda fijado en el spec.
- **Sin placeholders:** todos los pasos tienen código completo; los únicos valores "a ajustar" son términos de fixture E2E, verificables en ejecución con instrucciones explícitas.
