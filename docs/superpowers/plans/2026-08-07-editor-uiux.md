# Editor UI/UX — Plan maestro de depuración y mejoras (2026-08-07)

> **Contrato operativo:** olas paralelas con subagentes, revisión por ola, commits en español, gates al cierre, ejecutables reconstruidos y push al fork `origin` (PiPa1337/SolaraCommerce-Fork). Sin tocar `StoreProjectV2Schema` ni el storefront público. Budgets del editor: Studio JS ≤ 700 KiB crudo, CSS ≤ 84 KiB crudo (gate `check:budgets`).

## Convenciones transversales

- **Testids:** toda mejora visible se fija con `data-testid` cuando el test lo necesite (prefijo `ui-`).
- **Reduced motion:** toda animación nueva del editor se anula bajo `@media (prefers-reduced-motion: reduce)`; los tests usan `page.emulateMedia({ reducedMotion: "reduce" })`.
- **Focus:** nunca se quita el outline; focus-visible con ring del tema.
- **Botones:** targets ≥ 40px (44px en táctil); estados disabled/loading con estilo propio.
- **Commits:** uno por task (o agrupación coherente), `git add` SOLO de archivos propios; si el commit falla por lock del índice (ola paralela), esperar 3 s y reintentar hasta 3 veces.
- **Verificación por task:** tests del paquete Studio + typecheck + `format:check`/`git diff --check` sobre los archivos tocados; los specs E2E nuevos se listan (`--list`) y se ejecutan en la ola de QA/cierre.
- **Contratos del editor que no se rompen:** `Button`/`IconButton`/`Field`/`EmptyState`/`InlineError`/`SectionHeader`/`Skeleton` de `components/Ui.tsx`; `data-testid` existentes en Catalog/Dashboard/Preview; el flujo de guardado (`data-studio-save`, `.save-indicator`); los selectores usados por los specs E2E existentes (dashboard-store-card, etc.) — si un test existente cambia de selector, documentar la causa real en el reporte y ajustar el test en el mismo commit.

---

## FASE 0 — Auditoría base

### T0.1 — Consola limpia en todo el editor
**Files:** `tests/e2e/editor-console.spec.ts` (nuevo).
Spec que recorre: dashboard → abrir "Predeterminado" → cada tab (Resumen, Preparar, Catálogo, Productos, Tema, Recursos, SEO, Exportar, Preview) → acciones clave (agregar producto, editar sección, exportar borrador) — con listener de `page.on("pageerror")` y `page.on("console")` para `error`/`warning` que hace fallar el test. Ejecutar, arreglar TODOS los errores/warnings encontrados (fuera del scope de esta task solo si son del storefront público: documentar). Verificación: spec verde + `--list` incluido.

### T0.2 — Inventario de controles y estados
**Files:** `tests/e2e/editor-states.spec.ts` (nuevo) + ajustes de testids.
Inventario: todos los botones/inputs/selects visibles del editor (dashboard, tabs, catálogo, builder, assets). Para cada tipo, verificar: existe estilo disabled distinto, loading con spinner/texto, focus-visible visible, hover distinguible. Agregar `data-testid="ui-button-primary"` etc. donde falte. Spec que navega y asevera `getComputedStyle` diferenciados (cursor, opacity, box-shadow en focus). Verificación: spec verde.

### T0.3 — Matriz responsive del editor
**Files:** `tests/e2e/editor-responsive.spec.ts` (nuevo) + fixes responsive.
Viewports 390/768/1024/1440/1920; pantallas: dashboard, Studio con cada tab, preview. Aserción: `document.documentElement.scrollWidth <= clientWidth` en body (sin overflow horizontal), botones de acción visibles (no cortados), panel lateral del dashboard usable en móvil (drawer o apilado). Arreglar los desbordes encontrados (solo CSS/JSX del editor). Verificación: spec verde en los 5 viewports.

