# TO DO — PLAN GRANDE DE LA APP (10 planes hardcodeados, uno tras otro)

Contrato de la cadena: cada plan es una tarea completa del to-do; al cerrarse (lista cerrada + gates + reporte + push) se ejecuta el siguiente **inmediatamente, sin preguntar**. El único fin real es el cierre del PLAN 10 (reporte global + commit + aviso). Estado en `docs/perpetual-state.json` (plan en curso, baseline, SIGUIENTE) para que cualquier corte de sesión reanude por `SIGUIENTE` sin decisiones.

---

## PLAN 1 — Diagnóstico base de la app + baseline de rendimiento y calidad

**1. Contrato del plan (inicio y fin definidos)**
Inicio: al aprobar este plan (baseline formal de toda la app: boot del dashboard y del editor, memoria con tiendas grandes, reposo CPU/rAF, interacciones, a11y del editor + backlog commiteados). Fin: cuando la lista cerrada de ítems del PLAN 1 quede en `hecho | bloqueado | verificado`, los gates estén verdes y se entregue la sección del reporte de Δ% con autocrítica + push a origin/main. Al cerrar el PLAN 1, **ejecutar el PLAN 2 inmediatamente, sin preguntar.**

**2. Backlog semilla (to do del PLAN 1)**
- K1: crear `perf-app.spec.ts`: boot del dashboard y del editor (abrir tienda, cambiar tab, abrir Export) con CDP — baseline.
- K2: memoria: heap con 2 tiendas demo y tras navegar todas las pestañas (fuga por tab) — baseline.
- K3: reposo: perf-idle re-verificado (dashboard + editor + oculto) — baseline.
- L1: crear `axe-app.spec.ts`: axe sobre el Studio (dashboard + editor en las 6 pestañas) — findings iniciales.
- L2: foco visible del editor (tabs, pane, botones) con teclado — baseline.
- B1: fixes inmediatos de a11y/visibilidad que aparezcan en el diagnóstico (con Δ%).
- J1: cierre de la app con guardados en vuelo: medir y documentar el comportamiento actual.

**3. Componente de medición con autocrítica**
Cada fila del backlog lleva `Métrica | Antes | Después | Δ%` con el mismo instrumento antes y después. Regla: Δ% > 0 → mejora (commit con %); Δ% ≈ 0 → solo robustez documentada; Δ% < 0 → revertir o bloquear con evidencia; ciclo sin Δ% = inválido.

**4. Componente de cobertura**
Mapa completo A-L (Dashboard, Shell del editor, Flujos guiados, Catálogo, Builder/Inspector, Tema/SEO/Assets, Preview, Export, Persistencia/conexiones, Shell de la app, Rendimiento, Calidad) — en este plan se miden los baselines; los hallazgos nuevos entran al backlog.

**5. Ciclo con medición obligatoria**
0. Health check (git limpio, baseline vigente) → 1. ítem por orden del backlog → 2. MEDIR ANTES → 3. TDD → 4. fix mínimo → 5. MEDIR DESPUÉS → Δ% → 6. autocrítica → 7. gates proporcionales + baseline → 8. commit con Δ% + log → volver a 1.

**6. Criterios de salida (fin del PLAN 1)**
Lista cerrada + gates (check, e2e del área, perf) + sección PLAN 1 del reporte + commit de cierre + push. **Al cerrar el PLAN 1, ejecutar el PLAN 2 inmediatamente, sin preguntar.**

**7. Watchdog acotado**
3 intentos por ítem → bloqueado con evidencia; 3 ciclos consecutivos con Δ% ≤ 0 → switch al ítem de mayor potencial; corte de sesión reanuda por `SIGUIENTE`.

---

## PLAN 2 — Dashboard: UI/UX, botones, visibilidad

**1. Contrato del plan (inicio y fin definidos)**
Inicio: baseline formal = cierre del PLAN 1, commiteado. Fin: lista cerrada del PLAN 2 + gates verdes + reporte de Δ% con autocrítica + push. Al cerrar el PLAN 2, **ejecutar el PLAN 3 inmediatamente, sin preguntar.**

