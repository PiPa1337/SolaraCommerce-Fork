# Fase 7 completada: movimiento premium accesible

## Objetivo

Agregar movimiento declarativo sin alterar el HTML indexable, sin ocultar
contenido cuando falla JavaScript y sin introducir una dependencia de timelines.

## Entregado

- Cada root de modulo publica preset, intensidad, distancia, punto de entrada y
  politica `once` como atributos y variables CSS deterministas.
- `IntersectionObserver` activa las zonas cuando alcanzan su punto de entrada y
  repite el estado cuando `once` esta desactivado.
- `scroll-progress` y `parallax` usan CSS Scroll-driven Animations cuando el
  navegador las soporta.
- Fallback JS de parallax/progreso con un solo `requestAnimationFrame` pendiente,
  listeners pasivos y sin scroll-jacking.
- Intensidad aplicada a fade-up, slide y scale mediante variables CSS.
- Reduccion automatica de parallax y layer-stack en pantallas pequenas.
- `prefers-reduced-motion` deja todos los estados finales visibles y detiene
  progreso, parallax y transiciones.
- La salida sin JavaScript conserva el contenido visible porque el estado
  inicial no depende de `data-motion-ready`.

## Contratos preservados

- No cambian `StoreProjectV1`, `schemaVersion`, `ModuleDefinition`, settings ni
  formatos de exportacion.
- Las zonas animables siguen declaradas por cada modulo; no existe seleccion
  arbitraria de DOM ni editor libre de timelines.
- Carrito, variantes, WhatsApp, SEO, sitemaps y feed conservan su comportamiento.
- El runtime continua por debajo del presupuesto de 35 KB gzip.

## Verificacion de cierre

- Tests del SDK para atributos declarativos de movimiento.
- Tests del runtime para IntersectionObserver, scroll pasivo, RAF, CSS y reduced
  motion.
- Playwright verifica intensidad, punto de entrada, inView y contenido visible
  con movimiento reducido en storefront.
- Gate de fase:
  - `corepack pnpm check`
  - `corepack pnpm build`
  - `corepack pnpm benchmark:export`
  - `corepack pnpm test:e2e` (17/17 Chromium)

## Proxima fase

Hardening de release candidate: recuperacion de proyectos, sanitizacion en
fronteras, CSP, accesibilidad, stress de 1.000 productos, bundle budgets,
Lighthouse CI y matriz de navegadores.