### T0.4 — A11y del editor
**Files:** `tests/e2e/editor-a11y.spec.ts` (nuevo) + fixes.
Tab order coherente (dashboard → cards → panel detalle), skip-link presente y funcional, focus visible, `aria-live` en resultados de búsqueda y avisos, roles de tabs (`role=tablist/tab/tabpanel` con `aria-selected`), diálogos con `role=dialog` + Escape + foco inicial, `aria-label` en icon-buttons sin texto visible. Spec de teclado: Tab hasta tabs, Enter/Espacio activa, Escape cierra diálogos. Arreglar hallazgos. Verificación: spec verde (tomar referencia de `release-a11y.spec.ts` existente para patrones).

### T0.5 — Deuda de código del editor
**Files:** informe `apps/studio/docs/deuda-editor.md` (nuevo) + fixes mecánicos.
Scan: selectores CSS duplicados/muertos en `styles.css` (base/cosmic/editorial/feedback), props sin usar, `any` sin biome-ignore justificado, imports huérfanos, componentes sin `displayName`, `key` faltantes en listas. Informe top-25 con archivo:línea; aplicar SOLO los fixes mecánicos seguros (borrar duplicados/muertos confirmados con `rg`, imports sin uso, displayName). No refactorizar lógica. Verificación: typecheck + tests + informe con el top-25 y lo aplicado.

### T0.6 — Perf de arranque del editor
**Files:** `scripts/studio-perf.test.ts` (nuevo, vitest con Playwright) o spec E2E `tests/e2e/editor-perf.spec.ts`.
Medir con `performance.now()` en la página: TTI-ish (primer paint de "Tus tiendas"), apertura de tienda (hasta "Resumen" visible), cambio de tab (Catálogo). Fijar budgets de ms con margen (medir primero, fijar = medido × 1.5). Si algo excede claramente, optimizar lo obvio (lazy, memo) — sin micro-optimización. Verificación: spec verde con los budgets reportados.

### T0.7 — Workers: errores y progreso
**Files:** `tests/e2e/editor-workers.spec.ts` (nuevo) + fixes de UI.
Verificar UX de: import CSV con filas inválidas (errores por fila visibles), procesamiento de imagen fallida (mensaje accionable), export con estado "generando" y resultado (éxito o error crítico con mensaje). Añadir donde falte: indicador de progreso textual en export y estado deshabilitado de botones durante el trabajo. Verificación: spec verde.

### T0.8 — Multi-tab y recovery draft
**Files:** spec `tests/e2e/editor-persistence.spec.ts` (nuevo) + fixes de UX.
Con el servidor gestionado: abrir la misma tienda en dos páginas; guardar en A → guardar en B → esperar 409 y verificar la UX (mensaje claro, opciones: recargar disco / conservar borrador / duplicar); verificar que la opción elegida funciona. Recovery: editar sin guardar → recargar → el diálogo de borrador aparece y recuperar restaura. Verificación: spec verde (puede reutilizar `local-storage.spec.ts` como referencia de setup del servidor).

---

## FASE 1 — Sistema de componentes

### T1.1 — Button unificado
**Files:** `components/Ui.tsx`, `styles.css` (base), migración de usos.
Ampliar `Button`: `variant: "primary" | "secondary" | "quiet" | "danger"`, `loading?: boolean` (spinner inline + deshabilitado), `size?: "sm" | "md"` (default md ≥40px), focus-visible ring, hover con elevación sutil y glow del accent (dentro de tokens `--ui-*`). Migrar TODOS los `<button className="button...">` crudos del editor al componente (grep `className="button` y `className="icon-button`). Verificación: typecheck + tests Studio + spec de estados (T0.2) verde.

### T1.2 — Field con error
**Files:** `components/Ui.tsx`, `styles.css`, usos de formularios (Overview, ProductEditor, Seo, Export, GuidedOverview).
`Field` gana `error?: string` (borde danger + mensaje + `aria-describedby`), `hint` existente; verificar `fieldset/legend` vs `label` (mantener pattern actual). Revisar que los formularios principales pasen `error` cuando validan (mínimo: Overview WhatsApp/URLs, ProductEditor precio/slug). Verificación: typecheck + tests + un spec mínimo de `aria-describedby` en el form de Resumen.