**2. Backlog semilla (to do del PLAN 2)**
- A1: panel de detalle (aside en main, moderado de axe): decidir con medición moverlo o excepción documentada.
- A2: cards de tiendas: estados (activa/archivada/desactualizada), badges, jerarquía — barrido de visión + medición.
- A3: toolbar: búsqueda, filtros por estado, orden, vista grid/lista — consistencia de labels y estados.
- A4: botones "Abrir/Respaldo/Duplicar/Archivar": estados disabled/loading/confirmación — barrido visual.
- A5: stats y métricas de salud: claridad y actualización.
- A6: modo comparar y duplicado: flujo y confirmaciones.
- A7: visibilidad del estado del servidor (managed/navegador) y del aviso global.
- A8: barrido visual completo del dashboard (2 viewports) con visión → hallazgos con Δ%.

**3. Componente de medición con autocrítica**
Cada fila del backlog lleva `Métrica | Antes | Después | Δ%` con el mismo instrumento antes y después. Regla: Δ% > 0 → mejora (commit con %); Δ% ≈ 0 → solo robustez documentada; Δ% < 0 → revertir o bloquear con evidencia; ciclo sin Δ% = inválido.

**4. Componente de cobertura**
Mapa A-L del Núcleo Común — este plan se enfoca en la capa A (Dashboard) y registra hallazgos de las demás capas al backlog.

**5. Ciclo con medición obligatoria**
0. Health check (git limpio, baseline vigente) → 1. ítem por orden del backlog → 2. MEDIR ANTES → 3. TDD → 4. fix mínimo → 5. MEDIR DESPUÉS → Δ% → 6. autocrítica → 7. gates proporcionales + baseline → 8. commit con Δ% + log → volver a 1.

**6. Criterios de salida (fin del PLAN 2)**
Lista cerrada + gates (check, e2e del dashboard, barrido visual) + sección PLAN 2 del reporte + commit de cierre + push. **Al cerrar el PLAN 2, ejecutar el PLAN 3 inmediatamente, sin preguntar.**

**7. Watchdog acotado**
3 intentos por ítem → bloqueado con evidencia; 3 ciclos consecutivos con Δ% ≤ 0 → switch al ítem de mayor potencial; corte de sesión reanuda por `SIGUIENTE`.

---

## PLAN 3 — Shell del editor: tabs, pane, atajos, foco

**1. Contrato del plan (inicio y fin definidos)**
Inicio: baseline formal = cierre del PLAN 2, commiteado. Fin: lista cerrada del PLAN 3 + gates verdes + reporte de Δ% con autocrítica + push. Al cerrar el PLAN 3, **ejecutar el PLAN 4 inmediatamente, sin preguntar.**

**2. Backlog semilla (to do del PLAN 3)**
- B1: navegación por tabs: foco, aria-selected, punto de sucio por pestaña.
- B2: pane del inspector: apertura/cierre, scroll preservado por pestaña, foco al reabrir.
- B3: atajos (Ctrl+S, Ctrl+Z/Shift+Z, navegación): cobertura y feedback visual.
- B4: diálogos (confirmaciones, conflictos de versión): foco atrapado, aria, botones coherentes.
- B5: barra de estado: guardado/sucio/último export — legibilidad y actualización.
- B6: mensajes de error/aviso globales: visibilidad y accionabilidad.
- B7: contraste y tamaños de los componentes Ui del editor (badges, toggles, pagination, tooltips) — axe + medición.

**3. Componente de medición con autocrítica**
Cada fila del backlog lleva `Métrica | Antes | Después | Δ%` con el mismo instrumento antes y después. Regla: Δ% > 0 → mejora (commit con %); Δ% ≈ 0 → solo robustez documentada; Δ% < 0 → revertir o bloquear con evidencia; ciclo sin Δ% = inválido.

**4. Componente de cobertura**
Mapa A-L del Núcleo Común — este plan se enfoca en la capa B (Shell del editor) y registra hallazgos de las demás capas al backlog.

**5. Ciclo con medición obligatoria**
0. Health check (git limpio, baseline vigente) → 1. ítem por orden del backlog → 2. MEDIR ANTES → 3. TDD → 4. fix mínimo → 5. MEDIR DESPUÉS → Δ% → 6. autocrítica → 7. gates proporcionales + baseline → 8. commit con Δ% + log → volver a 1.

**6. Criterios de salida (fin del PLAN 3)**
Lista cerrada + gates (check, e2e del editor, perf-idle) + sección PLAN 3 del reporte + commit de cierre + push. **Al cerrar el PLAN 3, ejecutar el PLAN 4 inmediatamente, sin preguntar.**

**7. Watchdog acotado**
3 intentos por ítem → bloqueado con evidencia; 3 ciclos consecutivos con Δ% ≤ 0 → switch al ítem de mayor potencial; corte de sesión reanuda por `SIGUIENTE`.

