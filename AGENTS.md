# Guía de trabajo para agentes y desarrolladores

Este archivo es la primera lectura obligatoria para continuar SolaraCommerce.
Describe el contrato operativo del repositorio; la explicación detallada está
separada en [`docs/`](docs/), para no obligar a cada tarea a releer todo el código.

## Qué es el producto

SolaraCommerce es un estudio local-first para una persona que crea y administra
varias tiendas ecommerce. La aplicación se ejecuta localmente, crea una tienda
Catalog Modern editable, administra productos y categorías, muestra un preview y
exporta un sitio HTML/CSS/JavaScript estático. El checkout del storefront prepara
un pedido y lo abre en WhatsApp; no hay backend remoto ni pagos online.

El flujo principal es:

1. abrir el dashboard y seleccionar o crear una tienda;
2. completar la base guiada en `Preparar`, o habilitar `Modo avanzado`;
3. editar identidad, textos, imágenes, productos, categorías y SEO;
4. revisar las rutas en Preview;
5. guardar en disco cuando se usa `Abrir SolaraCommerce.cmd`;
6. exportar un sitio draft o production como carpeta (`proyectos/<tienda>/sitios/`) y publicar sus archivos en un hosting estático.

## Reglas no negociables

- `StoreProjectV2Schema` es la autoridad del modelo. `schemaVersion` permanece en
  `2` hasta que exista una migración explícita y testeada.
- `StoreProjectV1` es un alias temporal de `StoreProjectV2` para compatibilidad de
  nombres internos; no significa que exista un contrato v1 adicional.
- El preview y el sitio público deben usar el mismo renderer de `@solara/exporter`.
- Los módulos `legacy-editorial-v1` se conservan sólo para compatibilidad. Las
  nuevas opciones pertenecen a `catalog-modern-v1`.
- Los `productIds` de categorías y colecciones son índices derivados: después de
  editar asignaciones hay que pasar por el dominio (`@solara/core`) o recalcular
  con los helpers del schema.
- El dinero se representa en centavos enteros. Nunca introducir floats para
  precios, descuentos o subtotales.
- Los assets del proyecto son datos; no incorporar binarios generados, `dist/`,
  `proyectos/`, `.solara-runtime/`, `.release/` ni reportes al commit.
- No agregar dependencias de runtime sin justificar impacto en el sitio público y
  en los budgets existentes.
- No enviar el catálogo completo a una IA: usar el schema, fixtures pequeñas o
  muestras deterministas.

## Stack y arquitectura resumida

- Node.js 22+ y Corepack.
- pnpm 10.15.1 con workspace sin Nx, Turbo ni Docker.
- React 19 + Vite para `apps/studio`.
- TypeScript estricto, Biome y Vitest.
- Playwright Chromium para el bucle local; Firefox/WebKit y Lighthouse sólo en
  release.
- Zod para validar el proyecto.
- Dexie/IndexedDB como caché y recovery draft del navegador.
- Un servidor Node local en loopback para persistencia en `proyectos/` cuando se
  inicia mediante `Abrir SolaraCommerce.cmd`.
- `motion` para las transiciones del Studio; el storefront
  recibe un runtime embebido sin dependencias externas.

La separación completa está en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Mapa de carpetas

```text
apps/studio/                  Editor React/PWA, dashboard, preview y workers
packages/project-schema/      StoreProjectV2, Zod, helpers, fixtures y plantilla
packages/core/                Reducer de comandos, undo/redo y CSV de catálogo
packages/module-sdk/          Contrato seguro y helpers de módulos
packages/modules/             Registro, módulos legacy y Catalog Modern
packages/exporter/            Renderer, SEO, servidor local y persistencia en disco
packages/storefront-runtime/  Runtime público de carrito, variantes, búsqueda y motion
packages/site-optimizer/      Auditoría pura de SEO, media, Merchant y contexto IA
scripts/                      Budgets, benchmarks, preflight, release y lanzador
tests/e2e/                    Recorridos Playwright y servidores de prueba
docs/                         Especificaciones, decisiones, operación y handoff
```

Usá [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md) para localizar una funcionalidad
sin explorar el repositorio entero.

## Flujos que no se deben romper

### Inicio y selección de tiendas

`apps/studio/src/main.tsx` monta `App`. `App.tsx` detecta si existe el servidor
administrado (`/__solara/session`). Si está disponible, carga primero los
manifiestos de `proyectos/`; si no, usa IndexedDB. En una primera ejecución crea
la referencia `Predeterminado` y mantiene una plantilla limpia para `Nueva tienda`.

### Edición