### T1.3 — Componentes nuevos
**Files:** `components/Ui.tsx` (o `components/primitives.tsx` nuevo si Ui.tsx crece) + `styles.css`.
Agregar y usar al menos: `Toggle` (switch accesible), `Badge`/`Tag`, `Tooltip` (CSS nativo con data-tip o title, sin lib), `ProgressBar` (aria-valuenow), `ConfirmDialog` (Modal + doble confirmación opcional), `Pagination` (reutilizable por catálogo y preview), `StatusBadge`, `SegmentedControl` (vista grilla/lista del dashboard y toolbar). Cada uno con testids `ui-*` y estados disabled/focus. Verificación: typecheck + tests + uso real en al menos una pantalla cada uno (documentar dónde).

### T1.4 — Toast/aviso global
**Files:** `components/Toast.tsx` (nuevo) + host en `Studio.tsx`/`App.tsx` + usos.
Sistema mínimo: `useToast()` con éxito/error/info, auto-cierre (5s éxito, 8s error), `role=status`/`role=alert`, aria-live, posición fija superior. Reemplazar avisos ad-hoc donde haya (dashboard respaldo/duplicado/archivado, import CSV, export). Verificación: spec que dispara una acción con toast y asevera el mensaje + cierre.

### T1.5 — Empty states y skeletons
**Files:** `components/Ui.tsx` + pantallas con listas.
Revisar EmptyState en: catálogo sin productos, assets sin imágenes, categorías sin hijos, búsqueda sin resultados, dashboard sin tiendas, SEO sin errores. Añadir acción concreta (botón que navega a la pestaña correcta) donde falte. Skeleton donde hay carga real (boot ya tiene; añadir en apertura de tienda si tarda). Verificación: spec visual de un empty state por pantalla con la acción visible.

### T1.6 — Tokens `--ui-*` y limpieza de CSS
**Files:** `styles.css` (base), componentes.
Definir en `:root` (o `[data-studio]`): `--ui-surface`, `--ui-surface-raised`, `--ui-border`, `--ui-text`, `--ui-text-muted`, `--ui-accent`, `--ui-danger`, `--ui-radius`, `--ui-shadow-sm/md`, `--ui-focus-ring`. Reemplazar valores hardcodeados repetidos (grep colores/radii/shadows en base.css) en los componentes tocados por las fases 1-3. No cambiar la apariencia general. Verificación: build + `check:budgets` (CSS no crece más de 10 KB) + diff visual manual en reporte.

### T1.7 — Iconografía y tooltips
**Files:** componentes y toolbars.
Revisar: tamaños de icono (16/17/18/20/25/30 actuales → normalizar a 16 sm / 18 md / 20 lg / 24 xl), `aria-hidden` en decorativos, `title` en icon-buttons sin texto (IconButton ya lo tiene; cubrir botones de toolbar de catálogo y tabs si usan iconos solos). Verificación: typecheck + inspección reportada de la normalización.

### T1.8 — Galería de componentes
**Files:** `apps/studio/src/debug/ComponentGallery.tsx` (nuevo) + ruta oculta.
Ruta `/__studio/components` (solo dev/gestionado; no romper rutas del storefront — es parte del SPA del editor, detectar por pathname en el shell o botón oculto en el dashboard con query param). Muestra todos los componentes con todos los estados (botones, inputs, toggles, badges, empty, skeleton, toast, confirm). Verificación: build + navegación manual en reporte (sin spec E2E dedicada, pero no debe romper el smoke).

### T1.9 — Docs de componentes
**Files:** `apps/studio/docs/components.md` (nuevo).
Documentar cada componente de `Ui.tsx` + nuevos: props, estados, uso recomendado, testid. Verificación: documento revisado en el reporte.