---

## PLAN 4 — Flujos guiados: Preparar, creación, upgrade, importación

**1. Contrato del plan (inicio y fin definidos)**
Inicio: baseline formal = cierre del PLAN 3, commiteado. Fin: lista cerrada del PLAN 4 + gates verdes + reporte de Δ% con autocrítica + push. Al cerrar el PLAN 4, **ejecutar el PLAN 5 inmediatamente, sin preguntar.**

**2. Backlog semilla (to do del PLAN 4)**
- C1: checklist de Preparar: requisitos, "más N" expandible, navegación a la pestaña correcta — revisión completa con medición de pasos.
- C2: creación de tienda: pasos, validación de campos, errores inline, foco, éxito.
- C3: upgrade V1→V2 y migración de templates: diálogos, opciones, preview del cambio.
- C4: importación CSV: progreso del worker, errores por fila, revisión previa, cancelación.
- C5: flujo de apertura de tienda desde el dashboard: cantidad de pasos hasta editar (medición con CDP) → optimizar.
- C6: recuperación de borrador: cuándo aparece, qué dice, acciones — revisión de claridad.

**3. Componente de medición con autocrítica**
Cada fila del backlog lleva `Métrica | Antes | Después | Δ%` con el mismo instrumento antes y después. Regla: Δ% > 0 → mejora (commit con %); Δ% ≈ 0 → solo robustez documentada; Δ% < 0 → revertir o bloquear con evidencia; ciclo sin Δ% = inválido.

**4. Componente de cobertura**
Mapa A-L del Núcleo Común — este plan se enfoca en la capa C (Flujos guiados) y registra hallazgos de las demás capas al backlog.

**5. Ciclo con medición obligatoria**
0. Health check (git limpio, baseline vigente) → 1. ítem por orden del backlog → 2. MEDIR ANTES → 3. TDD → 4. fix mínimo → 5. MEDIR DESPUÉS → Δ% → 6. autocrítica → 7. gates proporcionales + baseline → 8. commit con Δ% + log → volver a 1.

**6. Criterios de salida (fin del PLAN 4)**
Lista cerrada + gates (check, e2e de flujos guiados) + sección PLAN 4 del reporte + commit de cierre + push. **Al cerrar el PLAN 4, ejecutar el PLAN 5 inmediatamente, sin preguntar.**

**7. Watchdog acotado**
3 intentos por ítem → bloqueado con evidencia; 3 ciclos consecutivos con Δ% ≤ 0 → switch al ítem de mayor potencial; corte de sesión reanuda por `SIGUIENTE`.

---

## PLAN 5 — Catálogo: tabla, producto, variantes, categorías

**1. Contrato del plan (inicio y fin definidos)**
Inicio: baseline formal = cierre del PLAN 4, commiteado. Fin: lista cerrada del PLAN 5 + gates verdes + reporte de Δ% con autocrítica + push. Al cerrar el PLAN 5, **ejecutar el PLAN 6 inmediatamente, sin preguntar.**

**2. Backlog semilla (to do del PLAN 5)**
- D1: tabla del catálogo: columnas, filtros por estado, selección múltiple, acciones masivas — revisión de visibilidad.
- D2: editor de producto: pestañas, repeater de variantes, campos, validaciones, guardado por comando — flujo completo.
- D3: variantes: disponibilidad, preorder, fechas, edición inline.
- D4: árbol de categorías: crear, reordenar (drag/teclado), reparent, eliminar con confirmación.
- D5: colecciones: gestión y asignación de productos.
- D6: búsqueda global del catálogo: resultados, etiquetas, estados.
- D7: rendimiento de la tabla con 50+ productos (medición de interacción) → optimizar si hay margen.

**3. Componente de medición con autocrítica**
Cada fila del backlog lleva `Métrica | Antes | Después | Δ%` con el mismo instrumento antes y después. Regla: Δ% > 0 → mejora (commit con %); Δ% ≈ 0 → solo robustez documentada; Δ% < 0 → revertir o bloquear con evidencia; ciclo sin Δ% = inválido.

**4. Componente de cobertura**
Mapa A-L del Núcleo Común — este plan se enfoca en la capa D (Catálogo) y registra hallazgos de las demás capas al backlog.

**5. Ciclo con medición obligatoria**
0. Health check (git limpio, baseline vigente) → 1. ítem por orden del backlog → 2. MEDIR ANTES → 3. TDD → 4. fix mínimo → 5. MEDIR DESPUÉS → Δ% → 6. autocrítica → 7. gates proporcionales + baseline → 8. commit con Δ% + log → volver a 1.