`Studio.tsx` mantiene `HistoryState` con `past`, `present` y `future`. Las acciones
comerciales pasan por `executeCommand` de `@solara/core`; cambios de identidad,
tema, assets o secciones pasan por un reemplazo validado con Zod. `Builder.tsx`
usa metadata de `@solara/modules` para generar el inspector y no debe crear
defaults paralelos.

### Guardado

Con el lanzador administrado, IndexedDB conserva `RecoveryDraft` y el botón
`Guardar` ejecuta `localProjectRepository.ts`: crea y vuelve a leer el respaldo,
intenta exportar production y envía streams binarios al servidor local. El
servidor versiona el archivo editable, conserva sitios válidos anteriores y
actualiza `manifest.json`. El disco es la autoridad confirmada; IndexedDB sólo es
recuperación. El flujo está descrito en [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md)
y [`docs/backup-and-recovery.md`](docs/backup-and-recovery.md).

### Preview y exportación

`Preview.tsx` llama a `renderPreviewHtml` y solicita los assets al padre mediante
`postMessage`. `export.worker.ts` ejecuta `exportProject` fuera del hilo de UI.
El exporter genera páginas, metadata, JSON-LD, sitemaps, Merchant, contexto para
agentes y el sitio público reproducible a partir de un snapshot validado.

### Storefront

`packages/storefront-runtime/src/index.ts` se serializa como JavaScript público.
Sólo activa capacidades declaradas en `data-solara-features`: carrito, variantes,
búsqueda, filtros, video y motion. El HTML inicial debe seguir siendo útil con
JavaScript desactivado.

## Cómo extender el proyecto

### Nueva propiedad de una tienda

1. agregarla al schema Zod y al tipo inferido;
2. actualizar fixtures y defaults de `buildCatalogModernProject`;
3. definir migración o rechazo explícito si cambia la persistencia;
4. conectar el editor y el renderer;
5. agregar tests de validación, round-trip del respaldo `.solara.json` y exportación;
6. actualizar [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).

### Nuevo módulo visual

1. crear la definición y settings schema en `packages/modules`;
2. declarar slot, familia, disponibilidad, `compatibleSettings` y metadata;
3. aislar CSS bajo el atributo raíz del módulo;
4. usar helpers de `@solara/module-sdk` para escape, URLs y assets;
5. registrarlo en `catalogModernModules` sólo si es una opción nueva;
6. probar defaults, slots, reemplazo, sanitización, preview y exportación.

### Nueva ruta pública

La ruta se agrega en `buildPages` de `packages/exporter/src/index.ts`, con
canonical, robots, sitemap, JSON-LD y estado sin JavaScript. Si necesita
interacción, se agrega una capability mínima al runtime y sólo se inicializa en
esa página.

### Nueva integración

No llamar servicios externos desde el runtime sin una decisión explícita. Primero
documentar contrato, secretos, fallback y coste en `docs/INTEGRATIONS.md`, luego
aislar la integración en un paquete o servicio pequeño y agregar pruebas con
fixtures deterministas.

## Comandos oficiales