---

## FASE 2 — Dashboard

### T2.1 — Cards con micro-interacciones
**Files:** `features/dashboard/ProjectCard.tsx` o `Dashboard.tsx`, `styles.css` (cosmic).
Hover: elevación (`translateY(-2px)` + sombra), transición 200ms; foco-visible ring; estado seleccionada con borde accent; entrada con stagger (motion ya usado — verificar reduced-motion); skeleton mientras carga. Verificación: spec `editor-states`/`editor-responsive` verdes + reporte de pantallas.

### T2.2 — Toolbar del dashboard
**Files:** `features/dashboard/DashboardToolbar.tsx`, `Dashboard.tsx`.
Filtros combinados (estado + texto) — ya hay búsqueda y estado; asegurar combinación correcta y contador "X visibles" con aria-live; orden estable (por nombre/fecha/productos — ya existe; verificar persistencia entre visitas con localStorage); atajos: `/` enfoca búsqueda, `n` nueva tienda (con prevención si hay input enfocado). Verificación: spec de teclado/atajos + filtros combinados.

### T2.3 — Panel de detalle
**Files:** `ProjectCard.tsx` (detalle), `Dashboard.tsx`.
Acciones con estado: Respaldar/Abrir sitio/Abrir carpeta/Descargar → loading por botón (deshabilitado + texto), feedback de éxito (toast T1.4), foco return al cerrar (ya existe; verificar con spec), layout responsive: en móvil el panel se apila debajo o como drawer (elegir drawer si es simple). Verificación: spec de foco return + responsive.

### T2.4 — Favoritas y última selección
**Files:** `Dashboard.tsx`, `lib/dashboardModel.ts` o estado local persistido.
Pinned: estrella en la card, persistida en localStorage (`solara-dashboard-pinned`), sección "Fijadas" primero. Última selección: al volver del Studio, restaurar `selectedId` (localStorage). Verificación: spec que fija, recarga y verifica el orden.

### T2.5 — Keyboard en cards
**Files:** `Dashboard.tsx`.
Flechas ↑↓←→ mueven selección entre cards, Enter abre (ya abre con doble click; Enter = abrir, Espacio = seleccionar), Supr/Delete archiva con ConfirmDialog (T1.3), Escape cierra el detalle. Verificación: spec de teclado.

### T2.6 — Archivar con deshacer
**Files:** `Dashboard.tsx`.
Archivar: ConfirmDialog breve → toast "Tienda archivada" con acción "Deshacer" (5s) que restaura. Verificación: spec (archivar → deshacer → sigue activa).

### T2.7 — Vista "Salud de tiendas"
**Files:** `Dashboard.tsx` (sumario), `lib/dashboardModel.ts`.
Sumario global: total de tiendas activas, productos totales, sitios desactualizados (diskSiteStatus), errores críticos de auditoría (calcular por proyecto con `auditProject` en worker/lazy si es pesado — medir; si pesa >300ms por tienda, mostrar solo conteo de sitios desactualizados). Card de aviso clicable a la tienda. Verificación: spec que verifica los conteos con la demo.

### T2.8 — Comparación de dos tiendas
**Files:** `Dashboard.tsx` + `features/dashboard/CompareView.tsx` (nuevo).
Seleccionar 2 tiendas (checkboxes en cards) → botón "Comparar" → vista con diffs: productos (cantidad), categorías, tema (tokens distintos listados), motion por sección, sitios desactualizados. Sin diffs visuales de HTML. Verificación: spec con demo vs revamp (diferencias esperadas: motion de secciones, secciones faq/stats).

### T2.9 — Duplicar con progreso y backup masivo
**Files:** `Dashboard.tsx`, `App.tsx` (handlers ya existen — envolver con UX).
Duplicar: nombre sugerido "X (copia)" editable en un mini-diálogo + estado generando + toast éxito. Backup masivo: botón "Respaldar todo" en toolbar → descarga `.solara.json` por tienda activa (o abre carpeta). Verificación: spec de duplicar con progreso.

