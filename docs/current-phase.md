# Fase 4 completada: sistema visual premium editorial

## Objetivo

Unificar Studio y el storefront de referencia bajo una dirección editorial
cálida sin cambiar contratos, comportamiento ni dependencias.

## Entregado

- Tokens marfil, tinta y musgo con superficies, bordes, radios y sombras jerárquicos.
- Tipografía serif nativa para títulos y sans para controles y datos.
- Modos claro y oscuro, foco visible y movimiento reducido.
- Dashboard editorial, creación de tienda jerarquizada y proyectos en formato ledger.
- Topbar, navegación, preview, constructor, catálogo y paneles secundarios refinados.
- Undo/redo preservado en móvil y acciones del constructor con targets accesibles.
- Doce módulos oficiales rediseñados con CSS aislado.
- Heroes dividido/editorial y grillas editorial/compacta visualmente diferenciados.
- Fixture Casa Luma actualizado sólo en sus tokens visuales.
- QA Playwright a 1440, 1024 y 390 px, storefront desktop/móvil y cinco capturas de revisión.

## Contratos

- `StoreProjectV1`, `ModuleDefinition`, settings, IDs y schemas no cambian.
- HTML semántico, SEO, carrito, WhatsApp y formatos ZIP no cambian.
- No se agregan dependencias, fuentes web, imágenes ni presets de movimiento.

## Verificación de cierre

- `corepack pnpm check`
- `corepack pnpm build`
- `corepack pnpm benchmark:export`
- `corepack pnpm test:e2e`

## Próxima fase

Pipeline de imágenes responsive en Web Worker con caché por hash, sin ampliar
todavía SEO, movimiento ni publicación.