Desde la raíz:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm dev
corepack pnpm check:quick        # <90s, 7 gates en paralelo (iteración diaria, 9800X3D 8 workers)
corepack pnpm test:e2e:smoke   # 15 specs críticos con build cacheado (~45s-2min)
corepack pnpm check             # alias de check:full, secuencial (cierre/CI)
corepack pnpm check:full        # secuencial, para cierre
corepack pnpm build
corepack pnpm benchmark:export
corepack pnpm test:e2e          # 74 specs full (~3-4 min con 8 workers)
corepack pnpm test:e2e:release       # Node 22 + navegadores instalados (solo on-demand)
corepack pnpm desktop:build
corepack pnpm desktop:package
corepack pnpm portable:smoke
corepack pnpm test:e2e:portable
```

Otros gates están documentados en [`docs/TESTING.md`](docs/TESTING.md). El
lanzador de Windows es [`Abrir SolaraCommerce.cmd`](Abrir%20SolaraCommerce.cmd).
La guía de distribución autocontenida está en
[`docs/PORTABILITY.md`](docs/PORTABILITY.md).

## Zonas sensibles y límites conocidos

- El schema, el alias v1, los IDs de módulos y los IDs de secciones son contratos
  persistidos.
- `packages/exporter/src/index.ts` concentra muchas decisiones de URL, SEO y
  semántica; un cambio allí afecta preview, el sitio público y tests de rutas.
- El runtime público es un string grande y el budget se mide sobre el resultado
  serializado, no sólo sobre TypeScript.
- El respaldo editable es un JSON sin compresión (`.solara.json`); el servidor
  local valida rutas y límites sobre el mapa de archivos del sitio. La migración
  única de `.solara.zip` antiguos usa `fflate` de forma temporal hasta un
  release posterior. Ver [`docs/TECHNICAL_DEBT.md`](docs/TECHNICAL_DEBT.md).
- El shell Electron portable y el launcher HTTP comparten el handler de
  `packages/exporter/scripts/solara-request-handler.mjs`; cualquier cambio de
  endpoints debe probar ambos transportes.
- El artefacto portable es una carpeta `win-unpacked`, no un instalador. No se
  deben mover `proyectos/` o `.solara-runtime/` fuera de la carpeta del `.exe`.
- La matriz release exige Node 22. El desarrollo puede ejecutarse con una versión
  posterior, pero no debe presentarse como validación release.
- Playwright usa 8 workers por defecto (9800X3D) con override `PLAYWRIGHT_WORKERS=6`; `check:quick` paraleliza typecheck/test con `pnpm -r --parallel`.
- El checkout termina en WhatsApp y puede limitar la elegibilidad de Merchant.
- La publicación real, DNS, Search Console y Merchant Center son manuales.

## Checklist antes de entregar cambios

- [ ] Leer este archivo y el documento específico de la fase.
- [ ] Confirmar si se afecta `StoreProjectV2`, el renderer compartido o el runtime.
- [ ] Mantener `catalogModernStore`, `catalogScaleStore` y la plantilla limpia
      coherentes cuando corresponda.
- [ ] Agregar primero una prueba del comportamiento nuevo o del bug.
- [ ] Ejecutar el bucle local del paquete afectado y luego el gate proporcional: diaria `check:quick` + `test:e2e:smoke` (~2-3 min); cierre `check` + `test:e2e` full. `test:e2e:release` y `desktop:package` solo on-demand (Node 22).
- [ ] Revisar HTML inicial, responsive, teclado, reduced motion y no-JavaScript si
      se toca storefront.
- [ ] Ejecutar `git diff --check` y `corepack pnpm check:repository`.
- [ ] Revisar que no entren secretos, builds, reportes, `proyectos/` ni runtime.
- [ ] Reconstruir los ejecutables al cerrar trabajo que afecte la app o el shell:
      `corepack pnpm build`, `corepack pnpm desktop:build`, `corepack pnpm desktop:package`
      y `corepack pnpm portable:smoke`. Los artefactos nunca deben quedar atrasados
      respecto del código (`.release/` y `dist/` son regenerables y no se commitean).
- [ ] Actualizar [`CHANGELOG.md`](CHANGELOG.md) con los cambios notables de la
      sesión (formato Keep a Changelog, en español).
- [ ] Actualizar documentación y [`HANDOFF.md`](HANDOFF.md) si cambia una decisión.

## Plan perpetuo de QA y optimización (obligatorio si se invoca)

Si alguien dice "continuá el plan perpetuo" (o similar), se debe:

1. leer `docs/PERPETUAL_QA_BACKLOG.md`, `docs/perpetual-state.json`,
   `docs/perpetual-progress.log` y este archivo;
2. reportar en una línea el lapso del run (timestamps del log vs. reloj del shell,
   informativo), ciclos totales, pendientes y bloqueados;
3. ejecutar el health check: `git status` limpio, branch
   `perpetual/debug-optimizacion`, log consistente;
4. proseguir por el campo `SIGUIENTE` del backlog, sin preguntas de contexto ni
   de continuidad, aplicando el ciclo: TDD → fix → gates proporcionales → log →
   commit → actualizar `SIGUIENTE` → repetir.

El bucle no se detiene solo. Nunca preguntar si se continúa. Detenerse sólo ante
instrucción explícita del usuario (cierre formal: gates completos, CHANGELOG,
push de la rama). Reglas del watchdog: 3 intentos por ítem → `bloqueado` con
evidencia y siguiente ítem; 5 ciclos sin hallazgo → switch de estrategia
(barrido visual Playwright + `doctor:export` + re-lectura de deuda); 10 ciclos
por sesión → checkpoint y aviso de reanudación.

## Entrega y Git

- `origin` = `PiPa1337/SolaraCommerce-Fork` (privado): es el repositorio de
  trabajo donde se sube nuestra versión local, siempre adelantada respecto del
  upstream.
- `upstream` = `PiPa1337/SolaraCommerce` (público): referencia únicamente. NO
  se hace fetch/pull/merge desde upstream: nuestra versión es un fork propio
  que no debe descargar nada de allí.
- Crear un commit breve y descriptivo en español;
- enviar el commit a `origin/main` sólo después de superar los gates;
- no crear commits para una conversación de planificación, una tarea incompleta
  o una verificación fallida;
- respetar una instrucción explícita del usuario de no publicar un cambio.

La documentación de arquitectura, datos, integraciones, testing, deuda y mapa
está indexada desde [`HANDOFF.md`](HANDOFF.md).
