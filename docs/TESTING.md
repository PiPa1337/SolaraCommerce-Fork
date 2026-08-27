# Estrategia de testing

La suite está organizada por riesgo: funciones puras y schemas rápidos primero,
integración de paquetes después y navegador al cerrar una fase. No se debe
ejecutar Lighthouse o todos los navegadores después de cada cambio pequeño.

## Capas

### Unitarias

Vitest cubre schemas, migraciones, reducer de dominio, historial, seguridad de
módulos, runtime de carrito/WhatsApp, renderer/exporter y optimizer. Cada
paquete contiene sus pruebas junto al código. Es la primera verificación para
cualquier transformación determinista.

```powershell
corepack pnpm --filter @solara/project-schema test
corepack pnpm --filter @solara/core test
corepack pnpm --filter @solara/exporter test
corepack pnpm --filter @solara/storefront-runtime test
```

### Integración

`corepack pnpm check` (alias `check:full`) ejecuta repository scan, formato, typecheck, tests de todos
los paquetes y checks de optimizer de forma secuencial (CI/cierre). `build` comprueba que los paquetes se
compilan en orden.

Para iteración diaria en 9800X3D usar `check:quick` — seis gates en paralelo
(repository, hardcoded-content, image-budget, format, typecheck y tests; ~40-60%
más rápido, <90s):

```powershell
corepack pnpm check:quick   # 6 gates en paralelo
corepack pnpm check:full    # secuencial, para cierre/CI
corepack pnpm check         # alias de check:full
corepack pnpm build
```

### Exportación y presupuestos

```powershell
corepack pnpm benchmark:export
corepack pnpm check:budgets
corepack pnpm check:optimization
```

Los fixtures pequeños verifican render visual; `catalogScaleStore` verifica 50
productos, jerarquía y 60 variantes; el benchmark de core exporta
`catalog-modern-v2` con 2.000 productos sin versionar un fixture masivo.

### Playwright

`test:e2e` compila Studio y ejecuta Chromium (8 workers por defecto en 9800X3D, override con `PLAYWRIGHT_WORKERS=6`) contra un servidor local. En CI el
build ya está hecho y se usa `test:e2e:ci`.

Para iteración diaria usar smoke ampliado (15 specs, ~45s-2min) con cache de build:

```powershell
corepack pnpm playwright:install:chromium
corepack pnpm test:e2e:smoke  # 15 specs criticos + build cacheado
corepack pnpm test:e2e        # suite full (961 tests observados; puede requerir menos workers)
corepack pnpm test:e2e:ci     # sin build, CI usa dist ya compilado
```

Smoke ampliado cubre: catalog-modern-v2, exporter-sentinel, scale-store, storefront-nojs, ui-sweep-a27..30, axe-site, nojs-coverage, focus-visible, interacciones, catalog, assets, exported-store.
No incluye visual sweep (VISUAL_REVIEW_STAGE) ni LCP pesado.

La matriz de release instala Chromium, Firefox y WebKit mediante
`PLAYWRIGHT_MULTI_BROWSER=1`. Los tests visuales se activan sólo con
`VISUAL_REVIEW_STAGE=...` y escriben en `test-results/visual-review/`, que no se
versiona.

## Política de estabilidad E2E (2026-08-21)

Un gate que falla intermitentemente entrena al equipo a ignorar el rojo.
Estas reglas son obligatorias y existen porque el smoke llegó a acumular ~7
specs inestables bajo carga paralela (verificado contra baseline `c4d71ae`;
detalle en `TECHNICAL_DEBT.md` y plan
`superpowers/plans/2026-08-21-flaky-e2e-runtime-debuggeable.md`).

1. **Incorporación**: un spec nuevo entra al smoke sólo después de 5 corridas
   consecutivas limpias (local, misma máquina, 8 workers).
2. **Sincronización**: prohibido usar `waitForTimeout` fijo como espera
   primaria. Esperar señales: roles/atributos visibles, respuestas de red
   (`page.waitForResponse`), o el helper compartido de "runtime listo".
3. **Presupuesto de duración**: specs con timeout declarado >10s no van a smoke;
   specs >15s van directo a `test:e2e` full con timeout dedicado.
