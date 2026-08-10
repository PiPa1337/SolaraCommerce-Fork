# Auditoría funcional de botones del editor y la app — 2026-08-10 — Implementation Plan

> **Para agentes:** SUB-SKILL REQUERIDA: `superpowers:subagent-driven-development` o `superpowers:executing-plans`. **Ejecución: ola 1 = 8 agentes de caza en simultáneo; ola 2 = ~14 agentes de fix en simultáneo; cierre = verificación, docs, gates, push.**

**Goal:** Garantizar que TODOS los controles de la UI (editor de páginas/Builder y el resto de la app) funcionen: cada botón, toggle, select y checkbox debe ser accionable y producir el cambio que promete, con aserción de regresión por área.

**Architecture:** (1) Caza conductual con 8 agentes — cada uno CLICKEA cada control de su área con Playwright contra el dev server y produce la matriz botón → efecto esperado → efecto real → veredicto, marcando cobertura E2E existente; (2) 14 agentes de fix por propiedad de archivos, cada uno corrige TODOS los hallazgos de su área y agrega una aserción de regresión (spec propio); (3) verificación: spec de matriz de interacción + revisión final + gates.

**Tech Stack:** Node 22+ (release), pnpm 10.15.1 vía `corepack`, Vitest 3.2.4, Playwright Chromium (4 workers ya activos), React 19.

## Global Constraints

- No modificar `StoreProjectV2Schema` ni `schemaVersion: 2`; ningún fix puede requerir cambio de schema (si un botón valida contra el schema y el schema está bien, el botón debe mostrar el error, no romperse).
- No agregar dependencias de runtime.
- Presupuestos intactos: Studio JS ≤ 700 KiB (634.8), Studio CSS ≤ 100 KiB (99.2), storefront.js ≤ 52 KiB, storefront.css ≤ 780 KiB. El serializado (`runtime-serialization`) verde.
- Regla de oro de la caza: **evidencia por click real** (Playwright), no sólo lectura de código. Cada hallazgo: `file:line` + qué se clickeó + qué cambió (o no).
- Un botón "roto" = click sin efecto observable, efecto incorrecto (cambia lo que no debe), efecto que no persiste (se pierde al navegar/deshacer), o error no manejado que deja la app en blanco.
- Los controles que YA están correctos se registran como OK con su evidencia — el entregable es la MATRIZ completa, no sólo bugs.
- Gates por task: `corepack pnpm --filter <paquete> test` + `typecheck` + E2E propio (specs existentes + los nuevos). Cierre: `check`, `build`, `check:budgets`, `benchmark:export`, `test:e2e` (157+ nuevos), `test:e2e:portable`, `git diff --check`, `check:repository`, ejecutables.
- Commits breves en español, uno por task, `git add` explícito. Reportes `.superpowers/sdd/` nunca al commit. No correr `format:check` global; biome sólo sobre archivos propios.
- **Ola paralela:** si `git commit` falla por `index.lock`, esperar 3 s y reintentar hasta 5 veces. No tocar archivos de otras tareas (tabla de propietarios). Especs nuevos para escenarios nuevos; los specs existentes de otra área no se tocan.
- Windows + PowerShell; sin bash, sin rg (Select-String). 0 U+FFFD.
- E2E ya corre con 4 workers (`playwright.config.ts`); los agentes de caza usan `corepack pnpm --filter @solara/studio build` una vez y luego corren specs puntuales con `corepack pnpm exec playwright test <spec>`.

## OLA 1 — CAZA (8 agentes, simultáneos)

Cada agente de caza: (a) lee el código de su área (findings estáticos), (b) CLICKEA cada control con Playwright (patrón de boot de `editor-smoke.spec.ts`/`studio-server.ts`), (c) produce `.superpowers/sdd/acciones-hN-report.md` con la MATRIZ completa: | # | Control (testid/nombre) | Acción | Efecto esperado | Efecto real | Veredicto OK/BUG | Evidencia file:line | Cobertura E2E existente (spec:test) |, (d) reporta en <15 líneas: OK count, BUG count, top bugs.

### H1 — Builder: picker y controles del inspector — [AGENTE H1]
**Área:** `apps/studio/src/features/Builder.tsx`, `features/builder/SettingsInspector.tsx`, `RepeaterEditor.tsx`, `packages/modules` (metadata de controles). Clickea: abrir "Agregar sección" (picker), buscar módulo, seleccionar, cancelar, fuera-click, foco; TODOS los tipos de control del inspector (text, textarea, number, select, toggle, slider, color, image, repeater): editar valor → ¿cambia el proyecto/preview? ¿se valida? errores de schema visibles; "Restaurar valores por defecto"; sección con schema inválido. Verifica que cada control efectivamente modifique el estado (preview + JSON del proyecto vía `page.evaluate` si hace falta).