### T2.10 — Responsive fino del dashboard
**Files:** `styles.css` (cosmic) + `Dashboard.tsx`.
Grid: 1 col ≤600px, 2 cols 600-1024, 3 cols 1024-1440, 4 cols >1440 (revisar el actual); toolbar que envuelve sin cortar; métricas del sumario en 2×2 en móvil. Verificación: spec `editor-responsive` verde.

---

## FASE 3 — Shell del Studio

### T3.1 — Tabs
**Files:** `Studio.tsx` (tabs del shell), `styles.css`.
Overflow: scroll horizontal suave en móvil (scroll snap opcional), foco en la pestaña activa al cambiar con teclado, `role=tablist/tab/tabpanel` + `aria-selected` (verificar el patrón actual y corregir si es nav simple), indicador animado (underline que se desliza con motion layout), atajos Ctrl+1..n (o Alt+1..n). Verificación: spec de teclado/tabs + responsive.

### T3.2 — Barra superior
**Files:** `Studio.tsx`, `ManagedPersistenceControls.tsx`, `styles.css`.
Estados de Guardar: "Guardando…" con spinner → "Guardado HH:MM" con check animado → error con InlineError y reintento; breadcrumb "Tiendas / <Nombre>" clicable; botón "Volver a tiendas" con foco return y visible en móvil (icono). Verificación: spec que guarda y verifica los estados del indicador.

### T3.3 — Preview
**Files:** `Preview.tsx`, `styles.css`.
Toolbar responsive (ruta + dispositivos + zoom en 2 filas en móvil), selector de ruta con `<datalist>` de rutas conocidas, zoom 100/75/50 con memoria por sesión, estados: cargando (skeleton overlay) y error del iframe (recargar), foco al cambiar de ruta (anuncio aria-live "Vista previa: /ruta"). Verificación: spec que cambia ruta/dispositivo/zoom y verifica el iframe src.

### T3.4 — Paneles
**Files:** `Studio.tsx`, `styles.css`.
Colapso del panel de trabajo con animación (ancho o altura con motion), botón toggle con estado y atajo (Ctrl+\\), split redimensionable (solo si ya hay patrón; si no, ancho fijo 380-420px con 3 presets), persistir colapso/ancho por tienda (localStorage), sticky headers de sección dentro del panel con scroll. Verificación: spec de toggle + persistencia.

### T3.5 — Barra de estado inferior
**Files:** `Studio.tsx` (nuevo footer slim) + `localStorage.ts` (datos ya disponibles).
Mostrar: schemaVersion del proyecto, última exportación (savedAt del manifest o del estado), modo de persistencia (disco/IndexedDB). Sin acciones. Verificación: spec que verifica los textos.

### T3.6 — Modo foco del preview
**Files:** `Studio.tsx`/`Preview.tsx`.
Botón "Pantalla completa" (o atajo Ctrl+Shift+F) que oculta tabs/paneles dejando solo el preview con toolbar mínima; Escape restaura; foco al volver al botón. Verificación: spec.

### T3.7 — Dot de "sucio" por pestaña
**Files:** `Studio.tsx` (estado por tab).
Mantener un registro de qué pestañas tienen cambios sin guardar (o cambios desde la última visita a la pestaña) y mostrar un dot en el tab. Simple: si el proyecto cambió y la pestaña no es la actual y no se guardó → dot. Verificación: spec (editar en Catálogo → dot en Catálogo... o en otras tabs no visitadas).

### T3.8 — Dark mode del editor
**Files:** `styles.css` (tokens `--ui-*`) + toggle en la barra superior + localStorage.
Auditar: si los tokens `--ui-*` cubren las superficies principales, implementar `[data-studio-theme="dark"]` con override de tokens; si el costo es alto (muchos colores hardcodeados restantes), documentar en `apps/studio/docs/deuda-editor.md` y dejar el toggle fuera. Persistir en localStorage. Verificación: spec que alterna y verifica el atributo + contraste básico de texto.

