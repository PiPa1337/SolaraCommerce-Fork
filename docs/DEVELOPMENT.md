# Guía de desarrollo — SolaraCommerce

Esta guía cubre todo lo que un desarrollador (humano o agente) necesita para
ser productivo: cómo está organizado el código, qué pipeline sigue cada
cambio, y cómo las piezas se conectan entre sí.

## Requisitos

- Node.js 22+ y Corepack (pnpm 10.15.1)
- Windows 10/11 (el portable es Windows-only; el código Node es cross-platform)
- Chromium para Playwright E2E (`corepack pnpm playwright:install:chromium`)

## Setup inicial

```bash
git clone https://github.com/PiPa1337/SolaraCommerce-Fork.git
cd SolaraCommerce-Fork
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm dev          # abre Studio en http://localhost:4173
```

Para el lanzador administrado con persistencia en disco:

```cmd
Abrir SolaraCommerce.cmd
```

## Estructura del monorepo

```text
apps/
  studio/            Editor React + Vite (la app que usa el merchant)
  desktop/           Shell Electron para el portable Windows
packages/
  project-schema/    Zod schemas, fixtures, template (contrato de datos)
  core/              Reducer de dominio, HistoryState, CSV (sin navegador)
  module-sdk/        Helpers compartidos: escape, URLs, renderImage, safeHtml
  modules/           Registro de módulos + CSS generado (catalog-modern V1/V2)
  exporter/          Renderer HTML/CSS/JS del sitio público + servidor local
  storefront-runtime/ JS progresivo del sitio exportado (carrito, variantes...)
  site-optimizer/    Auditoría pura de SEO, media, Merchant y contexto IA
scripts/             Gates, budgets, benchmarks, preflight, release, launcher
tests/e2e/           Playwright specs (~131 archivos)
docs/                Documentación (este directorio)
```

### Flujo de dependencias (quién importa a quién)

```text
project-schema  ←── nada (fuente raíz)
core            ←── project-schema
module-sdk      ←── project-schema
modules         ←── project-schema, module-sdk
storefront-runtime ←── project-schema
site-optimizer  ←── project-schema
exporter        ←── TODOS los anteriores
studio          ←── exporter, core, project-schema, modules
```

**Regla:** nunca importar "hacia arriba" (ej: project-schema no importa de
exporter). Esto mantiene el schema puro y el exporter como único punto de
salida al HTML público.

## Pipeline de un cambio visual

Cuando editas cualquier texto, color o layout en Studio:

1. `HistoryState` recibe el cambio vía `executeCommand()` (@solara/core)
2. El proyecto validado se guarda como RecoveryDraft en IndexedDB (debounce)
3. Preview renderiza con `renderPreviewHtml()` usando los mismos módulos
4. Al guardar, `buildFiles()` genera el sitio completo (HTML, CSS, JS, assets)
5. El servidor local escribe a `proyectos/<tienda>/sitios/<versión>/`

El preview y el sitio exportado usan **el mismo renderer**. No hay divergencia.

## Pipeline de imágenes

Toda imagen que entra por Assets pasa automáticamente por:

```text
Upload → image.worker.ts → 8 variantes WebP responsive → responsiveSources
         (320/480/640/768/1024/1280/1600/1800px, quality 0.82)
         → fallback JPEG/PNG según transparencia
```

El exporter arma `<picture>` con `<source srcset>` por MIME y `sizes`
específico por módulo. Móvil recibe ~30-50KB, desktop ~100-200KB.

**Guard permanente:** `scripts/check-image-budget.mjs` falla si un PNG >200KB
aparece en `public/fixtures/`. Ver `docs/UI_SCALE.md` para la escala completa.

## Seeds de tienda

| Seed | Uso | Productos | Contenido |
| --- | --- | --- | --- |
| `"placeholder"` | Predeterminado (base generadora) | 5 genericos ("Producto 1"...) | Textos instructivos |
| `"clean"` | Tienda vacía nueva (Crear tienda) | 0 | Shell + textos instructivos |
| `"demo"` | Referencia interna / tests | 62 reales | Contenido completo |

El seed se valida en el schema Zod (`origin.seed`). Agregar uno nuevo requiere
extender el enum Y el switch en `buildCatalogModernProject()`.

## Comandos oficiales

```bash
# Iteración diaria (~80s, 6 gates en paralelo)
corepack pnpm check:quick

# Cierre o CI (~3-4 min)
corepack pnpm check:full
corepack pnpm test:e2e:smoke

# Release completo
corepack pnpm release   # check:full + smoke + desktop:package
```

Ver `docs/TESTING.md` para la lista completa de gates y budgets.
