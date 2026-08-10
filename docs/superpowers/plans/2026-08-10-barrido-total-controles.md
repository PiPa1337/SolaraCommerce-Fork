# Barrido total de controles con 30 agentes — 2026-08-10 — Implementation Plan

> **Ejecución:** UN solo despacho de 30 agentes en paralelo (A1–A30), verificación de simultaneidad ×5, redespachos en lote, cola serial mínima al cierre.

**Goal:** Verificar TODOS los controles interactivos de la app (Studio + storefront público, ~290+ controles) con el contrato de 3 capas: (1) click → efecto real, (2) auto-feedback del control (estado seleccionado/activo/expandido/disabled), (3) contrato de datos (payload → receptor). La capa 2 es la clase que se escapó en el tema (presets sin estado marcado).

**Balanceo:** peso por control (botón=1, select/toggle=1.5, color/repeater/diálogo=2); 30 bins de ~12 de peso con duración similar; archivos grandes rebanados por grupos de controles.

## Propietarios (fix) y slices (auditoría + spec con `test.fixme`)

| Bin | Área | Archivos | Rol |
|---|---|---|---|
| A1 | Catalog: filas/búsqueda/orden | `features/Catalog.tsx` | OWNER |
| A2 | Catalog: bulk/columnas/selección | Catalog.tsx (read) + spec | AUDIT |
| A3 | Catalog: CSV/package/árbol/diálogos | Catalog.tsx (read) + spec | AUDIT |
| A4 | ProductEditor: formulario base | `features/catalog/ProductEditor.tsx` | OWNER |
| A5 | ProductEditor: variantes | ProductEditor.tsx (read) + spec | AUDIT |
| A6 | ProductEditor: validar/guardar/cancelar | ProductEditor.tsx (read) + spec | AUDIT |
| A7 | Overview: guiado | `features/Overview.tsx` | OWNER |
| A8 | Overview: enlaces/SEO | Overview.tsx (read) + spec | AUDIT |
| A9 | Overview: restantes | Overview.tsx (read) + spec | AUDIT |
| A10 | Builder: picker/agregar | `features/Builder.tsx` | OWNER |
| A11 | Builder: operaciones de sección | Builder.tsx (read) + spec | AUDIT |
| A12 | Dashboard: cards/library/health | `features/Dashboard.tsx` | OWNER |
| A13 | Dashboard: diálogos/shutdown | Dashboard.tsx (read) + spec | AUDIT |
| A14 | Studio: tabs/panes/foco/tema | `features/Studio.tsx` | OWNER |
| A15 | Studio: guardar/undo/atajos/status | Studio.tsx (read) + spec | AUDIT |
| A16 | ThemeEditor completo | `features/ThemeEditor.tsx` | OWNER |
| A17 | Assets completo | `features/Assets.tsx` | OWNER |
| A18 | HeroSlidesEditor + ConfirmDialog | `features/builder/HeroSlidesEditor.tsx`, `components/ConfirmDialog.tsx` | OWNER |
| A19 | Export + Toast | `features/Export.tsx`, `components/Toast.tsx` | OWNER |
| A20 | Preview + CompareView | `features/Preview.tsx`, `features/dashboard/CompareView.tsx` | OWNER |
| A21 | Seo + ManagedPersistenceControls | `features/Seo.tsx`, `features/ManagedPersistenceControls.tsx` | OWNER |
| A22 | CatalogToolbar + Ui | `features/catalog/CatalogToolbar.tsx`, `components/Ui.tsx` | OWNER |
| A23 | DashboardToolbar + DuplicateDialog | `features/dashboard/DashboardToolbar.tsx`, `features/dashboard/DuplicateDialog.tsx` | OWNER |
| A24 | RepeaterEditor + CategoryTree | `features/builder/RepeaterEditor.tsx`, `features/catalog/CategoryTree.tsx` | OWNER |
| A25 | ProjectCard + GuidedOverview | `features/dashboard/ProjectCard.tsx`, `features/GuidedOverview.tsx` | OWNER |
| A26 | primitives | `components/primitives.tsx` | OWNER |
| A27 | Storefront moderno: carrito/add-to-cart/header | `packages/modules/src/catalog-modern.ts` | OWNER |
| A28 | Storefront legacy: carrito/variantes/checkout | `packages/modules/src/definitions.ts` | OWNER |
| A29 | Runtime: carrito/checkout/drawer/WhatsApp | `packages/storefront-runtime/src/index.ts` | OWNER |
| A30 | Runtime: búsqueda/filtros + search.ts | `packages/storefront-runtime/src/search.ts` (OWNER), index.ts (read) + spec | OWNER/READ |

## Contrato por control (las 3 capas)

1. **Funcional:** click real (Playwright) → aserción del efecto en estado/datos/preview (no "visible-only").
2. **Auto-feedback:** el control comunica su estado — `aria-pressed`/`aria-expanded`/`aria-selected`/clase activa/disabled coherente con su lógica; si el estado cambia y el control no lo refleja → BUG (clase preset-tema).
3. **Datos:** payload del handler → receptor (traza estática corta): campos que el receptor lee = campos enviados.

## Reglas

- Cada agente: 1 spec nuevo `tests/e2e/ui-sweep-aNN.spec.ts` (único, sin tocar specs ajenos); reporte `.superpowers/sdd/barrido-aNN-report.md` con la MATRIZ | # | Control | Acción | Efecto real | Auto-feedback | Datos | Veredicto | Evidencia |.
- AUDIT slices: NO editan el archivo compartido; los bugs van a su spec como `test.fixme` nombrando al OWNER; el OWNER corrige (misma ola).
- Storefront (A27–A30): verificar contra el sitio EXPORTADO (patrones de `catalog-modern.spec.ts`/`scale-store.spec.ts`/`storefront-nojs.spec.ts`), no contra el editor.
- Si `git commit` falla por `index.lock`: esperar 3 s y reintentar hasta 5 veces. No correr `format:check` global; biome sólo sobre archivos propios. 0 U+FFFD.
- Gates por agente: `corepack pnpm --filter <paquete> test` + typecheck + su spec GREEN (o fixme documentados).
- Commit: `git add <propios>` → `git commit -m "Barrido A<NN>: <área> — N controles verificados"` (sin commits vacíos).

## Cierre (cola serial mínima)

1. Consolidar matriz 30 bins (1 agente) + un-fixme de los specs cuyos bugs ya corrigió el OWNER + re-despacho en lote de sobrantes.
2. Gates: `check`, `build`, `check:budgets`, `benchmark:export`, `test:e2e` (incluye los 30 specs nuevos), `test:e2e:portable`, `git diff --check`, `check:repository`, ejecutables.
3. Docs: CHANGELOG "Barrido total de controles (2026-08-10)" + deuda (clase auto-feedback incorporada al contrato).
4. Revisión final + push.

## Verificación de simultaneidad (×5)

Tras el despacho único: (1) conteo de resultados pendientes al inicio; (2) reportes `.superpowers/sdd/barrido-*.md` creados en la misma ventana (≥2 sesiones escribiendo); (3) commits intercalados en `git log` (autorías distintas en la misma ventana); (4) resultados llegando escalonados (no en bloque); (5) conteo final 30/30 entregados. Redespachos en lote para los vacíos.