---

## FASE 4 — Flujos

### T4.1 — Preparar (GuidedOverview)
**Files:** `GuidedOverview.tsx`, `styles.css`.
Checklist: progreso animado (barra que se llena al completar), estados por requisito (pendiente/ok/error) con iconos y colores, navegación directa a la pestaña del pendiente, "siguiente pendiente" al completar uno (si el patrón actual lo permite), empty/loading del plan. Verificación: spec que completa un requisito y verifica el progreso.

### T4.2 — Resumen/Overview
**Files:** `Overview.tsx`, `styles.css`.
Formularios largos: secciones plegables (accordion con animación), validación en vivo (WhatsApp formato, URLs válidas, textos no vacíos para los obligatorios) con error inline (T1.2), indicador de autosave ("Cambios guardados" / "Sin guardar"), acciones sticky en móvil (Guardar fijo abajo). Verificación: spec de validación + sticky.

### T4.3 — Catálogo: tabla
**Files:** `Catalog.tsx`, `CatalogToolbar.tsx`, `styles.css`.
Sticky header de tabla, sort por columnas (nombre/precio/estado/fecha), columnas configurables (checkbox de columnas en toolbar, persistido por tienda en localStorage), bulk bar fija al hacer scroll con conteo, atajos (e editar, d duplicar, Supr archivar con confirm), paginación con Pagination (T1.3). Verificación: specs de sort/columnas/paginación + responsive.

### T4.4 — Catálogo: edición inline y vista tarjetas
**Files:** `Catalog.tsx`.
Edición inline: precio y estado editables en la fila (input al hacer click, Enter confirma, Escape cancela, onCommand para el cambio), vista alterna grilla de tarjetas (toggle en toolbar, persistido). Verificación: spec de edición inline (precio cambia y aparece en la fila tras confirmar).

### T4.5 — ProductEditor
**Files:** `features/catalog/ProductEditor.tsx`, `styles.css`.
Validación por campo: precio entero ≥0, slug único (auto desde título + editable con check), opciones de variante sin duplicados, al menos una variante; errores inline bajo cada campo; navegación con teclado entre pasos; preview mini del producto (tarjeta) en el último paso; aviso de cambios sin guardar al salir del editor (confirm). Verificación: spec de validación (slug duplicado, precio inválido).

### T4.6 — Builder: picker e inspector
**Files:** `Builder.tsx`, `features/builder/SettingsInspector.tsx`, `styles.css`.
Picker de módulos: búsqueda por nombre, mini-preview textual (título+descripción de la metadata), agrupado por familia (solo catalog-modern como nuevas), estado de compatibilidad de slot claro; inspector: botón "Restaurar valores por defecto" por sección, mover sección con teclado (↑↓ con foco en el header) + animación de reorden, duplicar con sufijo. Verificación: spec de agregar módulo por búsqueda + restaurar defaults.

### T4.7 — Builder: errores de schema
**Files:** `SettingsInspector.tsx`, `Builder.tsx`.
Cuando `settingsSchema.safeParse` falla al renderizar: mostrar InlineError en el inspector con el path del campo y no romper el resto del panel; guardar bloqueado con mensaje accionable en la barra. Verificación: spec que inyecta settings inválidos (vía edición de un campo a un valor fuera de rango) y verifica el error.

### T4.8 — Tema
**Files:** `ThemeEditor.tsx`, `styles.css`.
Presets de paleta (3-4 curados derivados de los existentes) con mini-swatches, preview en vivo del storefront al cambiar color (el preview ya refleja el proyecto — verificar debounce), check de contraste (texto sobre fondo: advertencia si ratio < 4.5), reset por grupo (colores/tipografía/radios). Verificación: spec de preset aplicado + contraste.

