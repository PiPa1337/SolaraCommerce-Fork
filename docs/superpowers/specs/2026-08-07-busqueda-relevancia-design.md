# Búsqueda con relevancia — Design spec

**Fecha:** 2026-08-07
**Estado:** aprobado por el usuario (diseño presentado en un solo mensaje)

## Objetivo

Mejorar la búsqueda del storefront público con relevancia real: índice con
tokens precomputados, typo tolerance, ranking por tipo de coincidencia y
campo, boost multi-término, disponibilidad como tiebreak y sugerencia de
corrección cuando no hay resultados. Diseñado para ejecutarse con agentes en
paralelo (3 olas con archivos disjuntos).

**No cambia:** `StoreProjectV2Schema`/`schemaVersion: 2`, el renderer
compartido, el contrato de la tienda ni el checkout. El formato de
`search-index.json` cambia (índice y runtime viajan juntos en cada export; no
se requiere compatibilidad hacia atrás).

## Estado actual (verificado)

- `packages/exporter/src/index.ts` `buildSearchIndex` (~línea 1767): genera
  `search-index.json` plano (title, brand, description, tags, categoryIds/
  names, collectionIds/names, path, imageUrl, imageWidth/Height, priceMin,
  available).
- `packages/storefront-runtime/src/index.ts` (~líneas 978–1069):
  `normalizeSearch` inline (toLocaleLowerCase es-AR + NFD + sin diacríticos +
  tokenizado), scoring por substring con pesos fijos por término (title 6,
  brand 4, tags 3, categorías 2, descripción 1), suma, filtro score>0, orden
  score desc + título asc, top 48.
- El diálogo de búsqueda y la página `/buscar/` comparten la misma
  implementación.
