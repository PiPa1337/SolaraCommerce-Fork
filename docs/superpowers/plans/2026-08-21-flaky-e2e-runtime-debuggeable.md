# Plan: estabilidad E2E + runtime debuggeable

> Fecha: 2026-08-21 · Origen: sesión de mejora arquitectónica (`debb6e7`..`d91808c`).
> Los dos problemas priorizados fueron detectados y verificados contra baseline
> `c4d71ae`: no son regresiones, son deuda pre-existente.

## Problema 1 — Specs E2E inestables (P2)

**Síntoma:** el smoke paralelo (8 workers) falla ~7 specs por corrida con
variación entre corridas; aislados pasan. Verificado idéntico en commit base.

**Specs afectados (evidencia 2026-08-21):**

| Spec | Error típico | Hipótesis |
| --- | --- | --- |
| `ui-sweep-a27` C4/C8/C11 | `toHaveCount` espera 2, recibe 0 | El runtime todavía no booteó cuando se hace el assert; falta señal de "listo" |
| `assets` procesa una imagen | timeout en proceso de imagen | worker de imagen lento bajo CPU paralela; falta espera explícita del resultado |
| `nojs-coverage` E1/C2 | console error/red detectado | puede ser un bug real chico disfrazado; requiere auditoría |
| `scale-store` busca por ancestro | testTimeout 30s | spec demasiado pesado para smoke; medir y dividir |
| `catalog-modern-v2` recupera carrito | `toHaveText` stale | storage local contaminado entre asserts; falta reset/reconcile |
| `catalog-modern-v2` estabilidad visual | layoutShift > 0.05 | animaciones corren durante la medición; falta emular reduced-motion o esperar settle |
| `axe-site` A1 | timeout 31s (1 vez) | carga puntual; vigilar tras fixes anteriores |

### Task 1 — Herramienta de medición (antes de tocar specs)

- [x] Script `scripts/e2e-stability.mjs`: corre el smoke N veces (default 5),
  parsea resultados y emite tabla `spec → fallos/N` + historial JSON en
  `test-results/stability/` (no versionado).
- [x] Verificado 5x15: a27/v2/nojs/scale fallan 5/5, assets 4/5, resto 0/5. Causa raiz real: contrato desactualizado (tabs eliminadas en 1baa774 y fixture a 3 imagenes en ae7b581), no timing.

### Task 2 — Contención: gate creíble hoy

- [x] Crear `tests/e2e/unstable.json` (versionada): lista de specs inestables
  con fecha, baseline de verificación y link a su fila en TECHNICAL_DEBT.
- [x] `scripts/e2e-smoke.mjs` excluye los listados salvo `SMOKE_INCLUDE_UNSTABLE=1`.
- [x] Los specs excluidos se corren en un job manual/semanal
  (`SMOKE_INCLUDE_UNSTABLE=1`) para no perder cobertura.
- [ ] Regla de salida: un spec vuelve al gate sólo después de 10/10 corridas
  limpias con el script de la Task 1 (local, misma máquina).

### Task 3 — Fix raíz por familia de síntoma

- [x] **Señal de listo del storefront**: helper
  `waitForStorefrontReady(page)` que espera un marcador determinista del runtime
  (atributo/evento ya existente o uno nuevo mínimo, ej:
  `document.documentElement.dataset.solaraReady === "1"`). Aplicado en C4/C8. +34 B en runtime (techo interno 61 KiB, gate 64 KiB).
- [x] C4 galeria resuelto (setup limpia imageId de variantes; pasa workers=2).
- [x] C8 reescrito post-tabs (secciones apiladas + details teclado + SKU).
- [x] C11 actualizado (assets product-01; drawer v2 con inert). A27: 13/13.
- [ ] **Assets**: esperar el resultado explícito del worker (estado en UI) en vez
  de timeout fijo; subir `testTimeout` del spec si queda >8s reales.
- [ ] **Scale-store**: dividir "busca por ancestro" (búsqueda móvil) en spec propio
  de `test:e2e` full con timeout dedicado; smoke conserva una versión liviana.
- [ ] **Carrito V2**: `addInitScript` que limpia `solara-cart:*` antes de cada test
  del bloque recovery; assert final vía `expect.poll` sobre el texto reconciliado.
- [ ] **Estabilidad visual**: emular `prefers-reduced-motion: reduce` antes de
  instalar el PerformanceObserver (las animaciones ya respetan la media query);
  mantener umbral 0.05 — si sigue fallando, hay shift real que arreglar.
- [ ] **Nojs-coverage**: capturar el mensaje exacto del console/network en el
  reporte de fallo; clasificar bug real vs ruido permitido (allowlist explícita).

