# SolaraCommerce

SolaraCommerce es un estudio local-first para crear, administrar y exportar tiendas
estáticas con carrito y pedidos por WhatsApp.

## Abrir en Windows

Hacer doble clic en [`Abrir SolaraCommerce.cmd`](Abrir%20SolaraCommerce.cmd). El
lanzador prepara la aplicación si hace falta, inicia el servidor local y abre el
navegador predeterminado.

## Requisitos

- Node.js 22 o posterior
- Corepack
- pnpm 10.15.1, fijado por el repositorio

## Desarrollo

```bash
corepack prepare pnpm@10.15.1 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm dev
```

La aplicación guarda los proyectos en IndexedDB. Las tiendas públicas se exportan
como ZIP estáticos, sin backend ni runtime de inteligencia artificial.

## Catálogo

Cada tienda admite productos con múltiples variantes, categorías, colecciones,
tags, disponibilidad e identificadores comerciales. El catálogo ofrece:

- edición completa de producto y variantes;
- acciones masivas de estado, precios, organización y tags;
- paginación de 25, 50 o 100 filas;
- selección entre páginas y resultados filtrados;
- CSV procesado en Web Worker con revisión antes de reemplazar datos;
- undo/redo y autosave serializado antes de salir de Studio.

`StoreProjectV1` valida IDs, slugs, referencias e índices derivados. Una operación
inválida se rechaza completa y no deja cambios parciales.

## Constructor modular

Las secciones se agregan, ordenan, duplican, ocultan, reemplazan y eliminan desde
Studio. Cada módulo oficial declara su schema Zod y la metadata tipada que genera
el inspector; Studio no infiere controles ni mantiene defaults paralelos.

El reemplazo conserva únicamente contenido compatible. Preview y ZIP usan el
mismo renderer semántico, deduplican estilos de módulos activos y rechazan un
proyecto inválido antes de guardarlo o exportarlo.

## Verificación

```bash
corepack pnpm check:repository
corepack pnpm check
corepack pnpm build
corepack pnpm test:e2e
corepack pnpm benchmark:export
```

El benchmark exporta el fixture determinista de 1.000 productos y falla si supera
30 segundos. Playwright usa Chromium para el bucle local; la matriz completa y
Lighthouse se reservan para el gate de release.

Los tests de Studio usan una IndexedDB en memoria para comprobar guardado,
reapertura, duplicación, archivo, restauración y ráfagas de autosave sin depender
de un navegador durante el bucle unitario.

## Integración continua

[GitHub Actions](https://github.com/PiPa1337/SolaraCommerce/actions/workflows/ci.yml)
ejecuta sobre Windows, Node 22 y pnpm 10.15.1:

1. instalación con lockfile congelado;
2. revisión de secretos y archivos mayores a 10 MB;
3. formato, TypeScript y unit tests;
4. build y benchmark de 1.000 productos;
5. Playwright Chromium sin reconstruir Studio.

Si Playwright falla, el workflow conserva durante siete días el reporte HTML,
traces y resultados disponibles. Una ejecución exitosa no publica artefactos.

## Paquetes

- `apps/studio`: PWA de administración.
- `packages/project-schema`: contrato versionado del proyecto.
- `packages/core`: comandos deterministas y operaciones de catálogo.
- `packages/module-sdk`: contrato seguro para módulos visuales.
- `packages/modules`: módulos oficiales.
- `packages/storefront-runtime`: carrito, WhatsApp y movimiento progresivo.
- `packages/exporter`: HTML, SEO, feed Merchant y archivos ZIP.

La especificación funcional y el alcance están en
[`docs/product-spec.md`](docs/product-spec.md).

La operación segura está documentada en
[`docs/backup-and-recovery.md`](docs/backup-and-recovery.md), y el piloto real en
[`docs/pilot-checklist.md`](docs/pilot-checklist.md).