### T4.9 — Assets
**Files:** `Assets.tsx`, `image.worker.ts` (solo si el progreso lo requiere).
Upload: barra de progreso por archivo + cancelación (los workers actuales no cancelan — si es complejo, mostrar progreso por lote y deshabilitar), drag & drop de imágenes al área, detalle de asset (dimensiones, hash corto, usos: en qué productos), reemplazar imagen manteniendo el ID (nuevo asset + actualizar productos que la usan). Verificación: spec de drag&drop + reemplazo con usos.

### T4.10 — SEO
**Files:** `Seo.tsx`, `styles.css`.
Checklist interactivo por área (metadata, imágenes, identificadores, precios, feed) con estado y link a la pestaña de corrección, previews de Google (título+descripción+URL), OG (imagen+título) y WhatsApp (si es simple), simulación "cómo nos ve un crawler" (lista de rutas indexables + noindex). Verificación: spec que verifica el checklist y los previews.

### T4.11 — Export
**Files:** `Export.tsx`, `export.worker.ts` (mensajes de progreso).
Progreso por etapas (Validando → Renderizando → Assets → Empaquetando) via mensajes del worker si es factible; si no, estados textuales por fase con el worker actual (reportar limitación). Historial de exportaciones (fechas de `sitios/` vía servidor si está disponible; si no, local del proyecto). Comparación de dos exportaciones (archivos y tamaños) si el historial existe. Checklist post-export accionable (abrir sitio, abrir carpeta, revisar SEO). Verificación: spec de export con estados.

### T4.12 — Diálogos y confirmaciones
**Files:** `components/Ui.tsx` (ConfirmDialog), usos.
Unificar confirmaciones: archivar tienda, eliminar producto, descartar draft, sobreescribir import, reemplazar respaldo — con ConfirmDialog (foco trap, Escape, Enter acepta, focus return). Doble confirmación solo en destructivos mayores (sobreescribir import). Verificación: spec de diálogo (Escape cancela, foco vuelve).

---

## FASE 5 — Animación del editor

### T5.1 — Micro-interacciones
**Files:** `styles.css` (base/editorial), componentes.
Hover de filas (catálogo) con translate+elevación, transiciones de tabs/paneles (motion layout o CSS), stagger de listas del dashboard y catálogo (respecto de reduced-motion), botones con hover/press (scale 0.98 en active). Verificación: `emulateMedia(reduce)` verifica estado final visible.

### T5.2 — Indicador de guardado animado
**Files:** `ManagedPersistenceControls.tsx`, `styles.css`.
Animación: punto pulsante mientras "Guardando…" → check que aparece (CSS) → fade. Verificación: spec visual del estado (clases).

### T5.3 — Reduced-motion global del editor
**Files:** `styles.css`.
Bloque `@media (prefers-reduced-motion: reduce)` que anula: transiciones del editor (excepto opacity/focus), animaciones de entrada, marquee del dashboard, cosmic background (ya pausa — verificar), stagger. Spec: `emulateMedia` y verificar que `getComputedStyle` de un elemento animado tiene transición none/0ms. Verificación: spec verde.

### T5.4 — Rendimiento
**Files:** `Catalog.tsx`, `Dashboard.tsx`, `Builder.tsx` (si aplica).
`React.memo` en filas de tabla (Row component), debounce (300ms) en búsquedas del catálogo/dashboard (ya hay debounce en algunas — verificar), lazy ya existente de Preview/SEO/Export (verificar que el chunk se carga bajo demanda con una assertion en perf spec), evitar re-render de la tabla completa al editar una fila (estado local de la fila). Verificación: perf spec (T0.6) verde + reporte de `React.Profiler` en catálogo 1000 productos.

---

## FASE 6 — QA automatizado