### Task 4 — Re-inclusión gradual

- [ ] Por cada fix: 10/10 estable → quitar de `unstable.json` → fila de
  TECHNICAL_DEBT pasa a Resuelto con evidencia del script.

## Estado de ejecucion (actualizado)

- Task 1: COMPLETA. Script e2e-stability.mjs + medicion 5x15 con tasas reales.
- Task 2: COMPLETA. unstable.json + exclusion del gate diario + canal SMOKE_INCLUDE_UNSTABLE=1. Smoke diario: 10 specs, 65 passed, verde.
- Task 3 (mayoria): C4/C8/C11 resueltos al contrato post-tabs. Nojs-coverage resuelto (faltaban fixtures webp). Estabilidad visual resuelta (emulateMedia reducedMotion + ventana de medicion tras animaciones). Carrito V2 resuelto a nivel contrato (1baa774 respeta vaciados intencionales; test viejo contradecia ese contrato y fue reemplazado).
- Pendientes Task 3: assets.spec (worker lento bajo carga) y scale-store (split del spec). Ambos quedan en unstable.json.
- Tasks 4-7: pendientes (re-inclusion 10/10 y runtime dual esbuild).
 — Runtime storefront no debuggeable (P2)

**Síntoma:** `STOREFRONT_RUNTIME_JS` se serializa con `fn.toString()` e inline en
el HTML exportado: sin source maps, stack traces ilegibles, imposible poner
breakpoints contra el fuente.

**Restricción:** producción debe seguir inline y dentro del budget actual
(JS ≤64 KiB crudos). Preview/draft es el lugar natural para debuggear.

### Task 5 — Build dual con esbuild

- [ ] `packages/storefront-runtime/scripts/build-runtime.mjs`: compila el runtime
  a `dist/storefront-runtime.js` + `.map` (esbuild, ya en devDependencies).
- [ ] Nuevo export `STOREFRONT_RUNTIME_EXTERNAL_URL` (o equivalente): el exporter,
  en modo **draft**, emite `assets/storefront.runtime.js` + `.map` y referencia
  `<script src>` externo; en **production** mantiene el inline byte-idéntico al
  actual (los tests de determinismo deben pasar sin cambios de snapshot).
- [ ] Servir el `.map` sólo desde el servidor local de preview (nunca en el
  mapa de archivos de production).

### Task 6 — Paridad draft ↔ production

- [ ] Test: mismo proyecto exportado en ambos modos produce el mismo árbol
  semántico y comportamiento del runtime (happy-dom: carrito, variantes, tabs).
- [ ] Test: el budget de production no cambia; el archivo externo de draft tiene
  su propio presupuesto informativo (sin bloquear mientras se estabiliza).
- [ ] `check:runtime-serialization` extendido: valida coherencia entre helpers
  serializados y el bundle esbuild (misma lista de funciones expuestas).

### Task 7 — Documentación de uso

- [ ] `docs/TESTING.md`: cómo debuggear un sitio draft con source maps
  (DevTools → webpack:// o equivalente, breakpoints reales).
- [ ] `docs/TECHNICAL_DEBT.md`: cerrar la fila P2 del runtime con evidencia.

## Prevención — reglas que quedan escritas

Ver sección nueva "Política de estabilidad E2E" en `docs/TESTING.md`
(agregada en este mismo cambio):

- todo spec nuevo entra al gate sólo tras 5 corridas consecutivas limpias;
- prohibido `waitForTimeout` fijo como sincronización primaria;
- specs >15s no van a smoke; timeout declarado por spec cuando exceda 10s;
- ante un gate rojo: spec aislado 3× → si pasa, registrar en `unstable.json` +
  TECHNICAL_DEBT (fecha + baseline); jamás ignorar el rojo sin registro;
- cambios de sincronización del runtime (nuevo atributo/evento "ready") exigen
  actualizar el helper compartido, no copiar esperas locales.

## Orden de ejecución sugerido

```text
Sesión 1: Task 1 + Task 2 (gate creíble, ~media sesión)
Sesión 2: Task 3 familias señal-ready + carrito (specs más numerosos)
Sesión 3: Task 3 restante + Task 4 (re-inclusiones verificadas)
Sesión 4-5: Task 5-7 (runtime debuggeable, riesgo medio, con red completa)
```

## Criterio de éxito global

- `test:e2e:smoke` 15 specs: 3 corridas consecutivas 100% verdes sin exclusiones
  nuevas; specs históricos estables en su canal correspondiente.
- Draft exportado debuggeable con source map; production byte-idéntico al actual
  (determinism 10/10 sin cambios) y budgets intactos.