4. **Gate rojo**: ante un fallo, correr el spec aislado 3×. Si pasa, registrar
   el spec en `tests/e2e/unstable.json` (con fecha y baseline) y abrir fila en
   `TECHNICAL_DEBT.md`. Nunca ignorar un rojo sin registro escrito.
5. **Re-inclusión**: un spec excluido vuelve al gate tras 10/10 corridas limpias
   verificadas con `scripts/e2e-stability.mjs` (o su sucesor), nunca a ojo.
6. **Runtime listo**: si se agrega una señal nueva de inicialización del
   storefront, actualizar el helper compartido (`waitForStorefrontReady`);
   prohibido copiar esperas locales por spec.

## Debugging del draft (2026-08-23)

El modo draft marca su bundle con `// DEBUG: modo draft` para distinguirlo del
runtime de producción, que sigue inline y byte-idéntico. El exporter publica el
runtime bajo un nombre con fingerprint reproducible; para depurar contra el
código fuente:

1. generar el bundle externo + mapa local:
   `node packages/storefront-runtime/scripts/build-runtime.mjs`
   (salida: `packages/storefront-runtime/dist/storefront-runtime.js.map`);
2. abrir DevTools en la página draft e inspeccionar el bundle marcado DEBUG;
3. no publicar drafts: `robots.txt` los bloquea y el runtime de producción es
   la única variante soportada en hosting.

Pendiente documentado: emitir un source map desde el exporter si el debugging
del draft lo requiere (la validación actual exige sólo la marca DEBUG).

## Flujos críticos que deben conservarse

- crear una tienda limpia desde la plantilla Catalog Modern;
- crear/duplicar/archivar/restaurar una tienda;
- editar identidad, navegación, productos, categorías, assets y secciones;
- importar y exportar CSV;
- deshacer/rehacer y recuperar un draft;
- abrir preview home, categoría, producto, búsqueda, carrito y compra;
- guardar en `proyectos/` y recuperar después de reiniciar el servidor;
- generar HTML sin JavaScript, JSON-LD, sitemap, Merchant y contexto IA;
- seleccionar una variante, agregar al carrito y generar el mensaje WhatsApp.

## Qué probar ante cada tipo de cambio

> Validación diaria = `check:quick` + `test:e2e:smoke` (~2-3 min). Cierre/CI = `check:full` + `test:e2e` full + `benchmark:export` si toca exporter. Release (3 browsers + desktop:package) solo on-demand con Node 22.

| Cambio | Mínimo (quick) | Cierre recomendado |
| --- | --- | --- |
| Schema/migración | `check:quick` + tests de schema | `check:full`, `build`, E2E persistencia |
| Reducer/CSV | `check:quick` + tests de `core` | benchmark de catálogo |
| Módulo/estilo público | `check:quick` + tests de módulo | `test:e2e:smoke` + E2E responsive |
| Preview/Studio | `check:quick` (typecheck) | `test:e2e:smoke` / `test:e2e` |
| Guardado local | `check:quick` | ciclo real launcher + `test:e2e` |
| SEO/exporter | `check:quick` + tests de exporter | `benchmark:export`, E2E sin JS |

## Diagnóstico

- Un test E2E fallido deja reportes en `playwright-report/` y traces según la
  configuración de Playwright.
- `test:e2e:release` requiere los navegadores instalados y Node 22 en CI. No ejecutar en Node 24 (falla) ni como parte de `check:quick` — solo on-demand al cierre.
- El servidor de tests usa loopback; no debe apuntarse a una tienda publicada.
- Validación rápida diaria: `pnpm check:quick && pnpm test:e2e:smoke` (~2-3 min en 9800X3D, 8 workers). Cierre: `pnpm check && pnpm test:e2e`.
- Workers Playwright por defecto 8 (env `PLAYWRIGHT_WORKERS` para limitar a 6 si hay lag). Antes era 4.
- Para inspeccionar una exportación, usar `pnpm reference:export` o
  `pnpm pilot:export` y revisar el directorio indicado por el script.

## Gates del sitio generado y sus enganches (run acotado, 2026-08-14)

- `scripts/enganches.test.ts`: features del manifest vs atributo html,
  consistencia snapshot↔feed/sitemap/search/catalog-index, criticalCount del
  audit, reproducibilidad byte-a-byte (production y draft).
- `scripts/contratos.test.ts`: todo `moduleId` de las secciones existe en el
  registry de módulos.