**6. Criterios de salida (fin del PLAN 5)**
Lista cerrada + gates (check, e2e del catálogo, perf de interacción) + sección PLAN 5 del reporte + commit de cierre + push. **Al cerrar el PLAN 5, ejecutar el PLAN 6 inmediatamente, sin preguntar.**

**7. Watchdog acotado**
3 intentos por ítem → bloqueado con evidencia; 3 ciclos consecutivos con Δ% ≤ 0 → switch al ítem de mayor potencial; corte de sesión reanuda por `SIGUIENTE`.

---

## PLAN 6 — Builder e inspector: módulos, repeater, defaults

**1. Contrato del plan (inicio y fin definidos)**
Inicio: baseline formal = cierre del PLAN 5, commiteado. Fin: lista cerrada del PLAN 6 + gates verdes + reporte de Δ% con autocrítica + push. Al cerrar el PLAN 6, **ejecutar el PLAN 7 inmediatamente, sin preguntar.**

**2. Backlog semilla (to do del PLAN 6)**
- E1: selector de módulos: búsqueda, compatibilidad, estados deshabilitados con razón, teclado.
- E2: inspector de settings: tipos de campo (texto, URL, asset, repeater), errores del schema inline, labels claros.
- E3: repeaters (slides, beneficios, testimonios, bento): agregar/eliminar/reordenar con teclado, defaults válidos.
- E4: "Restaurar valores por defecto": flujo de confirmación y cobertura en todos los módulos.
- E5: base protegida (modo avanzado): claridad del candado y de la activación.
- E6: compatibilidad de módulos por slot: mensajes accionables.
- E7: preview inmediato del cambio en el builder (paridad con el iframe) — medir latencia de feedback.

**3. Componente de medición con autocrítica**
Cada fila del backlog lleva `Métrica | Antes | Después | Δ%` con el mismo instrumento antes y después. Regla: Δ% > 0 → mejora (commit con %); Δ% ≈ 0 → solo robustez documentada; Δ% < 0 → revertir o bloquear con evidencia; ciclo sin Δ% = inválido.

**4. Componente de cobertura**
Mapa A-L del Núcleo Común — este plan se enfoca en la capa E (Builder/Inspector) y registra hallazgos de las demás capas al backlog.

**5. Ciclo con medición obligatoria**
0. Health check (git limpio, baseline vigente) → 1. ítem por orden del backlog → 2. MEDIR ANTES → 3. TDD → 4. fix mínimo → 5. MEDIR DESPUÉS → Δ% → 6. autocrítica → 7. gates proporcionales + baseline → 8. commit con Δ% + log → volver a 1.

**6. Criterios de salida (fin del PLAN 6)**
Lista cerrada + gates (check, e2e del builder, perf del preview) + sección PLAN 6 del reporte + commit de cierre + push. **Al cerrar el PLAN 6, ejecutar el PLAN 7 inmediatamente, sin preguntar.**

**7. Watchdog acotado**
3 intentos por ítem → bloqueado con evidencia; 3 ciclos consecutivos con Δ% ≤ 0 → switch al ítem de mayor potencial; corte de sesión reanuda por `SIGUIENTE`.

---

## PLAN 7 — Tema, SEO, Assets y Preview

**1. Contrato del plan (inicio y fin definidos)**
Inicio: baseline formal = cierre del PLAN 6, commiteado. Fin: lista cerrada del PLAN 7 + gates verdes + reporte de Δ% con autocrítica + push. Al cerrar el PLAN 7, **ejecutar el PLAN 8 inmediatamente, sin preguntar.**

**2. Backlog semilla (to do del PLAN 7)**
- F1: editor de tema: paletas, modo claro/oscuro (opción deshabilitada con hint), fuentes, preview en vivo.
- F2: SEO: campos por página, contadores, preview del resultado, verificación de Search Console/Merchant.
- F3: assets: grilla, subida con progreso, reemplazo conservando nombre/alt, usos, eliminación con guard.
- F4: preview del editor: zoom, tamaños (escritorio/tablet/móvil), rutas, recarga — controles claros y feedback.
- F5: pausa/reanudación del preview (solara-pause) — verificación del contrato con medición de CPU.
- F6: paridad preview ↔ editor (rutas y contenido) — ampliar gates si hace falta.