### H2 — Builder: operaciones de sección — [AGENTE H2]
**Área:** operaciones de sección (en Builder.tsx y helpers de `packages/modules`/`@solara/core`): duplicar sección (¿aparece una copia con ids nuevos? ¿en el slot correcto?), reemplazar (¿cambia módulo? ¿conserva settings compatibles?), mover arriba/abajo (¿cambia el orden en preview?), eliminar (¿desaparece? ¿undo la trae?), slots (agregar a slot X va al slot X), undo/redo de cada operación, secciones por página vs globales (¿editar en Home no toca About?).

### H3 — Shell del Studio — [AGENTE H3]
**Área:** `apps/studio/src/features/Studio.tsx` + `App.tsx` (navegación). Clickea: tabs (Catálogo/Preparar/Resumen/Exportar/SEO/Assets/Config según existan — ¿cada una cambia el panel y persiste el estado?), focus mode on/off (¿qué cambia visualmente? ¿se restaura al salir?), theme toggle claro/oscuro/auto (¿cambia `data-theme` y persiste?), pane open/close (¿el preview crece?), breadcrumb "Volver a tiendas" (¿vuelve al dashboard?), botón Guardar (modo navegador: ¿indica "Guardado"?), undo/redo del shell, atajos (Ctrl+Z, Ctrl+S en ambos modos si aplica), modo avanzado (¿muestra/oculta el flujo guiado?).

### H4 — Catálogo — [AGENTE H4]
**Área:** `features/catalog/**` (Catalog.tsx, CatalogToolbar, ProductEditor, CategoryTree, workers CSV). Clickea: búsqueda (¿filtra?), filtros de estado, orden (¿reordena de verdad?), toggle de columnas (¿agrega/quita columnas?), selección múltiple, bulk: ajuste de precios (¿cambia precios en productos seleccionados? ¿valida -100%?), cambiar estado (¿archiva/activa?), eliminar/archivar (¿desaparece con confirmación? ¿undo?), exportar/importar CSV (¿resultados por fila?), reemplazar catálogo (¿resetea con confirmación?), árbol de categorías (reparentar, bloqueos), editor de producto: guardar (¿persiste el cambio en el catálogo? ¿en preview?), cancelar (¿descarta?), variantes (agregar/duplicar/quitar — ¿cambia el producto?), toggle disponibilidad/estado del producto.

### H5 — Assets — [AGENTE H5]
**Área:** `features/Assets.tsx` + `lib/assetUses.ts`. Clickea: subir imagen/video (¿aparece en la lista? ¿en el lote?), dropzone (¿acepta drop?), detalle de asset (¿abre panel con usos?), reemplazar (¿cambia el archivo manteniendo id?), eliminar con usos (¿bloqueado con mensaje?) y sin usos (¿desaparece?), buscar/filtrar assets, el contador de usos (¿coincide con el proyecto?).

### H6 — Export — [AGENTE H6]
**Área:** `features/Export.tsx` + `workers/export.worker.ts`. Clickea: exportar draft (¿produce sitio? ¿aviso honesto?), exportar producción con críticos (¿bloqueado?) y sin críticos (¿funciona?), checklist SEO (¿toggle persiste?), re-auditar (¿actualiza contadores?), descargar respaldo `.solara.json` (¿descarga real?), importar respaldo (¿pide confirmación y reemplaza?), limpiar historial (¿se vacía la lista?), abrir sitio (¿abre pestaña?), el panel de etapas (¿progreso real?).

### H7 — Dashboard — [AGENTE H7]
**Área:** `features/Dashboard.tsx` + `dashboard/*`. Clickea: Nueva tienda (¿crea y aparece?), abrir (¿entra al editor?), duplicar (¿copia con id nuevo?), archivar (¿se mueve a archivadas?), respaldo (¿descarga?), comparar (¿selecciona 2+ y el compare bar actúa?), pin (¿persiste entre recargas?), búsqueda (¿filtra?), filtro estado (¿activas/archivadas/todas?), orden (¿nombre/fecha/productos?), vista grilla/lista (¿cambia layout?), chips de salud (¿abren algo?), cerrar app (¿diálogo? ¿apaga?).

### H8 — SEO/Theme/Overview/Guided — [AGENTE H8]
**Área:** `features/Seo.tsx`, `ThemeEditor.tsx`, `Overview.tsx`, `GuidedOverview.tsx`. Clickea: SEO (campos por página, verificación, guardado implícito → ¿persiste?), Theme (presets — ¿aplican paleta real?, reset colores/tipografía/geometría — ¿vuelven los defaults?, campos de color — ¿validan?), Overview/Preparar (campos guiados, "Siguiente"/"Volver", requisitos — ¿marcan progreso?, aplicar actualización — ¿cambia el proyecto?), alternar guiado/manual.

