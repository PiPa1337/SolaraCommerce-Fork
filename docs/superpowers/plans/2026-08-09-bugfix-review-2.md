# Revisión de Bugfixes 2 — 2026-08-09 — Implementation Plan

> **Para agentes:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` o `superpowers:executing-plans`. Pasos con casillas (`- [ ]`). **Ejecución: una ola de 12 implementadores en paralelo** (propiedad de archivos disjunta), luego cierre.

**Goal:** Corregir los ~30 defectos accionables encontrados por la caza de bugs de 5 agentes (crashs del editor, runtime storefront, storage, shell, specs/docs), con test primero.

**Architecture:** 12 tareas de fix con propietario de archivos exclusivo (ver tabla de tareas) + tarea 13 de cierre. Las tareas del runtime y los módulos cambian salida pública: exigen budget y E2E de storefront. La tarea 7 (storage) concentra los 7 fixes del servidor local en un solo agente por conflicto de archivo.

**Tech Stack:** Node 22+ (release), pnpm 10.15.1 vía `corepack`, Vitest 3.2.4, Playwright Chromium, Node `fs` nativo.

## Global Constraints

- No modificar `StoreProjectV2Schema` ni `schemaVersion: 2` (contrato persistido). SCH1/SCH2/SCH3 NO se resuelven en el schema: SCH3 se resuelve como auditoría.
- No agregar dependencias de runtime.
- Preview y sitio público usan el mismo renderer; `scripts/public-storefront-budget.test.ts` exige: production conserva preload LCP; storefront.js ≤ 52 KiB (medido ~46.7 KiB); storefront.css ≤ 780 KiB (medido ~75 KiB).
- El runtime público es un string serializado: cualquier regla CSS/JS agregada suma bytes; los tests de serialización (`scripts/runtime-serialization.test.ts`) deben seguir pasando.
- El servidor local conserva: validación de rutas, 409, lock por tienda, manifest atómico, `writeGuard` (sólo tests). `solara-request-handler.mjs` compartido HTTP/Electron: no cambiar contrato de respuestas.
- Gates por task: `corepack pnpm --filter <paquete> test` + `typecheck` + E2E propio. Cierre: `check`, `build`, `check:budgets`, `benchmark:export`, `test:e2e`, `git diff --check`, `check:repository`, ejecutables (`desktop:build`, `desktop:package`, `portable:smoke`).
- Commits breves en español, uno por task, `git add` de archivos explícitos. Reportes `.superpowers/sdd/` nunca al commit. No correr `format:check` global (ola paralela); biome sólo sobre archivos propios.
- **Ola paralela:** si `git commit` falla por `index.lock` (concurrencia), esperar 3 s y reintentar hasta 5 veces. No tocar archivos de otras tareas (tabla de propietarios).
- Windows + PowerShell; sin bash, sin rg (Select-String).

---

### Task 1 — Crash del editor: reparent con hijos + porcentaje < -100% (ST-B1 + ST-B2) — [Agente A]

**Files (sólo estos):**
- Modify: `apps/studio/src/features/catalog/CategoryTree.tsx`
- Modify: `apps/studio/src/features/Catalog.tsx`
- Modify: `apps/studio/src/App.tsx`
- Create: `tests/e2e/bugfix-crashes.spec.ts` (nuevo, no tocar specs existentes)

**Defectos (evidencia de la caza):**
- ST-B1: `CategoryTree.tsx:188-198` deja elegir como padre a otra raíz aunque la categoría movida tenga hijos → `core` `category.reparent` (`packages/core/src/index.ts:293-307`) → `parseProject` lanza ZodError "Las categorías sólo pueden tener un nivel de subcategorías" (schema `index.ts:553-558`) dentro del updater de `setHistory` (`Studio.tsx:390-392`) → sin error boundary, app en blanco.
- ST-B2: `Catalog.tsx:761-778` `applyPriceAdjustment` no valida porcentaje < -100 antes de `onCommand` → `packages/core/src/index.ts:152-154` lanza "El porcentaje no puede reducir el precio por debajo de cero" → mismo crash.

- [ ] **Step 1: Tests E2E que fallan (RED)**
`tests/e2e/bugfix-crashes.spec.ts` (patrón de boot de `editor-smoke.spec.ts`): (a) abrir Catálogo → Categorías, reubicar `textiles` (tiene hijos) bajo otra raíz: el `<select>` de "Nuevo padre" debe tener la opción deshabilitada y el botón confirmar deshabilitado — la app sigue viva (el header `ui-tab` sigue visible); (b) seleccionar un producto, panel bulk → "Ajuste: Porcentaje", escribir `-150`, "Ajustar precios": el campo muestra error inline y la app no se desmonta (asertar que `ui-status-bar` sigue presente). Ejecutar y verificar que (a) hoy commitea el crash (blanco) — si el flujo UI exacto difiere, adaptar selectores al render real.
- [ ] **Step 2: Implementar**
(a) `CategoryTree.tsx`: en el `<select>` de "Nuevo padre" y en el estado del diálogo, bloquear las categorías raíz que tienen hijos (`blockedParentIds` ya cubre self+descendants: agregar `hasChildren`): opción `disabled` + hint "Debe permanecer como raíz". (b) `Catalog.tsx` `applyPriceAdjustment`: para `basis: "percentage"`, si `value < -100` → error inline en el panel (mismo estilo que los errores existentes) sin dispatch; reutilizar la constante -10_000 como `-100 * 100` si la UI trabaja en puntos base (verificar cómo llega el valor). (c) `App.tsx`: envolver con un `ErrorBoundary` de clase mínimo (nuevo componente en el mismo archivo o `apps/studio/src/features/ErrorBoundary.tsx` — decidir en implementación): ante error, renderizar pantalla con mensaje, `console.error`, y botón "Recargar" (`window.location.reload()`); mantener `aria-live="assertive"`.
- [ ] **Step 3: GREEN**
`corepack pnpm --filter @solara/studio test` PASS · `typecheck` PASS · `corepack pnpm exec playwright test tests/e2e/bugfix-crashes.spec.ts tests/e2e/editor-smoke.spec.ts` GREEN · biome sobre los 3 archivos + spec · `git diff --check` limpio.
- [ ] **Step 4: Commit**
`git add apps/studio/src/features/catalog/CategoryTree.tsx apps/studio/src/features/Catalog.tsx apps/studio/src/App.tsx tests/e2e/bugfix-crashes.spec.ts` → `git commit -m "Evita dos crashs del editor y agrega un límite de error"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/bugfix2-t1-report.md`

---

### Task 2 — Studio: error de validación visible sin servidor + diálogo 409 con Escape e inert (ST-B3 + ST-B9) — [Agente B]

**Files (sólo estos):**
- Modify: `apps/studio/src/features/Studio.tsx`
- Modify: `tests/e2e/editor-a11y.spec.ts`

**Defectos:** ST-B3: `Studio.tsx:611` pasa `validationError` sólo a `ManagedPersistenceControls`; en modo IndexedDB (sin servidor) un `replaceProject` inválido (p. ej. SEO title vacío `Seo.tsx:172-186`) se descarta en silencio (`Studio.tsx:375-388`) sin feedback. ST-B9: el diálogo 409 (`Studio.tsx:797-867`, `role="dialog" aria-modal="true"`) sólo atrapa Tab (`trapConflictFocus` 168-183): Escape no hace nada y el fondo no es `inert` (un lector de pantalla llega al contenido trasero).

- [ ] **Step 1: E2E que falla (RED)** en `editor-a11y.spec.ts` (patrón existente): (a) en modo navegador (sin servidor — ver cómo el spec arranca sin managed), ir a SEO, limpiar el título hasta vacío y salir del campo: debe aparecer el mensaje de error de validación en la barra de estado (o en línea) — hoy no aparece nada; (b) provocar el diálogo 409 (patrón de `editor-shell.spec.ts` con servidor de pruebas): pulsar Escape → el diálogo se cierra eligiendo "Conservar borrador" (no queda abierto) y el fondo queda `inert` mientras está abierto (asertar `inert` en el contenedor de la app). Verificar selectores reales al implementar.
- [ ] **Step 2: Implementar** (a) renderizar `validationError` también en el branch no-managed del statusbar (mismo `<InlineError>`/clase que usa `ManagedPersistenceControls.tsx:144-146`); (b) en el manejador `onKeyDown` del overlay 409: `Escape` → `onKeepDraft()`; (c) al abrir el diálogo poner `inert` en el contenido trasero (envolver el contenido de la app en un contenedor con id, o usar el patrón existente del diálogo de confirmación si ya lo hace — verificar y copiar el patrón), y quitarlo al cerrar.
- [ ] **Step 3: GREEN** `--filter @solara/studio test` + `typecheck` PASS · `playwright test tests/e2e/editor-a11y.spec.ts tests/e2e/editor-shell.spec.ts` GREEN · biome + diff-check limpios.
- [ ] **Step 4: Commit** → `git commit -m "Muestra el error de validación sin servidor y completa el diálogo 409"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/bugfix2-t2-report.md`

---

### Task 3 — Guard de eliminación de assets incluye logo e imagen social (ST-B4) — [Agente C]

**Files:** Modify: `apps/studio/src/lib/assetUses.ts` · Modify: `apps/studio/src/lib/assetUses.test.ts`

**Defecto:** `assetUses()` (`assetUses.ts:26-61`) cubre productos/variantes/videos/categorías/colecciones/secciones pero omite `project.identity.logoAssetId` y `project.seo.socialImageId` (ambos validados como media por schema `index.ts:859-876`); `Assets.tsx:537-549` habilita "Eliminar" con "Sin usos" y el borrado falla en silencio (T2) o con error confuso.

- [ ] **Step 1: Test que falla** en `assetUses.test.ts` (patrón existente): proyecto con `identity.logoAssetId` y `seo.socialImageId` apuntando a un asset → `assetUses(project, assetId)` devuelve uso para ambos; y el test de borrado-via-replace (si existe) incluye esos campos.
- [ ] **Step 2: Implementar** agregar ambos campos al conjunto de usos (con etiqueta descriptiva, p. ej. `"Logo de la tienda"` / `"Imagen social"`), siguiendo el patrón de los usos existentes.
- [ ] **Step 3: GREEN** `--filter @solara/studio test` + `typecheck` PASS · biome + diff-check.
- [ ] **Step 4: Commit** → `git commit -m "El guard de eliminación de assets considera logo e imagen social"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/bugfix2-t3-report.md`

---

### Task 4 — Export: botón de producción deshabilitado hasta la auditoría + aviso honesto sin servidor (ST-B5 + ST-B6) — [Agente D]

**Files:** Modify: `apps/studio/src/features/Export.tsx` (sólo éste; si hace falta un spec nuevo, `tests/e2e/bugfix-export.spec.ts`)

**Defectos:** ST-B5: `Export.tsx:105-120` calcula `critical` de forma asíncrona; `:398-405` habilita "Exportar producción" hasta que resuelve (race; también al alternar `publicAiContext`). ST-B6: `:149-151` el aviso "El sitio público se guarda en proyectos/<tienda>/sitios/…" se muestra siempre, incluso en modo navegador donde el sitio exportado se descarta.

- [ ] **Step 1: Tests que fallan** (spec nuevo o E2E existente): (a) store con errores críticos (patrón de `editor-export`/`editor-workers`) — en el primer render el botón está deshabilitado (hoy habilitado); aserción de `disabled` en `ui-export-production`; (b) modo navegador sin launcher (arranque del spec sin servidor): el aviso no menciona `proyectos/` cuando no hay storage administrado.
- [ ] **Step 2: Implementar** (a) estado `auditReady` inicializado en `false`, seteado tras la primera resolución de `auditReport`, incluido en `disabled`; resetear a `false` al cambiar `publicAiContext` y volver a auditar; (b) condicionar el texto del aviso a la presencia del storage administrado (prop que el panel ya recibe para `onOpenSite` — verificar nombre; en modo navegador usar el aviso de descarte existente o uno neutro).
- [ ] **Step 3: GREEN** `--filter @solara/studio test` + `typecheck` · `playwright test tests/e2e/editor-export.spec.ts` (si existe; si no `editor-console.spec.ts`) + el spec nuevo · biome + diff-check.
- [ ] **Step 4: Commit** → `git commit -m "Deshabilita el export de producción hasta auditar y honra el modo navegador"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/bugfix2-t4-report.md`

---

### Task 5 — Dashboard: la auditoría de salud no aborta el resto de tiendas (ST-B7) — [Agente E]

**Files:** Modify: `apps/studio/src/features/Dashboard.tsx` (sólo éste)

**Defecto:** `Dashboard.tsx:639-657`: si una tienda tarda > 300 ms (`setAuditSkipped(true); return;`) aborta TODO el bucle: el resto queda sin auditar y el chip dice "Auditoría omitida (catálogo grande)" con catálogos chicos.

- [ ] **Step 1: Test** (si `dashboardModel.test.ts` cubre el modelo, agregar caso; si el bucle vive en el componente, verificar por E2E de dashboard existente + caso de 2 tiendas donde la primera es lenta — si no se puede inducir determinísticamente, documentar la verificación manual en el reporte y cubrir con unit si el modelo es extraíble; si no es extraíble, mínimo: corregir y verificar con los E2E existentes de dashboard).
- [ ] **Step 2: Implementar** `continue` en lugar de `return` para saltar sólo la tienda lenta (y contabilizar la omisión por tienda, no global).
- [ ] **Step 3: GREEN** `--filter @solara/studio test` + `typecheck` · `playwright test tests/e2e/dashboard.spec.ts` (o el spec de dashboard existente; verificar nombre) · biome + diff-check.
- [ ] **Step 4: Commit** → `git commit -m "La auditoría de salud del dashboard salta sólo la tienda lenta"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/bugfix2-t5-report.md`

---

### Task 6 — Builder: trampa de foco del selector de módulos + número vacío = inválido (ST-B8 + ST-B12) — [Agente F]

**Files (sólo estos):**
- Modify: `apps/studio/src/features/Builder.tsx`
- Modify: `apps/studio/src/features/builder/SettingsInspector.tsx`
- Modify: `apps/studio/src/features/builder/RepeaterEditor.tsx`
- Modify: `tests/e2e/editor-a11y.spec.ts` (si el Agente B ya lo tocó, anexar sin pisar — leer el archivo primero)

**Defectos:** ST-B8: ModulePicker (`Builder.tsx:111-183`) es `role="dialog"` sin `aria-modal` ni trampa de Tab (Escape sólo dentro del contenedor). ST-B12: `SettingsInspector.tsx:112` y `RepeaterEditor.tsx:164-170` hacen `Number(event.target.value)` → campo numérico vaciado commitea `0` (rechazado por schema o silenciosamente aceptado donde 0 es válido).

- [ ] **Step 1: E2E que falla** en `editor-a11y.spec.ts`: abrir "Agregar sección" (`ui-module-picker`), Tab repetido → el foco NO sale del diálogo (hoy escapa al panel); y `aria-modal` presente. Si no se puede asertar el trap de forma robusta, al menos `aria-modal="true"` + foco inicial en el buscador (`ui-module-search`) al abrir.
- [ ] **Step 2: Implementar** (a) ModulePicker: `aria-modal="true"`, foco inicial en el input, trampa de Tab (mismo patrón que `trapConflictFocus` en `Studio.tsx:168-183` o un helper compartido si ya existe); (b) en ambos editores numéricos: si `event.target.value.trim() === ""` no commiteear (dejar el draft sin ese campo o mostrar error de campo requerido según el schema del campo — verificar cómo tratan los campos vacíos los otros tipos); si el campo no es required, no commiteear y mantener el valor previo.
- [ ] **Step 3: GREEN** `--filter @solara/studio test` + `typecheck` · `playwright test tests/e2e/editor-a11y.spec.ts tests/e2e/editor-builder.spec.ts` (si existe; verificar) · biome + diff-check.
- [ ] **Step 4: Commit** → `git commit -m "Atrapa el foco del selector de módulos y no commitea números vacíos"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/bugfix2-t6-report.md`

---

### Task 7 — Storage: 7 fixes del servidor local (EX-B1/B2/B4/B5/B6 + EX-T1/T2) — [Agente G]

**Files (sólo estos — agente propietario exclusivo):**
- Modify: `packages/exporter/scripts/local-project-storage.mjs`
- Modify: `packages/exporter/scripts/solara-request-handler.mjs`
- Modify: `packages/exporter/src/local-project-storage.test.mjs`
- Modify: `packages/exporter/src/solara-request-handler.test.mjs` (si existe; verificar)

**Defectos (todos con evidencia de la caza):**
- EX-B1 (open-site stale): `solara-request-handler.mjs:274-285` cachea `siteServers` por projectId y devuelve el servidor viejo tras un nuevo guardado; el sitio nuevo vive en `sitios/<key>` nuevo (`local-project-storage.mjs:482,494`). Fix: guardar `key` del `lastValidSite` al abrir; si el manifest actual tiene otra key, cerrar el server anterior y crear el nuevo (o responder con la URL nueva al usuario).
- EX-B2 (lock leak): `beginSave` (`local-project-storage.mjs:421-423`) hace `projectLocks.add` + `transactions.set` ANTES de `writeJsonAtomic(transaction.json)`; si el write falla, lanza sin transactionId y el lock queda hasta reiniciar. Fix: escribir el marcador primero y registrar lock/transacción después, o try/catch que limpie ambos.
- EX-B4 (remove-old-current): `local-project-storage.mjs:552-557` el `rm(oldCurrent)` está FUERA del try/catch de T8 y antes del cleanup `transactions.delete`/`projectLocks.delete` (`:559-560`): un fallo (OneDrive/EACCES) devuelve error para un save ya commiteado y puede dejar el lock. Fix: mover el `rm(oldCurrent)` dentro de un bloque no-fatal (try/catch con log) o hacer el cleanup en `finally`; el `remove-old-current` op de writeGuard conserva su propósito de test (si se vuelve no-fatal, ajustar el test existente si lo hay).
- EX-B5 (sitios/ sin poda): tras commit exitoso, `sitios/` acumula una carpeta por guardado para siempre; y un fallo entre `rename(temporarySite, finalSite)` (`:494`) y el manifest deja `sitios/<key>` huérfano (T8 sólo limpia el archive). Fix: (a) al éxito, borrar las carpetas `sitios/*` que no sean la `lastValidSite` actual (conservando la anterior si `remove-old-current` no la movió — verificar qué carpetas son "válidas" con el manifest); (b) en el try/catch de manifest (T8), si `siteInfo` ya se renombró, borrar también `sitios/<key>` del intento fallido (sólo cuando el manifest no se escribió).
- EX-B6 (tmp litter): `writeJsonAtomic` (`local-project-storage.mjs:97-101`) no borra el `.tmp-*` si el write falla. Fix: try/catch que borre el temp y re-lance (mismo patrón en `legacy-zip-migration.mjs:39-44` y `portable-layout.mjs:79-83` si aplica — NO tocar esos archivos si no es estrictamente necesario; priorizar el storage).
- EX-T1 (test faltante): agregar un punto de falla que cubra la ventana post-rename → pre-manifest. Opciones: agregar un checkpoint `after-site-rename` dentro del try de manifest, o un guard `rename-site` que falle en la segunda llamada… lo correcto: agregar el checkpoint nuevo y un test que falla en esa etapa y aserta que `sitios/` no queda con el directorio del intento (y `actual/` tampoco, T8).
- EX-T2 (test faltante): test con `writeGuard` op `remove-old-current` fallando → el commit resuelve OK (no es fatal) o el lock se libera (según el fix de EX-B4).

- [ ] **Step 1: Tests que fallan (RED)** — al menos 4 tests nuevos: (1) fallo en el write de `transaction.json` de `beginSave` (writeGuard sobre la escritura del marcador — verificar si el guardWrite alcanza esa escritura; si no, inyectar el fallo con un nuevo hook o mock) → `beginSave` rechaza y un segundo `beginSave` de la misma tienda funciona; (2) fallo de `remove-old-current` → `commit` resuelve y el siguiente `beginSave` no ve lock; (3) tras un commit exitoso con 2+ sitios previos, `sitios/` conserva sólo el último (y el anterior si es `lastValidSite` anterior); (4) fallo en la etapa post-rename (checkpoint nuevo `after-site-rename`) → ni `actual/` ni `sitios/` tienen restos del intento.
- [ ] **Step 2: Implementar** los 6 fixes (ver recetas arriba; respetar el contrato de respuestas del handler: open-site sigue devolviendo `{ ok: true, url }`).
- [ ] **Step 3: GREEN** `corepack pnpm --filter @solara/exporter test` PASS (todos, incl. junction de T4 y writeGuard de T8) · `corepack pnpm exec playwright test tests/e2e/local-storage.spec.ts` GREEN · biome + diff-check limpios · 0 U+FFFD.
- [ ] **Step 4: Commit** → `git commit -m "Endurece el servidor local: locks, poda de sitios y estado huérfano"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/bugfix2-t7-report.md`

---

### Task 8 — Runtime: carrito robusto y checkout con precios frescos (C2/C3/C5/C9/C10 + SF-B4/B5/B10 + SF-B6) — [Agente H]

**Files (sólo estos):**
- Modify: `packages/storefront-runtime/src/index.ts`
- Modify: `packages/storefront-runtime/src/index.test.ts`

**Defectos (evidencia de la caza):**
- C3 (crash): `parseCart` (`index.ts:146-156`) valida sólo `variantId`/`quantity`; una línea antigua sin `title`/`variantTitle` hace `TypeError` en `escapeText` (`:200-236`) dentro de `renderCart` en boot (`:1253`) y TUMBA todo el runtime. Fix: validar tipos (`typeof line.title === "string"` etc.) en el filtro o try/catch por línea.
- C2 (Enter): el form `[data-solara-add-form]` (`action="/carrito/" method="get"`) sólo se intercepta por CLICK (`index.ts:426-458`); Enter en quantity/variant hace submit nativo GET → carrito vacío. Fix: agregar listener `submit` en `[data-solara-add-form]` que prevenga y ejecute la misma lógica (extraer el handler compartido).
- SF-B4 (precios stale): el checkout del drawer (`index.ts:507-558`) construye el mensaje de WhatsApp con `line.unitPrice` de localStorage; la reconciliación con `catalog-index.json` (`:560-602`) corre sólo en cart/checkout. Fix: reconciliar (fetch + merge) al ABRIR el drawer y en el submit del checkout (compartir resultado en una variable de sesión; manejar `.catch` sin romper: si el fetch falla, seguir con lo local pero no romper).
- C10 (consistencia): la misma reconciliación compartida elimina la divergencia drawer-vs-página (el fix de SF-B4 cubre esto; documentar).
- C5 (a11y): el toggle `[data-solara-cart-open]` nunca recibe `aria-expanded` (los de búsqueda sí, `:788-801`). Fix: setear `aria-expanded` en `openCart`/`closeCart` (y en boot).
- C9 (quantity): (a) al editar cantidad, el re-render completo de `[data-cart-lines]` pierde el foco — mínimo viable: conservar el foco del input editado tras re-render (guardar el `data-variant-id` del input activo y re-focar el equivalente; si es frágil, alternativa aceptada: no hacer nada y documentar); (b) vaciar el input borra la línea silenciosamente (`Math.max(0, ...)` = 0 → filtrado). Fix mínimo: en el blur/change, si el valor parseado es `""` o `0`, restaurar el valor previo de la línea (no borrar).
- SF-B5 (actionLabel): `syncVariant` (`:337-340`) sobreescribe `textContent` con "Agregar al carrito"/"Sin stock" ignorando `actionLabel` custom del módulo. Fix: leer el label inicial del botón una vez (atributo `data-action-label` que el módulo ya podría emitir — si no existe, leer `textContent` inicial en boot) y usarlo en `syncVariant`; "Sin stock" se mantiene fijo.
- SF-B10 (a11y): `[data-cart-subtotal]`/`[data-cart-total]` sin `aria-live`. Fix: `aria-live="polite"` en los elementos al renderizar (o un contenedor).
- SF-B6 (direction): `direction` del schema (`up|down|left|right`) sólo funciona para `slide+left`; los keyframes `solara-motion-slide` son horizontales. Fix CSS: agregar keyframes `solara-motion-slide-up/down/right` (o variantes con `--motion-slide-x/y`) y reglas `[data-motion-direction="up"|"down"|"right"]` para slide; `fade-up` queda como está (vertical up) — documentar que `direction` en fade-up no aplica (o restringir en el inspector — NO tocar schema). Mantener el conjunto reducido y el budget.

- [ ] **Step 1: Tests que fallan (RED)** en `index.test.ts` (patrón existente: tests de serialización y presets): (1) `parseCart` con línea sin `title` → no lanza y la línea se descarta (exportar `parseCart` si no está exportada — respetar el estilo del archivo); (2) el runtime serializado contiene el listener de submit para `data-solara-add-form` (aserto sobre el string serializado); (3) el serializado contiene `aria-expanded` actualizado en open/close cart; (4) los keyframes nuevos (slide-up/down/right) presentes en el CSS serializado y las reglas de direction.
- [ ] **Step 2: Implementar** los 8 fixes. **Cuidado con el budget**: medir `corepack pnpm exec vitest run scripts/public-storefront-budget.test.ts` (JS ≤ 52 KiB).
- [ ] **Step 3: GREEN** `--filter @solara/storefront-runtime test` PASS · budget test PASS · `corepack pnpm exec vitest run scripts/runtime-serialization.test.ts` PASS · `playwright test tests/e2e/editor-motion.spec.ts tests/e2e/storefront-cart.spec.ts` (si existe el spec de carrito; verificar nombre — si no, `catalog-modern.spec.ts` que incluye compra) GREEN · biome + diff-check · 0 U+FFFD.
- [ ] **Step 4: Commit** → `git commit -m "Endurece el carrito, refresca precios y completa motion y a11y del runtime"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/bugfix2-t8-report.md`

---

### Task 9 — Módulo catalog-modern: no-JS, variante inicial y gating de búsqueda (C1/C4/C7 + SF-B1/B9) — [Agente I]

**Files (sólo estos):**
- Modify: `packages/modules/src/catalog-modern.ts`
- Modify: `packages/modules/src/definitions.ts` (sólo si el fallback no-JS o el gating aplican a legacy — verificar)
- Modify: `packages/modules/src/styles.ts`

**Defectos:**
- C1 (no-JS add-to-cart muerto): `catalog-modern.ts:749-756` el form GET a `/carrito/` no tiene lectura server-side de query (página estática) y no hay `<noscript>` cerca. Fix: en el form, renderizar también `<noscript><a class="catalog-add-fallback" href="wa.me link con producto+variante">Consultar por WhatsApp</a></noscript>` con el enlace wa.me armado server-side (phone del proyecto, texto con nombre+precio+variante — reutilizar la función de armado de mensaje del exporter si está exportada; si no, armar en el módulo con los datos del producto) y CSS `.catalog-add-fallback { display: none }` + dentro del noscript un `<style>` que lo muestre y oculte el botón.
- C4 (variante agotada primero): `catalog-modern.ts:682-690` emite los `<option>` sin `selected`; el navegador elige `variants[0]` (agotado) mientras `firstVariant` (`:647-648`) es la disponible. Fix: emitir `selected` en el option cuyo id = `firstVariant.id` (o `data-default-variant`).
- C7 (no-JS nav móvil muerta): `styles.ts:2195-2202` oculta el nav desktop ≤ 767 px y `.catalog-mobile-menu[hidden]` (`catalog-modern.ts:225`) sólo se revela con JS. Fix: en el header, dentro de `<noscript>`, un `<style>` que fuerce `.catalog-mobile-menu[hidden]{display:block}` (el panel es navegación: visible sin JS es aceptable) — verificar que el panel contenga enlaces reales.
- SF-B1 (búsqueda deshabilitada → links muertos a `/buscar/` 404): el botón está gateado (`catalog-modern.ts:209-212`) pero el diálogo (`:226-232`), el form móvil (`:225`) y links del footer/mega-menu/bento (`:184,875,1033`) no. Fix: gatear todos con `navigation.showSearch && project.commerceTemplates.search.enabled` (mismo patrón que el botón y que legacy `definitions.ts:149`).
- SF-B9 (estados vacíos sin estilo): `.solara-cart-empty` (inyectado por runtime) sin CSS; `.solara-empty-state` del filtro de categoría sin estilo fuera de product-detail/cart-drawer. Fix: estilos para `.solara-cart-empty` y para el empty-state del filtro en el scope de categoría (`.catalog-category-layout .solara-empty-state` o equivalente).

- [ ] **Step 1: Tests que fallan (RED)** — E2E storefront: (a) exportar `catalogModernStore` y abrir una página de producto SIN JS (`context.newPage()` con `javaScriptEnabled: false`): el form muestra el enlace de WhatsApp visible (asertar `a.catalog-add-fallback` con href `wa.me`); (b) producto con variante agotada primero (fixture pequeña o editar en memoria — ver cómo los specs de storefront cargan fixtures; si no hay fixture con agotado, crearla local al spec): el `<select>` inicial = variante disponible y el botón dice "Agregar al carrito" (no "Sin stock"); (c) store con `search.enabled: false`: el HTML no contiene `action="/buscar/"`.
- [ ] **Step 2: Implementar** los 5 fixes.
- [ ] **Step 3: GREEN** `--filter @solara/modules test` (si existe) o el test del paquete correspondiente · `corepack pnpm --filter @solara/exporter test` (si toca definiciones que el exporter usa) · `playwright test tests/e2e/catalog-modern.spec.ts tests/e2e/storefront-nojs.spec.ts` (nuevo o existente; verificar) GREEN · budget test PASS · biome + diff-check · 0 U+FFFD.
- [ ] **Step 4: Commit** → `git commit -m "Da salida sin JavaScript al carrito y la navegación y corrige el gating de búsqueda"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/bugfix2-t9-report.md`

---

### Task 10 — Exporter/optimizer: filtros legacy, thumbnail y CSP (SF-B2 + X2/X3 + SCH3-auditoría) — [Agente J]

**Files (sólo estos):**
- Modify: `packages/exporter/src/index.ts`
- Modify: `packages/site-optimizer/src/index.ts`
- Modify: tests del exporter/site-optimizer que correspondan (verificar nombres)

**Defectos:**
- SF-B2 (filtros modernos en páginas legacy siempre vacíos): `index.ts:1300-1327` emite `catalog-category-layout` + `modernCategoryFilters` sin guard `isModernProject`; las cards legacy no llevan `data-product-options` (`helpers.ts:62`) → `options.includes(...)` siempre false → "No hay productos". Fix: gatear el layout/filtros modernos con el mismo branch que `listingSections` (`index.ts:875-880`); para legacy, no emitir el panel de opciones (o emitir `data-product-options` en cards legacy — decidir por el menor cambio y documentar).
- X2 (thumbnail = baseUrl desnudo): `index.ts:944-947` y `:1719-1727` usan `imageUrl(...) ?? ""` → `absoluteResourceUrl("")` = `baseUrl` cuando `posterAssetId` no resuelve. Fix: si el poster no resuelve, omitir `thumbnailUrl`/`video:thumbnail_loc` (condición), y asertar en tests.
- X3 (CSP sin media remota): `_headers` (`index.ts:2223`) tiene `default-src 'self'; img-src 'self' data: https:;` sin `media-src` → `<video>` remoto bloqueado; `img-src` sin `http:`. Fix: `media-src 'self' https: http:;` y `img-src 'self' data: https: http:;` (o documentar restricción — decidir con prueba: el schema acepta cualquier source).
- SCH3 (sourceId sin validar): `site-optimizer` `buildRoutes`/audit no detecta secciones catalog cuyo `settings.sourceId` apunta a una colección/categoría inexistente. Fix: en la auditoría (donde viven los checks de merchant/seo — ver `site-optimizer/src/index.ts`), agregar un warning/error de auditoría: sección `source`/`sourceId` sin colección o categoría existente (proyecto completo, no por página), con test.

- [ ] **Step 1: Tests que fallan (RED)**: (1) exportar `catalogScaleStore` (legacy): la página de categoría NO contiene `catalog-category-layout`/`data-category-option`; (2) proyecto con hero poster inválido: el JSON-LD no contiene `thumbnailUrl` con la baseUrl desnuda (aserto contra baseUrl exacto) y el video sitemap omite el thumbnail; (3) proyecto con sección catalog apuntando a colección inexistente: el reporte de auditoría incluye la advertencia.
- [ ] **Step 2: Implementar** los 4 fixes (sin tocar schema; sin cambiar URLs del sitio público en production).
- [ ] **Step 3: GREEN** `--filter @solara/exporter test` PASS · `--filter @solara/site-optimizer test` PASS · budget test PASS · `playwright test tests/e2e/scale-store.spec.ts tests/e2e/catalog-modern.spec.ts` GREEN · biome + diff-check.
- [ ] **Step 4: Commit** → `git commit -m "Corrige filtros legacy, thumbnail inválido y la auditoría de secciones huérfanas"`
- [ ] **Step 5: Reporte** `.superpowers/sdd/bugfix2-t10-report.md`

---

### Task 11 — Shell/launcher: crash dialog, IPC muerto, EADDRINUSE y versionado de Node (D2/D3/D6/L1/L2) — [Agente K]

**Files (sólo estos):**
- Modify: `apps/desktop/src/main.mjs`
- Modify: `apps/desktop/src/preload.mjs`
- Modify: `packages/exporter/scripts/serve.mjs`
- Modify: `scripts/open-solara.ps1`
- Modify: `scripts/create-portable-distribution.mjs`

**Defectos:** D2: sin `render-process-gone`/`unresponsive` (crash silencioso). D3: puente IPC `solaraDesktop` (preload `:8-13` + 4 handlers `main.mjs:173-199`) sin uso en Studio (grep `solaraDesktop` → 0 hits) — remover o documentar. D6: `serve.mjs:64-67` EADDRINUSE crudo. L1: `create-portable-distribution.mjs:32-47` no copia `scripts/open-solara.ps1` que `Abrir SolaraCommerce.cmd:10` referencia. L2: `open-solara.ps1:75-80` verifica presencia de node, no versión ≥ 22 (el mensaje lo promete).

- [ ] **Step 1: Implementar** (tests difíciles para UI de Electron: verificación manual + smoke): (a) D2: `win.on("render-process-gone", ...)` y `win.webContents.on("unresponsive", ...)` → `dialog.showErrorBox` con mensaje claro + recarga sugerida (reutilizar el patrón de `dialog` ya usado en el startup error `:162-169`); (b) D3: remover los 4 handlers IPC y el bridge de `preload.mjs` si ningún código los usa (verificar con grep en `apps/studio` y `docs/PORTABILITY.md` — si el doc los documenta como usados, actualizar el doc en la Task 12 o dejarlo anotado en el reporte); (c) D6: `server.once("error", ...)` → si `code === "EADDRINUSE"` mensaje claro "El puerto X ya está en uso por otra instancia de SolaraCommerce" y salida ordenada; (d) L1: copiar `scripts/open-solara.ps1` en la distribución portable (lista de copias en `create-portable-distribution.mjs`); (e) L2: en `open-solara.ps1`, leer `node -v`, parsear major, y si < 22 mostrar el mensaje correcto y salir.
- [ ] **Step 2: Verificar** `corepack pnpm --filter @solara/desktop typecheck` (si existe) · `corepack pnpm desktop:build` PASS · `corepack pnpm portable:smoke` OK (prueba el CMD/PS1 en la distribución portable) · biome + diff-check.
- [ ] **Step 3: Commit** → `git commit -m "Endurece el shell: crash visible, puerto ocupado y Node 22"`
- [ ] **Step 4: Reporte** `.superpowers/sdd/bugfix2-t11-report.md`

---

### Task 12 — Specs y docs: hardening + números (S1/S2/S3/D5/M2/DOC1-3) — [Agente L]

**Files (sólo estos):**
- Modify: `tests/e2e/editor-console.spec.ts` (S1: `:105-108` click condicional silencioso → aserción dura o remover)
- Modify: `tests/e2e/catalog-modern.spec.ts` (S2: `:259,282,424` regex `name: /Abrir/` → nombre exacto/único; D5: `:64` puerto 4175 → 0)
- Modify: `tests/e2e/editor-catalog.spec.ts` (S3: `:62-63,73` sort débil → comparar arrays completos)
- Modify: `tests/e2e/exported-store.spec.ts` (D5: `:60` puerto 4175 → 0)
- Modify: `tests/e2e/scale-store.spec.ts` (D5: `:58` puerto 4176 → 0)
- Modify: `packages/exporter/src/index.test.ts` (M2: `:478` título del test "cuando el transporte es parent" → "cuando el modo es draft")
- Modify: `HANDOFF.md` (DOC1: `:86-89,181-182,232-233` "84 KiB" → "100 KiB"; números JS informativos coherentes)
- Modify: `docs/DATA_MODEL.md` (DOC2: `:41` seo sin `robots`, `baseUrl` es project-level; DOC3: `:63,117-118` `name` → `title` en Category)

- [ ] **Step 1: Implementar** los 8 ajustes (sin cambiar comportamiento de specs salvo lo listado; cada cambio con su justificación en el commit).
- [ ] **Step 2: Verificar** `corepack pnpm exec playwright test tests/e2e/editor-console.spec.ts tests/e2e/editor-catalog.spec.ts tests/e2e/catalog-modern.spec.ts tests/e2e/exported-store.spec.ts tests/e2e/scale-store.spec.ts` GREEN · `--filter @solara/exporter test` PASS · `git diff --check` · 0 U+FFFD en los docs.
- [ ] **Step 3: Commit** → `git commit -m "Endurece specs y alinea docs con el schema"`
- [ ] **Step 4: Reporte** `.superpowers/sdd/bugfix2-t12-report.md`

---

### Task 13 — Cierre: deuda, CHANGELOG, gates, ejecutables, push

**Files:** Modify: `docs/TECHNICAL_DEBT.md` · Modify: `CHANGELOG.md` · Modify (si aplica): `HANDOFF.md`

- [ ] **Step 1: Deuda** — marcar RESUELTAS (con commits) las filas de: crash reparent/porcentaje, guard de assets (logo/social), export audit race, dashboard health, module picker focus, números vacíos, open-site stale, lock leak, remove-old-current, sitios/ poda, parseCart, submit Enter, precios stale, no-JS carrito, variante inicial, gating búsqueda, filtros legacy, thumbnail inválido, CSP media, IPC muerto, EADDRINUSE, Node 22 launcher. Añadir filas nuevas si no existían. Dejar ABIERTAS: fflate/legacy-zip, matriz OS, sandbox Electron, Node 22 CI, WhatsApp Merchant, publicación manual, 409 auto-merge, no-JS búsqueda server-side (C8), `pagina/1` redirect, print styles, transaction TTL, `sitios/` retención futura, baseUrl subcarpeta (X1), dead feature flags (B3), motion direction en fade-up, `pagina/99` 404, mobile menu inert (B13), SCH1/SCH2 (schema sin tocar).
- [ ] **Step 2: CHANGELOG** — entrada "Revisión de bugfixes 2 (2026-08-09)" listando los fixes por área (texto propio, formato Keep a Changelog, en español).
- [ ] **Step 3: Gates completos** `corepack pnpm check` · `corepack pnpm build` · `corepack pnpm check:budgets` · `corepack pnpm benchmark:export` · `corepack pnpm test:e2e` · `git diff --check` · `corepack pnpm check:repository` — todos PASS (los corredores de la ola y el cierre; si el runtime excede el budget JS, volver a la Task 8).
- [ ] **Step 4: Ejecutables** `corepack pnpm desktop:build` · `corepack pnpm desktop:package` · `corepack pnpm portable:smoke` — OK.
- [ ] **Step 5: Commit y push** `git add docs/TECHNICAL_DEBT.md CHANGELOG.md HANDOFF.md` → `git commit -m "Cierra la revisión de bugfixes 2"` → `git push origin main`.
- [ ] **Step 6: Verificación final** `git log --oneline -15`, `git status --porcelain` vacío salvo reportes ignorados, ledger `.superpowers/sdd/progress.md` actualizado.

---

## Self-Review (autor del plan)

- **Cobertura:** cada hallazgo accionable de las 5 cazas tiene tarea: crashes ST-B1/ST-B2→T1; ST-B3/ST-B9→T2; ST-B4→T3; ST-B5/ST-B6→T4; ST-B7→T5; ST-B8/ST-B12→T6; EX-B1/B2/B4/B5/B6+EX-T1/T2→T7; C2/C3/C5/C9/C10+SF-B4/B5/B10/B6→T8; C1/C4/C7+SF-B1/B9→T9; SF-B2+X2/X3+SCH3→T10; D2/D3/D6/L1/L2→T11; S1/S2/S3/D5/M2/DOC1-3→T12; cierre→T13. Diferidos documentados (C6/C8/C11, SF-B3/B7/B8/B11/B12/B13, EX-B7/B8/B9, H1/H2, P2/P3, D1/D4/D7, SCH1/SCH2, X1/X4/X5).
- **Conflictos de archivos:** tabla de propietarios disjunta (verificada: Studio.tsx sólo T2; Dashboard sólo T5; runtime sólo T8; módulos sólo T9; storage+handler sólo T7; specs: T12 es único editor de specs existentes, T1/T4 crean specs nuevos).
- **Contratos:** sin cambios de schema; budget JS ≤ 52 KiB verificado en T8; serialización cubierta en T8.
- **Placeholders:** los pasos "verificar nombre/patrón al implementar" indican exactamente qué verificar y la decisión permitida si difiere.
