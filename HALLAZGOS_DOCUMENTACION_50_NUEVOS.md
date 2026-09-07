# 50 hallazgos nuevos de documentación

Fecha: 6 de septiembre de 2026.

Estado: **temporal y no autoritativo**. Este archivo registra una segunda tanda
de hallazgos concretos detectados después de las revisiones archivadas en
`docs/archive/reviews/2026-09-06-hallazgos-documentacion.md` y
`docs/archive/reviews/2026-09-06-optimizacion-documentacion.md`. No reemplaza a
`AGENTS.md`, `docs/TESTING.md`, los scripts de gates ni el código ejecutable.

El criterio de "nuevo" es que el problema concreto de archivo/fuente no estaba
enumerado como hallazgo aplicado en esas dos revisiones. Algunos pertenecen a
la misma familia general de drift, pero aquí se comprobaron contra el estado
actual del repositorio y se corrigieron en su ubicación específica.

| # | Hallazgo nuevo | Evidencia o fuente | Mejora aplicada | Archivo(s) |
| ---: | --- | --- | --- | --- |
| 1 | El ejemplo de piloto todavía sugería un respaldo `.solara.zip` como entrada normal. | El formato editable vigente es `.solara.json`; ZIP queda sólo como compatibilidad legacy. | Se cambió el ejemplo a `.solara.json` y se aclaró que el nombre de la variable de entorno se conserva por compatibilidad. | `.env.example` |
| 2 | `AGENTS.md` fijaba duraciones y cantidades de specs en comentarios de comandos que cambian con la suite. | `package.json` y `scripts/e2e-smoke.mjs` son la fuente ejecutable. | Se retiraron tiempos y conteos volátiles de los comentarios de comandos. | `AGENTS.md` |
| 3 | El checklist de `AGENTS.md` repetía la matriz completa de validación y podía divergir de la guía especializada. | `docs/TESTING.md` ya define el flujo proporcional. | El checklist ahora delega la matriz vigente a `docs/TESTING.md` y conserva sólo el contrato operativo. | `AGENTS.md` |
| 4 | El README proponía una secuencia amplia de `check`, build, budgets y benchmark para cualquier verificación. | `check:micro` y smoke son el flujo post-cambio vigente. | Se separó verificación post-cambio de cierre y se enlazó `docs/TESTING.md`. | `README.md` |
| 5 | El README decía que CI benchmarkeaba 1.000 productos, mientras el benchmark actual usa 2.000. | `package.json` y el test de benchmark usan la fixture de 2.000 productos. | Se corrigió la escala documentada a 2.000 productos. | `README.md` |
| 6 | El README describía el presupuesto temporal del benchmark pero omitía el límite de 48 MiB. | El benchmark ejecutable valida tiempo y tamaño. | Se documentaron ambos límites: 30 segundos y 48 MiB. | `README.md` |
| 7 | Los budgets iniciales de Studio del README seguían en 700 KiB JS y 100 KiB CSS. | `scripts/check-budgets.mjs` usa 720 KiB JS y 135 KiB CSS. | Se actualizaron los valores y se apuntó al script propietario. | `README.md` |
| 8 | El README todavía resumía el storefront con 52 KiB JS y 8 KiB CSS crudo. | Los guards actuales son JS 80 KiB, CSS exportado gzip 32 KiB y CSS V2 crudo 212 KiB. | Se reemplazó el snapshot antiguo por los contratos actuales y sus fuentes. | `README.md` |
| 9 | La explicación de release del README mezclaba el gate multinavegador con Lighthouse y fijaba política de retención en texto. | `.github/workflows/release.yml` es la autoridad de pasos y retención. | Se separó la matriz automatizada de las operaciones de RC y se delegó la política al workflow. | `README.md` |
| 10 | `docs/DEVELOPMENT.md` fijaba una cantidad aproximada de archivos E2E. | El inventario cambia al agregar o mover specs. | Se reemplazó el conteo por una descripción funcional de las suites. | `docs/DEVELOPMENT.md` |
| 11 | `docs/DEVELOPMENT.md` presentaba `check:quick` como iteración diaria principal. | `check:micro` es el gate proporcional post-cambio vigente. | Se documentó `check:micro` más smoke para iteración. | `docs/DEVELOPMENT.md` |
| 12 | `docs/DEVELOPMENT.md` fijaba duraciones aproximadas de gates. | Las duraciones dependen de hardware, caché y diff. | Se retiraron tiempos volátiles. | `docs/DEVELOPMENT.md` |
| 13 | El cierre de `docs/DEVELOPMENT.md` usaba smoke quick y no mostraba claramente smoke full más E2E funcional. | `package.json` y `docs/TESTING.md` distinguen post-cambio, cierre y release. | Se alineó el cierre con `check:full`, smoke full y `test:e2e`. | `docs/DEVELOPMENT.md` |
| 14 | `docs/PROJECT_MAP.md` recomendaba terminar tests unitarios con el alias genérico `pnpm check`. | El flujo actual usa un gate proporcional según alcance. | Se cambió la recomendación a `check:micro` y se enlazó `docs/TESTING.md`. | `docs/PROJECT_MAP.md` |
| 15 | El índice no listaba las decisiones arquitectónicas como documento navegable. | `docs/architecture-decisions.md` contiene ADRs vigentes. | Se agregó al índice con su propósito. | `docs/INDEX.md` |
| 16 | El índice omitía la guía de Live Canvas. | `docs/LIVE_CANVAS.md` es la referencia específica de esa capacidad. | Se agregó al índice. | `docs/INDEX.md` |
| 17 | El índice omitía la guía de seguridad. | `docs/SECURITY.md` es una referencia vigente. | Se agregó al índice. | `docs/INDEX.md` |
| 18 | La descripción de integraciones en el índice mencionaba migración ZIP sin dejar claro que es compatibilidad legacy. | `DATA_MODEL.md` e `INTEGRATIONS.md` limitan ZIP a migración única. | Se explicitó el carácter legacy de ZIP. | `docs/INDEX.md` |
| 19 | `docs/GUARDIANS.md` tenía el budget CSS de Studio en 112 KiB. | `scripts/check-budgets.mjs` usa 135 KiB. | Se actualizó el cuadro a 720 KiB JS y 135 KiB CSS. | `docs/GUARDIANS.md` |
| 20 | El guard de imágenes se describía como “PNG >200KB en fixtures” sin indicar el alcance exacto. | `scripts/check-image-budget.mjs` inspecciona `apps/studio/public/fixtures`. | Se documentó directorio y límite por archivo. | `docs/GUARDIANS.md` |
| 21 | El cuadro público de guardianes seguía en CSS V2 180 KiB y JS 64 KiB. | `scripts/public-storefront-budget.test.ts` usa CSS V2 212 KiB y JS 80 KiB. | Se actualizaron ambos límites y se añadió el CSS genérico de 780 KiB. | `docs/GUARDIANS.md` |
| 22 | `docs/GUARDIANS.md` no mostraba el guard separado de CSS exportado comprimido. | `scripts/storefront-runtime-budget.test.ts` limita CSS gzip a 32 KiB. | Se añadió el guard de runtime JS 80 KiB y CSS gzip 32 KiB. | `docs/GUARDIANS.md` |
| 23 | Los guardianes de seguridad se citaban sólo por basename y podían confundirse con specs homónimos. | Ambos viven en `packages/exporter/src/`. | Se escribieron las rutas completas de los specs. | `docs/GUARDIANS.md` |
| 24 | La fila de visión de storefront fijaba 11 rutas, 19 viewports y un conteo de PNG como contrato. | La matriz real vive dentro del spec y puede cambiar. | Se retiraron conteos y se describió la matriz como definida por el spec. | `docs/GUARDIANS.md` |
| 25 | La ruta de salida documentada para visión de storefront no coincidía con `testInfo.outputPath`. | El spec genera output dentro del directorio de resultados de Playwright. | Se corrigió la descripción del output. | `docs/GUARDIANS.md` |
| 26 | La fila de visión de Studio fijaba 9 pantallas por 4 viewports. | El spec es la autoridad de pantallas y viewports. | Se reemplazó el conteo por una descripción estable de la cobertura. | `docs/GUARDIANS.md` |
| 27 | La ruta de salida de visión de Studio estaba documentada como `screenshots/studio-vision/`. | La salida vigente está bajo `test-results/studio-vision/`. | Se corrigió la ruta. | `docs/GUARDIANS.md` |
| 28 | El encabezado de `storefront-deep-vision.spec.ts` decía “8 viewports” aunque la matriz se define en `VIEWPORTS`. | El propio array es la fuente de verdad. | El comentario ahora remite a `VIEWPORTS` sin fijar cantidad. | `tests/e2e/__vision__/storefront-deep-vision.spec.ts` |
| 29 | El mismo spec justificaba aislamiento de output con “ocho workers”. | Playwright tiene 3 workers por defecto y override configurable. | Se cambió a “workers en paralelo” sin congelar una cifra. | `tests/e2e/__vision__/storefront-deep-vision.spec.ts` |
| 30 | `visual-break.spec.ts` explicaba contención suponiendo una suite de 8 workers. | La concurrencia actual es configurable. | Se conservó la razón del timeout y se retiró el número obsoleto. | `tests/e2e/visual-break.spec.ts` |
| 31 | `axe-site.spec.ts` también justificaba su timeout con una suite fija de 8 workers. | El comportamiento relevante es la alta concurrencia, no una cantidad histórica. | Se volvió neutral el comentario respecto de workers. | `tests/e2e/axe-site.spec.ts` |
| 32 | `docs/STOREFRONT_V2.md` mantenía budgets de 104 KiB CSS y 53 KiB JS. | Los guards actuales son 212 KiB CSS V2 y 80 KiB JS. | Se actualizaron y se remitió a scripts como autoridad. | `docs/STOREFRONT_V2.md` |
| 33 | `docs/STOREFRONT_V2.md` fijaba trece rutas y seis resoluciones responsive. | Los specs activos poseen la matriz real. | Se quitó la matriz hardcodeada y se delegó en testing/specs. | `docs/STOREFRONT_V2.md` |
| 34 | La evidencia de Node 22 en `STOREFRONT_V2.md` podía leerse como certificación vigente. | El contrato release actual exige Node 24.x. | Se delimitó Node 22 como evidencia histórica y Node 24 como contrato activo. | `docs/STOREFRONT_V2.md` |
| 35 | `docs/STOREFRONT_ARCHITECTURE.md` afirmaba que visión cubría exactamente 19 viewports. | El spec declara la matriz y puede evolucionar. | Se reemplazó el conteo por referencia al spec. | `docs/STOREFRONT_ARCHITECTURE.md` |
| 36 | `docs/TESTING.md` prometía que `check:micro` duraba menos de tres minutos. | Esa cifra no es un contrato ejecutable. | Se retiró la duración y se mantuvo la composición del gate. | `docs/TESTING.md` |
| 37 | `docs/TESTING.md` fijaba 5 y 15 specs junto con 20–40 segundos para smoke. | Los scripts de smoke son la autoridad de selección y costo. | Se dejaron nombres funcionales de smoke quick/full sin conteos ni tiempos. | `docs/TESTING.md` |
| 38 | `docs/TESTING.md` congelaba 447/79 y 609/75 como tamaños de las suites funcional y audit. | Los conteos cambian con la suite. | Se retiraron cifras observacionales de los comandos oficiales. | `docs/TESTING.md` |
| 39 | La matriz release documentaba 1.056, 1.082 y 154 ejecuciones/archivos como contrato. | La configuración de Playwright y los scripts determinan la matriz real. | Se sustituyeron números por la definición funcional de Chromium y el subconjunto Firefox/WebKit. | `docs/TESTING.md` |
| 40 | La sección “Smoke ampliado” repetía casi exactamente el contenido de smoke full. | `test:e2e:smoke:full` ya nombra el contrato. | Se eliminó la duplicación y se conservó sólo qué queda fuera del smoke full. | `docs/TESTING.md` |
| 41 | El final de `docs/TESTING.md` volvía a repetir comandos, tiempos y un ejemplo de 8 workers. | La tabla “Qué probar ante cada tipo de cambio” ya es la matriz canónica. | Se delegó a esa tabla y se dejó `PLAYWRIGHT_WORKERS=N` como override explícito. | `docs/TESTING.md` |
| 42 | `docs/release-candidate.md` reimplementaba manualmente los pasos internos de `release`. | `package.json` ya compone `check:full`, smoke full y E2E release. | Se reemplazó la cadena duplicada por `corepack pnpm release`. | `docs/release-candidate.md` |
| 43 | La guía de RC mezclaba gate automatizado, artefactos y política de workflow en una sola receta. | `release`, `reference:export`, `release:manifest` y el workflow tienen responsabilidades distintas. | Se separó el gate de la preparación de artefactos y se delegó triggers/retención al workflow. | `docs/release-candidate.md` |
| 44 | `docs/pilot-checklist.md` repetía una cadena vieja de check, build, budgets y benchmark. | `corepack pnpm release` ya es el gate canónico de release. | Se simplificó la preparación a instalación de navegadores, `release` y `pilot:preflight`. | `docs/pilot-checklist.md` |
| 45 | El checklist de piloto no diferenciaba bien fixture de referencia, respaldo real, `.release/pilot-site/` y la versión confirmada bajo `proyectos/`. | El flujo real distingue validación temporal de publicación elegida. | Se aclaró qué valida cada salida y que `.release/pilot-site/` no sustituye la versión confirmada en `proyectos/`. | `docs/pilot-checklist.md` |
| 46 | ADR-005 podía hacer parecer que “1.000 productos y 5 s” era el máximo soportado. | Ese número sólo decide cuándo evaluar caché incremental. | Se aclaró que es un umbral de optimización y no cambia la especificación de catálogo. | `docs/architecture-decisions.md` |
| 47 | Una deuda activa describía `check:quick` como ocho paquetes en paralelo. | `scripts/check-quick.mjs` limita actualmente la concurrencia a 2. | Se preservó la observación histórica y se recontextualizó contra la concurrencia vigente. | `docs/TECHNICAL_DEBT.md` |
| 48 | La deuda seguía tratando márgenes de runtime de ~52/53 KiB y Studio CSS de 100 KiB como riesgos actuales. | Los guards vigentes son runtime JS 80 KiB y Studio CSS 135 KiB. | Se revalidaron las filas, se bajó la severidad del margen histórico y se remitió a medición actual antes de optimizar. | `docs/TECHNICAL_DEBT.md` |
| 49 | `CHANGELOG.md` contenía enlaces Markdown a planes históricos que ya no existen en el árbol activo. | Las rutas `docs/superpowers/plans/...` referidas por esas entradas estaban retiradas. | Se conservó el texto histórico, pero se quitaron enlaces muertos sin inventar destinos. | `CHANGELOG.md` |
| 50 | Comentarios y metadata auxiliares de budgets todavía repetían topes históricos de 64/68 KiB JS y 8 KiB CSS. | Los asserts actuales usan JS 80 KiB y CSS exportado gzip 32 KiB. | Se actualizaron comentarios de los tests y la lista de guards del diagnóstico de rendimiento a los límites ejecutables actuales. | `scripts/storefront-runtime-budget.test.ts`, `scripts/public-storefront-budget.test.ts`, `scripts/rm-performance-node.test.ts` |

## Nota de alcance

No se cambió el máximo funcional de productos soportados. El valor de 2.000
productos documentado para benchmark es una escala de estrés; no sustituye el
máximo de catálogo definido por la especificación del producto.

Las correcciones de esta tanda son documentales o de comentarios/metadata de
tests. No modifican renderer, schema, persistencia, storefront ni comportamiento
de la aplicación.