**3. Componente de medición con autocrítica**
Cada fila del backlog lleva `Métrica | Antes | Después | Δ%` con el mismo instrumento antes y después. Regla: Δ% > 0 → mejora (commit con %); Δ% ≈ 0 → solo robustez documentada; Δ% < 0 → revertir o bloquear con evidencia; ciclo sin Δ% = inválido.

**4. Componente de cobertura**
Mapa A-L del Núcleo Común — este plan se enfoca en las capas F (Tema/SEO/Assets) y G (Preview) y registra hallazgos de las demás capas al backlog.

**5. Ciclo con medición obligatoria**
0. Health check (git limpio, baseline vigente) → 1. ítem por orden del backlog → 2. MEDIR ANTES → 3. TDD → 4. fix mínimo → 5. MEDIR DESPUÉS → Δ% → 6. autocrítica → 7. gates proporcionales + baseline → 8. commit con Δ% + log → volver a 1.

**6. Criterios de salida (fin del PLAN 7)**
Lista cerrada + gates (check, e2e de tema/SEO/assets/preview) + sección PLAN 7 del reporte + commit de cierre + push. **Al cerrar el PLAN 7, ejecutar el PLAN 8 inmediatamente, sin preguntar.**

**7. Watchdog acotado**
3 intentos por ítem → bloqueado con evidencia; 3 ciclos consecutivos con Δ% ≤ 0 → switch al ítem de mayor potencial; corte de sesión reanuda por `SIGUIENTE`.

---

## PLAN 8 — Export, persistencia y conexiones

**1. Contrato del plan (inicio y fin definidos)**
Inicio: baseline formal = cierre del PLAN 7, commiteado. Fin: lista cerrada del PLAN 8 + gates verdes + reporte de Δ% con autocrítica + push. Al cerrar el PLAN 8, **ejecutar el PLAN 9 inmediatamente, sin preguntar.**

**2. Backlog semilla (to do del PLAN 8)**
- H1: panel de export: etapas del worker, auditoría con críticos, botones de acción — claridad del estado.
- H2: historial de exportaciones: lectura y presentación.
- H3: descarga de respaldo y exportación: nombres de archivo, rutas, feedback.
- I1: guardado: indicador de estados (guardando/guardado/error/conflicto), latencia percibida.
- I2: conflicto de versión: diálogo, opciones, foco.
- I3: recovery draft: cuándo aparece, qué recupera, descartar.
- I4: workers: reintentos (ya implementado) — verificar en flujo real con fallo simulado.
- I5: conexiones: servidor local ↔ Studio (session, guardado), shell ↔ Studio (IPC), preview ↔ runtime — revisión de contratos con e2e.

**3. Componente de medición con autocrítica**
Cada fila del backlog lleva `Métrica | Antes | Después | Δ%` con el mismo instrumento antes y después. Regla: Δ% > 0 → mejora (commit con %); Δ% ≈ 0 → solo robustez documentada; Δ% < 0 → revertir o bloquear con evidencia; ciclo sin Δ% = inválido.

**4. Componente de cobertura**
Mapa A-L del Núcleo Común — este plan se enfoca en las capas H (Export) e I (Persistencia/conexiones) y registra hallazgos de las demás capas al backlog.

**5. Ciclo con medición obligatoria**
0. Health check (git limpio, baseline vigente) → 1. ítem por orden del backlog → 2. MEDIR ANTES → 3. TDD → 4. fix mínimo → 5. MEDIR DESPUÉS → Δ% → 6. autocrítica → 7. gates proporcionales + baseline → 8. commit con Δ% + log → volver a 1.

**6. Criterios de salida (fin del PLAN 8)**
Lista cerrada + gates (check, e2e de export/persistencia/portable) + sección PLAN 8 del reporte + commit de cierre + push. **Al cerrar el PLAN 8, ejecutar el PLAN 9 inmediatamente, sin preguntar.**

**7. Watchdog acotado**
3 intentos por ítem → bloqueado con evidencia; 3 ciclos consecutivos con Δ% ≤ 0 → switch al ítem de mayor potencial; corte de sesión reanuda por `SIGUIENTE`.

---

## PLAN 9 — Shell, rendimiento profundo y calidad

**1. Contrato del plan (inicio y fin definidos)**
Inicio: baseline formal = cierre del PLAN 8, commiteado. Fin: lista cerrada del PLAN 9 + gates verdes + reporte de Δ% con autocrítica + push. Al cerrar el PLAN 9, **ejecutar el PLAN 10 inmediatamente, sin preguntar.**