## OLA 2 — FIX (14 agentes, simultáneos; cada uno corrige los BUG de su área de la caza y agrega aserciones de regresión)

Reglas comunes de fix: cada BUG de la matriz de su área se corrige (el control hace lo que promete); cada fix lleva su aserción (spec nuevo `tests/e2e/ui-acciones-<area>.spec.ts` o extensión de un spec PROPIO del área — nunca specs ajenos); si un hallazgo resultó ser comportamiento intencional, se documenta en el reporte y la matriz queda OK con nota.

| # | Propietario (archivos EXCLUSIVOS) | Área de fixes |
|---|---|---|
| F1 | `apps/studio/src/features/Builder.tsx` + `features/builder/**` | Hallazgos H1+H2 del Builder (picker, inspector, operaciones de sección) |
| F2 | `apps/studio/src/features/Studio.tsx` | Hallazgos H3 del shell (tabs, focus, theme, pane, guardar, undo/redo) |
| F3 | `apps/studio/src/App.tsx` + `main.tsx` | Hallazgos H3 de navegación/App + atajos globales |
| F4 | `apps/studio/src/features/catalog/Catalog.tsx` + `CatalogToolbar.tsx` | Hallazgos H4 (toolbar, bulk, CSV) |
| F5 | `apps/studio/src/features/catalog/ProductEditor.tsx` + `product/*` | Hallazgos H4 (form de producto, variantes) |
| F6 | `apps/studio/src/features/catalog/CategoryTree.tsx` | Hallazgos H4 (árbol de categorías) |
| F7 | `apps/studio/src/features/Assets.tsx` | Hallazgos H5 |
| F8 | `apps/studio/src/features/Export.tsx` | Hallazgos H6 |
| F9 | `apps/studio/src/features/Dashboard.tsx` + `dashboard/*` | Hallazgos H7 |
| F10 | `apps/studio/src/features/Seo.tsx` + `ThemeEditor.tsx` | Hallazgos H8 (SEO + tema) |
| F11 | `apps/studio/src/features/Overview.tsx` + `GuidedOverview.tsx` | Hallazgos H8 (flujo guiado) |
| F12 | `apps/studio/src/components/*` + `base/components.css` | Hallazgos de controles compartidos (si la caza reporta botones/toggles comunes rotos) |
| F13 | `packages/core/src/index.ts` + tests | Hallazgos de comandos del dominio (si un botón no cambia porque el command falla o no muta) |
| F14 | `tests/e2e/ui-matriz-interaccion.spec.ts` (NUEVO) | Spec de matriz: recorre los controles clave de TODAS las áreas con aserción de efecto real (construido con la matriz de la caza) |

## CIERRE

### Task C1 — Docs — [Agente docs]
`TECHNICAL_DEBT.md`: filas resueltas/nuevas de la caza (botones rotos → resueltos con commit; intencionales → nota); `CHANGELOG.md`: entrada "Auditoría funcional de controles (2026-08-10)"; `HANDOFF.md`: resumen de la matriz (OK/BUG counts por área).

### Task C2 — Revisión final — [Agente review]
Revisar `planBase..HEAD` contra el plan; verificar: cada BUG de la caza tiene su fix + aserción, matriz completa en los reportes, presupuestos, `.only(`, U+FFFD, propiedad de archivos. Veredicto APPROVED/CHANGES.

### Task C3 — Gates y publicación — [Controlador]
`corepack pnpm check` · `build` · `check:budgets` · `benchmark:export` · `test:e2e` (incluye `ui-matriz-interaccion` y los specs nuevos) · `test:e2e:portable` · `git diff --check` · `check:repository` · ejecutables (`desktop:build`, `desktop:package`, `portable:smoke`) · push.

---

## Self-Review (autor)

- **Cobertura:** todas las áreas interactivas de la app cubiertas por la caza (Builder×2, shell, catálogo×3, assets, export, dashboard, SEO/tema/guía) y por los fixes (14 propietarios disjuntos). El spec F14 materializa la matriz como gate duro.
- **Contratos:** sin cambios de schema; presupuestos intactos; E2E ya paralelo (4 workers).
- **Riesgo:** la caza puede encontrar decenas de hallazgos menores — los fixes se priorizan por impacto (roto = click sin efecto o efecto incorrecto); cosméticos se documentan. Si un área de caza no encuentra bugs reales, el fix de esa área valida la matriz y agrega la aserción de regresión igual.
- **Placeholders:** la matriz de hallazgos alimenta los fixes; cada tarea de fix define su archivo exacto y la regla "todo BUG de tu matriz se corrige".