- `scripts/contratos-profundos.test.ts`: design-family en el html, `productIds`
  derivados de categorías/colecciones, assets sin huérfanos, features
  declaradas, CSS de familias aislado, sitemap sin duplicados.
- `scripts/sitio-consistencia.test.ts`: draft útil con noindex/robots, robots
  draft vs production, preload LCP en todas las páginas con imagen.
- `scripts/seo-check.test.ts`: JSON-LD válido con URLs absolutas en páginas
  comerciales.
- `scripts/recursos-check.test.ts`: duplicación CSS V2 y videos con poster.
- `scripts/audit-scale.test.ts`: el audit del catálogo grande no degrada
  (regresión de O(n²)).
- `tests/e2e/axe-site.spec.ts`: axe-core en las rutas de los 3 fixtures
  (reference, catalogModern, catalogScale) — 0 violaciones.
- `tests/e2e/nojs-coverage.spec.ts`: 6 rutas × 2 fixtures × con/sin JS, con
  contenido útil y 0 errores de consola/red.
- `tests/e2e/focus-visible.spec.ts`: el foco del teclado es visible.
- `tests/e2e/interacciones.spec.ts`: agregar al carrito → carrito → checkout
  sin errores de consola.
- `tests/e2e/lcp-cold.spec.ts`: LCP con navegador frío (3 corridas, mediana).
- `tests/e2e/cdp-site.spec.ts`: long tasks/rAF del sitio exportado.
- `tests/e2e/qa-visual-sweep.spec.ts` y `qa-visual-modern.spec.ts`: capturas
  para barrido visual con la skill de visión (requieren `SOLARA_QA_VISUAL=1`
  para el sweep).
- `scripts/dedup-studio-css.mjs`: elimina reglas duplicadas exactas del CSS
  del Studio al construir (postbuild de `@solara/studio`).

## Estrategia futura

La suite local cubre límites de upload y del mapa de archivos del sitio,
rechazo de rutas relativas inválidas (traversal), interrupción antes de
publicar el manifest y recuperación de la versión anterior. Los fallos de
escritura se simulan de forma determinista con `writeGuard` (disco lleno,
permisos revocados y reintento tras fallo transitorio) y la matriz de reparse
points fija el rechazo de junctions/symlinks dentro de `proyectos/`. La
simulación OS real (disco lleno y permisos a nivel de volumen) queda reservada
para un job Windows de release, donde puede aislarse el volumen temporal sin
tocar proyectos confirmados.

## Portable Windows

El bucle mínimo del shell Electron es:

```powershell
corepack pnpm --filter @solara/desktop typecheck
corepack pnpm --filter @solara/desktop test
corepack pnpm desktop:build
corepack pnpm desktop:package
corepack pnpm test:e2e:portable
```

Los tests de `apps/desktop/tests/portable.test.mjs` cubren layout movible,
espacios/Unicode, paridad del handler HTTP/protocolo y rechazo de manifests con
rutas absolutas. `portable:smoke` abre dos instancias silenciosas y comprueba
perfiles, locks y `instance.json`. `scripts/portable-e2e.mjs` usa Playwright
Electron para abrir dos copias, guardar una tienda, comprobar que la otra no la
vea, verificar el sitio público confirmado, cerrar y reabrir desde disco y mover
la copia a una ruta con espacios y Unicode.

La suite no simula disco lleno ni permisos revocados del sistema operativo en
cada cambio; esos casos quedan documentados como matriz de release. El E2E
portable sí valida dos copias, Guardar, aislamiento, sitio público, traslado y
recuperación desde disco.

La prueba `test:e2e:portable:new-store` elimina sólo `.solara-runtime` de su copia
temporal antes de abrirla; así no reutiliza perfiles Electron stale. La matriz
MCP/JSONL del release debe ejecutarse contra el EXE portable, no contra módulos
fuente.

Evidencia de la sesión 2026-08-26: `check:quick` 6/6, smoke 129/129,
`check:runtime-serialization` 4/4 (fuera del sandbox por Access Denied de
esbuild), budget público con bytes no cero, benchmark 2.000 productos dentro de
48 MiB y los tres E2E portable (smoke, UI nueva y agente) verdes. Node 22 y el
full E2E quedan pendientes/bloqueados en este host.
