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

## Verificación

```bash
corepack pnpm check
corepack pnpm build
corepack pnpm test:e2e
corepack pnpm benchmark:export
```

El benchmark exporta el fixture determinista de 1.000 productos y falla si supera
30 segundos. Playwright usa Chromium para el bucle local; la matriz completa y
Lighthouse se reservan para el gate de release.

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
