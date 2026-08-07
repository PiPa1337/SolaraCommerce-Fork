# Handoff de SolaraCommerce

## Estado al entregar

SolaraCommerce es un estudio local-first que permite crear tiendas desde la
plantilla Catalog Modern, editar identidad, contenido, productos, categorías,
assets, tema y SEO, revisar un preview y exportar una tienda estática. La demo
`Predeterminado` usa el catálogo ficticio determinista; la plantilla limpia no
copia sus productos.

La aplicación funciona sin backend remoto. Cuando se abre con
`Abrir SolaraCommerce.cmd`, el servidor loopback guarda versiones en
`proyectos/`; IndexedDB queda como borrador de recuperación y caché. El ZIP de
proyecto se puede volver a importar y la carpeta pública puede servirse en un
hosting estático. El pedido se deriva a WhatsApp.

## Funcionalidades terminadas

- workspace pnpm con TypeScript estricto, Vite, Vitest, Biome y Playwright;
- schema Zod v2 con productos, variantes, categorías jerárquicas, colecciones,
  páginas, navegación, assets y templates comerciales;
- reducer de comandos, undo/redo, importación/exportación CSV y fixture de
  rendimiento;
- módulos legacy y familia Catalog Modern con renderer compartido;
- preview responsive y exportación HTML/CSS/JS/ZIP;
- SEO inicial, JSON-LD, sitemap, image/video sitemap, Merchant y contexto IA
  opcional;
- carrito local, selección de variantes y pedido determinista por WhatsApp;
- dashboard, flujo guiado, catálogo, constructor, tema, assets, SEO y export;
- guardado local versionado y transaccional mediante el servidor loopback.

## Incompleto o fuera de alcance

- no hay backend remoto, pagos online, colaboración, sincronización cloud ni
  publicación automática;
- la aprobación de Merchant con checkout sólo por WhatsApp debe verificarse en
  el dominio real;
- no hay fault injection completo para disco lleno, permisos revocados o
  interrupciones del filesystem;
- release multi-browser y Lighthouse dependen de Node 22 y navegadores
  instalados; no se ejecutan necesariamente en cada cambio local;
- algunos componentes grandes y la extracción ZIP síncrona permanecen como
  deuda documentada en [`docs/TECHNICAL_DEBT.md`](docs/TECHNICAL_DEBT.md).

## Decisiones que no deben romperse

1. `StoreProjectV2Schema` y `schemaVersion: 2` son el contrato persistido.
2. Preview y ZIP llaman al mismo renderer de `@solara/exporter`.
3. `productIds` derivados se recalculan desde comandos/helpers, no a mano en UI.
4. Precios en centavos enteros; nunca floats comerciales.
5. Assets y proyectos son datos no confiables: validar, escapar y deduplicar.
6. Los módulos no compilan código del usuario en el navegador.
7. `proyectos/` no se versiona en Git y el servicio sólo escucha loopback.
8. Los cambios de schema requieren migración y pruebas de round-trip.

## Archivos modificados durante este handoff

- `AGENTS.md`: guía operativa para futuras IAs y reglas de entrega.
- `README.md`: instalación, variables, comandos, arquitectura y troubleshooting.
- `docs/ARCHITECTURE.md`: capas y flujos con diagramas.
- `docs/DATA_MODEL.md`: entidades, relaciones y versionado.
- `docs/INTEGRATIONS.md`: API local e integraciones del storefront.
- `docs/PROJECT_MAP.md`: rutas de extensión por funcionalidad.
- `docs/TESTING.md`: niveles de verificación y flujos críticos.
- `docs/TECHNICAL_DEBT.md`: riesgos observados sin refactor riesgoso.
- `docs/backup-and-recovery.md`: autoridad de disco frente a recovery de IDB.
- `.env.example`: variables opcionales documentadas sin secretos.
- archivos fuente principales: comentarios de módulo y TSDoc de los flujos
  complejos, workers y servicios, sin cambiar lógica.

## Validaciones realizadas

Se ejecutaron con resultado exitoso:

- `corepack pnpm check`: scan de repository, formato, typecheck, tests de todos
  los paquetes y optimizer (19 project-schema, 23 core, 6 module-sdk, 6
  storefront-runtime, 6 site-optimizer, 13 modules, 38 exporter y 29 Studio).
- `corepack pnpm build`: TypeScript y build Vite de Studio.
- `corepack pnpm test:e2e`: 38 tests Chromium pasaron y 1 prueba visual opcional
  fue omitida por no definir `VISUAL_REVIEW_STAGE`.
- `corepack pnpm benchmark:export`: 1.000 productos en 1.211 ms, 998 archivos,
  ZIP de 4.872.032 bytes.
- `corepack pnpm check:budgets`: Studio JS gzip 183.180 B, CSS gzip 13.061 B,
  runtime público JS gzip 9.499 B y CSS gzip 1.497 B.
- `corepack pnpm pilot:preflight`: fixture de referencia, 27 páginas y 3
  ofertas.
- `corepack pnpm check:repository`, `corepack pnpm format:check` y
  `git diff --check` sin errores.

`corepack pnpm test:e2e:release` fue intentado y no se ejecutó porque el script
exige Node 22 y este entorno tiene Node 24.18.0. La matriz Firefox/WebKit y
Lighthouse quedan por confirmar en CI/Node 22.

## Errores y riesgos observados

- El entorno local puede tener Node 24 aunque CI/release fija Node 22.
- La carpeta `proyectos/` y reportes locales son deliberadamente ignorados.
- La extracción ZIP síncrona y las pruebas de interrupción requieren trabajo
  posterior.
- Un conflicto de guardado entre pestañas devuelve 409 y no se combina solo.

## Próximos pasos recomendados

1. Ejecutar el ciclo real del launcher en un perfil limpio y confirmar recuperar
   `Predeterminado` desde `proyectos/`.
2. Añadir fault injection del servicio local antes de cambiar su seguridad.
3. Probar release con Node 22, Firefox, WebKit y Lighthouse.
4. Medir exportación de 1.000 productos antes de introducir cache incremental.
5. Si se necesita cloud, diseñar una capa nueva sin convertirla en requisito del
   storefront estático.

## Lectura sugerida para la siguiente IA

1. `AGENTS.md`.
2. `README.md` y `docs/PROJECT_MAP.md`.
3. `docs/ARCHITECTURE.md` y `docs/DATA_MODEL.md`.
4. El documento específico del cambio y sus tests.
5. `docs/TECHNICAL_DEBT.md` sólo para riesgos relevantes al trabajo.