### T6.1 — Smoke completo del editor
**Files:** `tests/e2e/editor-smoke.spec.ts` (nuevo).
Recorrido completo: dashboard → abrir tienda → cada tab → crear producto → editar sección → exportar borrador → volver → archivar/restaurar. Sin aserciones finas de contenido: solo que cada pantalla renderiza su elemento clave (headings/testids). Base de regresión. Verificación: verde.

### T6.2 — Estados visuales
**Files:** `tests/e2e/editor-states.spec.ts` (completar T0.2).
Cubre: disabled de botones durante operaciones (export mientras corre), loading text, empty states con acción, error inline en formulario. Verificación: verde.

### T6.3 — Matriz responsive (completar T0.3)
Ejecutar en 5 viewports el recorrido del smoke (o un subconjunto) + overflow checks. Verificación: verde.

### T6.4 — Teclado/a11y (completar T0.4)
Tab order, diálogos, aria-live, focus return en todos los flujos nuevos. Verificación: verde.

### T6.5 — Consola limpia (completar T0.1)
Re-ejecutar el recorrido completo y fallar ante cualquier error/warning (incluye los flujos nuevos de las fases 1-5). Verificación: verde.

### T6.6 — Perf (completar T0.6)
Re-medir con los budgets finales. Verificación: verde.

### T6.7 — Workers/progreso (completar T0.7)
Incluir export con los nuevos estados de T4.11. Verificación: verde.

### T6.8 — Persistencia (completar T0.8)
Incluir los diálogos unificados de T4.12 en el flujo 409. Verificación: verde.

### T6.9 — Budgets finales del editor
**Files:** reporte en el changelog/reporte final.
Reportar: Studio JS y CSS crudos finales (gate `check:budgets`), delta vs 593.892/68.769 B, y confirmar techos 700/84 KiB. Verificación: gate verde.

---

## FASE 7 — Cierre

### T7.1 — Changelog y docs
`CHANGELOG.md` sección "Editor UI/UX (2026-08-07)": resumen por fase; `HANDOFF.md` actualización breve; `apps/studio/docs/components.md` y `deuda-editor.md` ya generados en las fases.

### T7.2 — Gate completo
`check`, `build`, `check:budgets`, `benchmark:export`, `test:e2e` — todo verde (los specs nuevos del editor incluidos). `test:e2e:release` NO.

### T7.3 — Ejecutables y push
`desktop:build`, `desktop:package`, `portable:smoke`; `git push origin main`.

### T7.4 — Revisión final
Reviewer final sobre el rango completo de la sesión; fixes si aplica; re-gate si hubo fixes; push final.

---

## FASE 8 — Cola de extras (si el tiempo alcanza, en orden de prioridad)
1. Drag & drop de secciones en Builder (primero evaluar el patrón actual de reorden con botones; implementar DnD solo si se puede hacer sin romper teclado/a11y).
2. Reorden manual de productos en catálogo (arriba/abajo con persistencia en proyecto vía comando de dominio nuevo — requiere evaluar comando; si el comando no existe, documentar y dejar como follow-up).
3. Modo oscuro del editor (si T3.8 lo dejó pendiente por costo).
4. Baseline visual de screenshots del editor (solo si estable).
5. Panel avanzado "Salud de la tienda" (perf por página y media por tienda).

---

## Orden de olas propuesto
- **Ola 0** (4 agentes ∥): T0.1+T0.5 · T0.2+T0.3 · T0.4+T0.6 · T0.7+T0.8
- **Ola 1** (4 agentes ∥): T1.1-T1.4 · T1.5-T1.7 · T2.1-T2.5 · T2.6-T2.10
- **Ola 2** (4 agentes ∥): T3.1-T3.4 · T3.5-T3.8 · T4.1-T4.4 · T4.5-T4.8
- **Ola 3** (3 agentes ∥): T4.9-T4.12 · T5.1-T5.4 · T6.1-T6.9
- **Ola 4** (2 agentes ∥): T7.1-T7.2 · T7.3-T7.4 (+ fixes)
- **Cola**: Fase 8 si sobra tiempo.