- E2E existentes: `tests/e2e/catalog-modern.spec.ts:329-352` (diálogo → submit
  → `/buscar/?q=Remera`, summary y primer resultado visible) y
  `tests/e2e/scale-store.spec.ts:135-136` (`/buscar/?q=Casa` → "Pieza de
  escala 01").

## Cambios

### 1. Índice con tokens precomputados (`buildSearchIndex`)

Cada entrada del índice agrega un objeto `tokens` normalizado en build:

```json
{
  "path": "/productos/taza-de-ceramica/",
  "title": "Taza de cerámica",
  "brand": "Casa Luma",
  "tags": ["casa"],
  "categoryNames": ["Cocina", "Favoritos"],
  "collectionNames": [],
  "imageUrl": "...", "imageWidth": 1, "imageHeight": 1,
  "priceMin": 125000,
  "available": true,
  "tokens": {
    "title": ["taza", "de", "ceramica"],
    "brand": ["casa", "luma"],
    "tags": ["casa"],
    "categories": ["cocina", "favoritos"],
    "description": ["taza", "para", "todos", "los", "dias"]
  }
}
```

Los tokens se calculan con la misma normalización que la query (ver §2). El
runtime deja de normalizar todo el índice en cada tecleo y sólo normaliza la
query. Los campos planos originales (title, brand, description, etc.) se
conservan para el render y para cualquier consumidor externo.

### 2. Normalización compartida

- Nueva función `normalizeSearchTokens(value: string): string[]` en
  `@solara/core` (lógica: `toLocaleLowerCase("es-AR")` + `normalize("NFD")` +
  quitar `[\u0300-\u036f]` + trim + split por espacios + filter Boolean),
  exportada y testeada.
- El exporter la importa desde `@solara/core` para construir los tokens.
- El runtime tiene su propia copia en `search.ts` (módulo nuevo, exportada)
  con un comentario que apunta a `@solara/core`.
- **Test de paridad** (en `packages/exporter`, que depende de ambos paquetes):
  aplica las dos implementaciones a un corpus fijo (acentos, mayúsculas,
  diacríticos combinados, ñ, ü, espacios múltiples) y aserta tokens iguales.

### 2b. Serialización del runtime (mecanismo existente, ampliado)

`STOREFRONT_RUNTIME_JS = \`(${storefrontBoot.toString()})();\`` sólo incluye
el cuerpo de `storefrontBoot`. El matcher y la normalización viven en
`search.ts` (fuera de `storefrontBoot`), así que la constante se amplía para
concatenar el fuente de las funciones helper antes del IIFE:

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

Cada helper es autocontenido (referencias por nombre resueltas dentro de la
misma cadena). Un test guard aserta que la cadena serializada contiene
`function levenshtein`, `function matchToken`, `function scoreEntry` y
`function normalizeSearchTokens`, para que un futuro cambio no rompa el
runtime público silenciosamente. Los tests unitarios importan las funciones
reales desde `./search` (Vitest sobre el fuente).

### 3. Matcher puro (`packages/storefront-runtime/src/search.ts`)

Módulo nuevo, funciones puras exportadas, testeable por Vitest sobre el
fuente:

- `levenshtein(a, b): number` — distancia de edición simple.
- `matchToken(term, token): "exact" | "prefix" | "substring" | "fuzzy" | null`:
  - `exact`: `term === token`
  - `prefix`: `token.startsWith(term)` y no exact
  - `substring`: `token.includes(term)` y no prefix
  - `fuzzy`: distancia ≤ 1 para tokens de 3–4 chars; ≤ 2 para ≥ 5 chars;
    sin fuzzy para términos < 3 chars ni para tokens < 3 chars
  - si nada, `null`
- `scoreEntry(queryTerms, entryTokens): number`:
  - por término y campo, el mejor `matchToken` cuenta UNA vez por campo;
  - pesos por tipo: exact 10, prefix 7, substring 5, fuzzy 3;
  - pesos por campo: title ×3, brand ×2, tags ×1.5, categories ×1,
    description ×0.5;
  - +2 por cada término adicional que coincida en el mismo producto
    (todos-los-términos);
  - devuelve 0 si ningún término coincide en ningún campo.
- El orden final en el runtime: score desc; tiebreak por `available` (true
  primero) y luego título asc (localeCompare). Top 48.

### 4. Sugerencia de corrección

Con 0 resultados, el runtime calcula el mejor candidato fuzzy por término
(sumar distancia mínima por término) y muestra
`Quizás quisiste decir: «término corregido»` como enlace que re-ejecuta la
búsqueda con el término sugerido. Si no hay candidato con distancia ≤ 2,
no se muestra sugerencia.

### 5. Presupuesto

- Runtime público JS ≤ 52 KiB crudo (se verifica con `check:budgets`);
  matcher estimado +1.5–2.5 KiB.
- `search-index.json` crece con los tokens (~10–25% sobre el tamaño actual);
  se mide y se documenta el tamaño resultante en el changelog.

## Archivos por ola (disjuntos)

| Ola | Agente | Archivos |
| --- | --- | --- |
| 1A | Índice + normalización | `packages/core/src/index.ts` (+test), `packages/exporter/src/index.ts` (+tests), `packages/exporter/package.json` (dep `@solara/core`) + `pnpm-lock.yaml` |
| 1B | Matcher | `packages/storefront-runtime/src/search.ts` (nuevo) + `packages/storefront-runtime/src/search.test.ts` |
| 2C | Cableado runtime | `packages/storefront-runtime/src/index.ts` (importa `./search`, reemplaza el bloque de scoring, amplía `STOREFRONT_RUNTIME_JS`, añade sugerencia y test guard de serialización), `packages/exporter/src/` (test de paridad de normalización) |
| 2D | Specs E2E | `tests/e2e/catalog-modern.spec.ts`, `tests/e2e/scale-store.spec.ts` (typo "Tza"→Taza, ranking exacto antes que descripción, sugerencia visible) — se ejecutan en la ola 3 |
| 3E | Cierre | `CHANGELOG.md`, docs si aplica, gate completo |

Los agentes de la ola 1 no comparten archivos. El contrato del índice (§1) y
la firma del matcher (`matchToken`, `scoreEntry`, `levenshtein`) quedan
fijados aquí para que 2C y 2D no dependan de 1A/1B mergeados.

## Estrategia de testing

- Core: `normalizeSearchTokens` (acentos, mayúsculas, ñ/ü, espacios
  múltiples, cadena vacía).
- Exporter: el índice contiene `tokens` normalizados y deterministas (misma
  entrada → mismo JSON), y los campos planos se conservan.
- Runtime (matcher): tabla de casos para `matchToken` (exact/prefix/
  substring/fuzzy/límites de longitud) y `scoreEntry` (pesos por campo y
  tipo, multi-término, cero sin coincidencias).
- Paridad: normalización core vs runtime sobre corpus fijo (test en
  `packages/exporter`, que depende de ambos paquetes).
- Serialización: test guard en el runtime (la cadena contiene las funciones
  helper).
- E2E: typo tolerance end-to-end, ranking (producto con título exacto antes
  que producto con coincidencia sólo en descripción), sugerencia visible con
  0 resultados, y los E2E existentes siguen verdes.
- Gate: `corepack pnpm check`, `build`, `check:budgets`, `benchmark:export`,
  `test:e2e` (Chromium).

## Fuera de alcance

- Autocompletado en vivo con debounce (el diálogo ya muestra resultados al
  escribir; no se agrega latencia artificial ni historial).
- Sinónimos, stemming español, búsqueda por faceta o filtros por rango.
- No cambia `schemaVersion`, el runtime de carrito ni el checkout.
