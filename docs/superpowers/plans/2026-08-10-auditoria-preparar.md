# Auditoría total de la pestaña Preparar — 2026-08-10 — Implementation Plan

> **Ejecución:** Ola 1 = 8 agentes de caza (PR1-PR8); Ola 2 = 4 agentes de traza (PT1-PT4); Ola 3 = fixes por owner; cierre. Alcance heredado: **arreglar todo lo inútil**.

**Goal:** La pestaña Preparar (flujo guiado: GuidedOverview + modelo `catalog-modern-guidance.ts`) debe: (1) reflejar el estado REAL del proyecto requisito por requisito, (2) marcar listo solo lo que realmente está listo para producción, (3) cada requisito debe corresponder a un crítico REAL del export (nada de requisitos muertos ni gaps), y (4) completar Preparar debe llevar a una tienda exportable viable. Contrato de 4 capas: funcional / auto-feedback / datos / **utilidad** (paridad con el gate real de producción).

**Cobertura previa (NO repetir):** R7/R8 de la auditoría de Resumen ya cubrieron Siguiente/pane (H8-B3), gate copy alineado (237fed0), sentinel placeholder (237fed0), upgrade básico y persistencia. Esta auditoría profundiza en el MODELO.

**Áreas:** `apps/studio/src/features/GuidedOverview.tsx` + `packages/project-schema/src/catalog-modern-guidance.ts` (modelo: readiness/requirements/upgrade — archivo de código, NO el schema; editarlo es permitido) + `apps/studio/src/lib/guidedDestinations.ts`.

## OLA 1 — CAZA (8 agentes, un lote)

Cada agente: tienda demo + tienda LIMPIA (clean); verifica contra el proyecto real y contra `auditReport` del exporter (gate de producción); reporte `.superpowers/sdd/preparar-prN-report.md` (MATRIZ 4 capas); spec `tests/e2e/ui-preparar-prN.spec.ts` (único). Reglas habituales (index.lock reintentos, biome solo propio, 0 U+FFFD, no editar producción — Ola 3).

| Bin | Enfoque |
|---|---|
| PR1 | Modelo de requisitos: cada requisito → rutas que lee + estados (ready/missing/placeholder/invalid) vs el proyecto REAL (demo Y clean); requisitos que nunca se completan o siempre están listos = hallazgo |
| PR2 | Paridad requisitos ↔ críticos de producción: para cada requisito, ¿existe el crítico correspondiente en `auditReport` (exporter)? requisito sin crítico real = dead requirement; crítico sin requisito = gap del flujo |
| PR3 | Progreso y feedback: %, "X de N", barra, aria-live, iconos/labels del checklist, anuncio a lectores de pantalla |
| PR4 | Destinos: Siguiente/Editar por scope (guidedDestinations congelado) → tab correcta + pane abre; casos raros (assets/seo/export/theme) |
| PR5 | Modo avanzado + protección de estructura: alternar → Builder con advancedMode y desprotección; ¿el modo persiste al navegar entre tabs? |
| PR6 | Upgrade deep: safeChanges/conflicts (¿qué produce cada uno? ¿labels reales? ¿el diff aplicado es correcto y conserva lo del usuario? ¿reversible con el respaldo previo?) |
| PR7 | Placeholders y textos de plantilla: qué campos tienen texto placeholder, el estado "Reemplazar texto de plantilla", el sentinel — ¿el aviso es útil, completo y accionable? |
| PR8 | Journey end-to-end (UTILIDAD del tab): tienda limpia → completar Preparar paso a paso → export producción VIABLE (0 críticos) → sitio completo; qué falta para producción que el flujo no cubre o promete |

## OLA 2 — TRAZA (4 agentes, un lote)

| Bin | Misión |
|---|---|
| PT1 | Mapa requisito→ruta del proyecto→crítico del export (consolidar PR1+PR2 con evidencia file:line); dead requirements y gaps priorizados |
| PT2 | Paridad preview↔sitio: lo que Preparar marca "listo" se ve en el sitio exportado (datos reales, no placeholders) |
| PT3 | Upgrade deep: diff real v1→v2 aplicado (qué cambia en el sitio exportado con y sin adoptar) |
| PT4 | Navegación cruzada: Guided ↔ Builder ↔ Resumen (modo avanzado, protección, estado persistente) |

## OLA 3 — FIXES (ola por owner según hallazgos)

Alcance aprobado: alinear el modelo de requisitos con el gate real (dead requirements eliminados o conectados a un crítico; gaps cubiertos), progreso honesto, placeholders accionables, upgrade verificado. Owners probables: `GuidedOverview.tsx` (UI), `catalog-modern-guidance.ts` (modelo — archivo de código permitido, NO el schema), specs `ui-preparar-*.spec.ts`.

## CIERRE

Consolidar matriz 4-capas · gates (check, build, budgets, benchmark, test:e2e 614+, portable) · docs (deuda) · ejecutables · push. Verificación de simultaneidad ×5; redespachos en lote.