**2. Backlog semilla (to do del PLAN 9)**
- J1: ventana y shell: tamaños mínimos, cierre, respaldos manuales, abrir carpeta/sitio — revisión de flujo.
- K1: boot del editor: parse de chunks (ya lazy) — medir y compactar más si hay margen.
- K2: memoria: fuga al navegar pestañas y abrir/cerrar tiendas (medición con CDP, Δ% por fix).
- K3: reposo del editor con preview: re-medición post-lazy.
- L1: a11y completa del editor: axe en las 6 pestañas + foco + teclado + reduced-motion.
- L2: docs: TESTING/HANDOFF al día con los gates nuevos de la app.
- L3: deuda abierta de `docs/TECHNICAL_DEBT.md` accionable → convertir.

**3. Componente de medición con autocrítica**
Cada fila del backlog lleva `Métrica | Antes | Después | Δ%` con el mismo instrumento antes y después. Regla: Δ% > 0 → mejora (commit con %); Δ% ≈ 0 → solo robustez documentada; Δ% < 0 → revertir o bloquear con evidencia; ciclo sin Δ% = inválido.

**4. Componente de cobertura**
Mapa A-L del Núcleo Común — este plan se enfoca en las capas J (Shell), K (Rendimiento) y L (Calidad) y registra hallazgos de las demás capas al backlog.

**5. Ciclo con medición obligatoria**
0. Health check (git limpio, baseline vigente) → 1. ítem por orden del backlog → 2. MEDIR ANTES → 3. TDD → 4. fix mínimo → 5. MEDIR DESPUÉS → Δ% → 6. autocrítica → 7. gates proporcionales + baseline → 8. commit con Δ% + log → volver a 1.

**6. Criterios de salida (fin del PLAN 9)**
Lista cerrada + gates (check, perf, axe de la app, portable) + sección PLAN 9 del reporte + commit de cierre + push. **Al cerrar el PLAN 9, ejecutar el PLAN 10 inmediatamente, sin preguntar.**

**7. Watchdog acotado**
3 intentos por ítem → bloqueado con evidencia; 3 ciclos consecutivos con Δ% ≤ 0 → switch al ítem de mayor potencial; corte de sesión reanuda por `SIGUIENTE`.

---

## PLAN 10 — Re-auditoría completa y cierre formal

**1. Contrato del plan (inicio y fin definidos)**
Inicio: baseline formal = cierre del PLAN 9, commiteado. Fin: lista cerrada del PLAN 10 + gates completos + **reporte global consolidado de los 10 planes** (Δ% por ítem, por capa y por plan; autocrítica completa: qué no mejoró, por qué, qué quedó bloqueado) + commit de cierre + push. **Aquí termina el documento: se detiene y se te avisa — no se continúa sin tu instrucción.**

**2. Backlog semilla (to do del PLAN 10)**
- R1: re-auditoría de las 12 capas una vez más (barrido visual + axe + perf + e2e).
- R2: consolidación del reporte global (comparado contra el baseline del PLAN 1).
- R3: gates finales: `pnpm check`, benchmark, e2e completo, portable smoke/e2e, ejecutables reconstruidos.

**3. Componente de medición con autocrítica**
Cada fila del backlog lleva `Métrica | Antes | Después | Δ%` con el mismo instrumento antes y después; consolidación final: tabla ítem × Δ% con totales globales. Regla: Δ% > 0 → mejora (commit con %); Δ% ≈ 0 → solo robustez documentada; Δ% < 0 → revertir o bloquear con evidencia; ciclo sin Δ% = inválido.

**4. Componente de cobertura**
Mapa A-L del Núcleo Común — re-auditoría completa de todas las capas.

**5. Ciclo con medición obligatoria**
0. Health check (git limpio, baseline vigente) → 1. ítem por orden del backlog → 2. MEDIR ANTES → 3. TDD → 4. fix mínimo → 5. MEDIR DESPUÉS → Δ% → 6. autocrítica → 7. gates proporcionales + baseline → 8. commit con Δ% + log → volver a 1.

**6. Criterios de salida (fin del documento)**
Lista cerrada + gates completos + reporte global consolidado + commit de cierre + push. **Aquí termina el documento: se detiene y se te avisa — no se continúa sin tu instrucción.**

**7. Watchdog acotado**
3 intentos por ítem → bloqueado con evidencia; 3 ciclos consecutivos con Δ% ≤ 0 → switch al ítem de mayor potencial; corte de sesión reanuda por `SIGUIENTE`.
