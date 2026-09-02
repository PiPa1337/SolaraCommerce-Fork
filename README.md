# SolaraCommerce

SolaraCommerce es un estudio local-first para crear, administrar y exportar tiendas
estáticas con carrito y pedidos por WhatsApp.

## Abrir en Windows

Hacer doble clic en [`Abrir SolaraCommerce.cmd`](Abrir%20SolaraCommerce.cmd). El
lanzador prepara la aplicación si hace falta, inicia el servidor local y abre el
navegador predeterminado.

Cuando la aplicación fue abierta con ese lanzador, el dashboard muestra `Cerrar
app`. Después de confirmar, el control detiene únicamente el servidor Node local
que inició SolaraCommerce; no borra tiendas, respaldos ni exportaciones. El
navegador puede mantener la pestaña abierta, por lo que el último mensaje indica
que ya se puede cerrar. Si Studio se sirve con Vite, Playwright u otro servidor,
el control no aparece y no intenta detener procesos ajenos.

Para una IA que deba crear tiendas mediante la aplicación real, una distribución
portable incluye [`SolaraCommerce-Agent.cmd`](SolaraCommerce-Agent.cmd) y el
contrato [`docs/AI_AGENT_GUIDE.md`](docs/AI_AGENT_GUIDE.md). Ese canal usa MCP o
JSONL stdio, planes tipados durables, diff previo, jobs consultables y el mismo
guardado transaccional de Studio; no permite parches arbitrarios de archivos.

## Requisitos

- Node.js 24.x
- Corepack
- pnpm 10.15.1, fijado por el repositorio

## Para quien forkea el repositorio

La lectura inicial recomendada es [`AGENTS.md`](AGENTS.md), seguida por el
[`índice de documentación`](docs/INDEX.md), el
[`mapa del proyecto`](docs/PROJECT_MAP.md) y la
[`arquitectura`](docs/ARCHITECTURE.md). Los riesgos conocidos están en
[`docs/TECHNICAL_DEBT.md`](docs/TECHNICAL_DEBT.md); el modelo, las integraciones
y la estrategia de tests están en [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md),
[`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) y
[`docs/TESTING.md`](docs/TESTING.md).

El checkout no necesita servicios externos ni credenciales. Copiá
`.env.example` a `.env` sólo si necesitás cambiar un valor local. Los archivos
`.env`, `proyectos/`, `.solara-runtime/`, `.release/` y los reportes de tests
están ignorados deliberadamente y no deben entrar al commit.

## Variables de entorno

Todas son opcionales; no hay secretos ni claves remotas:

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `SOLARA_PORT` | `4174` | Puerto del servidor local ejecutado directamente. |
| `SOLARA_PILOT_PROJECT_ARCHIVE` | fixture de referencia | Respaldo `.solara.json` usado por `pilot:preflight` y `pilot:export`. |
| `SOLARA_SKIP_E2E_BUILD` | build habilitado | Permite a release-e2e reutilizar la build ya creada. |
| `PLAYWRIGHT_MULTI_BROWSER` | sólo Chromium | Activa Firefox y WebKit en release. |
| `VISUAL_REVIEW_STAGE` | desactivado | Activa capturas visuales manuales. |
| `CI` | provista por CI | Ajusta reporter y timeouts de Playwright. |

Si falta `SOLARA_PILOT_PROJECT_ARCHIVE`, el piloto usa un fixture. Si falta
`SOLARA_PORT`, se usa el puerto 4174. Las demás variables sólo cambian cómo se
ejecutan validaciones y no afectan la tienda exportada.

`NODE_PATH` lo arma internamente el script de release y `import.meta.env.PROD`
es una bandera propia de Vite; no se configuran en `.env`.

## Desarrollo

```bash
corepack prepare pnpm@10.15.1 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm dev
```

Cuando se abre con `Abrir SolaraCommerce.cmd`, `proyectos/` es la fuente de verdad
en disco. IndexedDB queda como caché de recuperación para cambios aún no
confirmados. `Guardar` crea una versión editable `.solara.json`, conserva los
respaldos anteriores y el servidor escribe el sitio público como carpeta en
`proyectos/<tienda>/sitios/`. Las tiendas públicas se pueden abrir en un
servidor local temporal o alojar directamente como archivos estáticos; no
requieren backend ni runtime de IA.

El servidor local sólo escucha en `127.0.0.1`, valida la cookie de sesión y
acepta escrituras dentro de `proyectos/`. Cada guardado usa staging, SHA-256,
validación del respaldo y del mapa de archivos del sitio (rutas relativas y
límites de tamaño y cantidad) y un manifiesto actualizado con rename atómico.
Si production no puede exportarse, el respaldo editable se conserva y el último
sitio público válido no se reemplaza.

En el primer arranque Studio crea `Predeterminado` con la tienda ficticia de
Catalog Modern, generada por la misma fábrica, con 8 raíces, 14 categorías,
50 productos y 60 variantes. Sirve para revisar navegación, paginación, edición
masiva y densidad del catálogo; no se duplica en los siguientes arranques ni
borra tiendas locales existentes.

El inicio de Studio usa un dashboard oscuro de SolaraCommerce: el fondo orbital
se dibuja con WebGL nativo, el logo se sirve en variantes locales optimizadas y
las métricas de la portada se calculan únicamente desde los proyectos guardados.
La biblioteca permite buscar, filtrar, ordenar, alternar grilla/lista, seleccionar
una tienda y abrir sus acciones de editar, duplicar, archivar, restaurar o crear
un respaldo. `Nueva tienda` abre el flujo guiado de cuatro pasos y conserva la
base Catalog Modern limpia.

`Crear tienda` abre una base limpia con el mismo diseño, sin productos,
categorías ni colecciones, para que cargues tus propios textos, imágenes y
catálogo desde cero.

La pestaña `Preparar` funciona como guía principal: muestra el porcentaje de
contenido listo, separa pendientes críticos de recomendaciones y lleva a cada
editor. La base visual queda protegida; `Modo avanzado` habilita el constructor
libre para agregar, reordenar o reemplazar módulos cuando haga falta.

El flujo recomendado es completar marca y textos en `Resumen`, cargar imágenes
en `Recursos`, importar una carpeta comercial con `productos.csv` e `imagenes/`
o crear productos desde `Catálogo`, revisar la checklist y exportar. El editor
manual permite asignar imágenes al producto y a sus variantes. Las
importaciones se revisan antes de guardar y se aplican como una única operación
reversible.

El catálogo comercial agrupa variantes por producto. Las categorías aceptan
rutas de hasta dos niveles como `Casa>Textiles`; las imágenes pueden referenciar
rutas como `imagenes/taza.webp`. El procesamiento ocurre en Web Worker, con
deduplicación por hash y los mismos assets para preview y exportación.

Las actualizaciones de la plantilla se muestran como cambios revisables. Antes
de adoptar cambios seguros Studio descarga automáticamente un respaldo
`.solara.json`; los textos, productos e imágenes del usuario no se sobrescriben.
`Predeterminado` permanece como referencia de 50 productos para probar
densidad, jerarquía y exportación.

## Catálogo

Cada tienda admite productos con múltiples variantes, categorías, colecciones,
tags, disponibilidad e identificadores comerciales. El catálogo ofrece:

- edición completa de producto y variantes;
- acciones masivas de estado, precios, organización y tags;
- paginación de 25, 50 o 100 filas;
- selección entre páginas y resultados filtrados;
- CSV procesado en Web Worker con revisión antes de reemplazar datos;
- CSV comercial opcional con una fila por variante, categorías y colecciones por
  slug, opciones agrupadas e imágenes por ID;
- las categorías modernas filtran disponibilidad, precio, etiquetas y opciones
  de variantes; el producto ofrece tabs progresivos y el carrito separa
  subtotal, entrega a coordinar y total estimado;
- undo/redo y autosave serializado antes de salir de Studio.

La jerarquía de categorías es opcional y admite raíces con un nivel de hijas.
Los padres muestran el conjunto agregado de sus descendientes, mientras que cada
hoja conserva su URL, breadcrumb y metadata. Studio visualiza el árbol con
cantidades directas/heredadas y bloquea ciclos o reubicaciones inválidas.

Para probar la escala de navegación sin mezclarla con el contrato visual, el
paquete `@solara/project-schema/scale-fixture` expone `catalogScaleStore`: 9
raíces, 15 categorías totales, 50 productos activos, 60 variantes y una categoría
Casa de 28 productos que pagina en dos documentos. La fixture pública
`@solara/project-schema/catalog-modern-fixture` expone `catalogModernStore`, la
demo visual con cuatro assets reutilizados entre productos y mantiene IDs, slugs
y fechas deterministas. La fábrica `buildCatalogModernProject` también expone
la semilla `clean` para crear tiendas sin productos y la semilla `demo` para la
tienda de escala.

`StoreProjectV2` valida IDs, slugs, referencias, navegación y páginas editables. Una operación
inválida se rechaza completa y no deja cambios parciales.

## Constructor modular

Las secciones se agregan, ordenan, duplican, ocultan, reemplazan y eliminan desde
Studio. Cada módulo oficial declara su schema Zod y la metadata tipada que genera
el inspector; Studio no infiere controles ni mantiene defaults paralelos.

El reemplazo conserva únicamente contenido compatible. Preview y exportación
usan el mismo renderer semántico, deduplican estilos de módulos activos y
rechazan un proyecto inválido antes de guardarlo o exportarlo.

## Sistema visual

Studio y el storefront de referencia comparten una dirección editorial cálida:
marfil, tinta, verde musgo, títulos serif y controles sans. El sistema conserva
modo oscuro, foco visible, movimiento reducido y layouts responsive sin fuentes
ni recursos externos.

El hero audiovisual admite imagen, carrusel y video local; los tratamientos
editorial y compacto de grilla ofrecen ritmos realmente distintos sobre el mismo contenido.

La home conserva el hero, pero prioriza el catálogo inmediatamente después: la
fixture de escala muestra 12 productos en una grilla compacta de cuatro, tres o
dos columnas según el viewport. Las categorías mantienen páginas de 24 productos
para explorar catálogos extensos sin convertir la home en una lista interminable.

El storefront moderno usa una navbar curada con Inicio, Categorías, Contacto,
Nosotros, búsqueda y carrito. El hero puede trabajar con imagen, carrusel o
video local autocontenido. La home prioriza recién llegados, más elegidos y categorías;
el exporter genera también `/contacto/`, `/nosotros/`, `/buscar/`, `/carrito/` y
`/compra/`, manteniendo HTML útil sin JavaScript.

Los módulos anteriores quedan registrados como `legacy-editorial-v1` y sólo se
conservan para abrir o editar proyectos existentes. La familia
`catalog-modern-v2` es la opción visual activa de las nuevas tiendas y de
`Predeterminado`; `catalog-modern-v1` queda para compatibilidad con proyectos
legacy. Sus textos, productos, categorías, navegación, testimonios y CTA se
editan desde Studio mediante schemas Zod y metadata tipada.

La búsqueda descarga `search-index.json` sólo al abrirse y el carrito reconcilia
sus líneas contra `catalog-index.json` únicamente en sus rutas propias. Los videos
aceptan MP4 o WebM de hasta 30 MB, requieren poster y se deduplican por hash
dentro de la exportación. Studio carga el renderer de exportación en un chunk
diferido al abrir Preview, SEO o Exportar; el bundle inicial queda separado del
renderer y del worker de exportación. Al activar v2 Studio reinicia únicamente
la base IndexedDB `solara-commerce-studio`; no elimina respaldos `.solara.json`,
exportaciones ni archivos del repositorio. Los respaldos v1 se rechazan sin
conversión automática.

## Imágenes responsive

Los recursos se procesan en un Web Worker con una receta determinista de anchos
480, 768, 1200 y 1800 px. Solara valida el formato, corrige la orientación,
conserva transparencia, reutiliza transformaciones por hash y deduplica los
binarios del sitio público. La caché es regenerable y puede limpiarse sin tocar
los proyectos guardados.

## Verificación

```bash
corepack pnpm check:repository
corepack pnpm check
corepack pnpm build
corepack pnpm test:e2e
corepack pnpm benchmark:export
corepack pnpm check:budgets
corepack pnpm pilot:preflight
```

Comandos adicionales útiles:

```powershell
corepack pnpm format          # formatea el workspace con Biome
corepack pnpm format:check    # verifica formato sin escribir
corepack pnpm typecheck       # TypeScript de todos los paquetes
corepack pnpm test:e2e:ci     # E2E sin reconstruir Studio
corepack pnpm test:e2e:release
```

`corepack pnpm build` genera los artefactos de cada workspace. La carpeta
`dist/` de Studio no se versiona. Para publicar, copiá la carpeta versionada de
`proyectos/<tienda>/sitios/` a un host estático; no hace falta un proceso Node
en el sitio público.

## Resolución de problemas

- **El launcher no abre:** verificá Node 24.x, Corepack y que el puerto 4173–4180
  no esté ocupado. El launcher registra el estado en `.solara-runtime/`.
- **No aparece Guardar en disco:** Studio no detectó el servidor gestionado;
  abrí la aplicación con `Abrir SolaraCommerce.cmd`, no con Vite directo.
- **Hay un conflicto al guardar:** otra pestaña confirmó una versión. Elegí
  recargar la versión de disco, conservar el borrador o duplicar la tienda.
- **Una tienda no abre:** revisá el manifest y el `.solara.json` actual en
  `proyectos/`; no borres respaldos hasta recuperar o exportar una copia.
- **Falla Playwright:** instalá Chromium con
  `corepack pnpm playwright:install:chromium` y revisá `playwright-report/`.
- **Falla el gate de release:** ejecutalo con Node 24.x y los tres navegadores;
  es el mismo runtime que usa CI.

El benchmark exporta `catalog-modern-v2` con 2.000 productos y falla si supera
30 segundos. Playwright usa Chromium para el bucle local; la matriz completa y
Lighthouse se reservan para el gate de release. El gate release requiere Node
24.x (igual que CI) y ejecuta Chromium, Firefox y WebKit.

Los tests de Studio usan una IndexedDB en memoria para comprobar guardado,
reapertura, duplicación, archivo, restauración y ráfagas de autosave sin depender
de un navegador durante el bucle unitario.

## Integración continua

[GitHub Actions](https://github.com/PiPa1337/SolaraCommerce/actions/workflows/ci.yml)
ejecuta sobre Windows, Node 24 y pnpm 10.15.1:

1. instalación con lockfile congelado;
2. revisión de secretos y archivos mayores a 10 MB;
3. formato, TypeScript y unit tests;
4. build y benchmark de 1.000 productos;
5. Playwright Chromium sin reconstruir Studio.

Si Playwright falla, el workflow conserva durante siete días el reporte HTML,
traces y resultados disponibles. Una ejecución exitosa no publica artefactos.

## Paquetes

- `apps/studio`: PWA de administración.
- `packages/project-schema`: contrato versionado del proyecto.
- `packages/core`: comandos deterministas y operaciones de catálogo.
- `packages/module-sdk`: contrato seguro para módulos visuales.
- `packages/modules`: módulos oficiales.
- `packages/storefront-runtime`: carrito, WhatsApp y movimiento progresivo.
- `packages/exporter`: HTML, SEO, feed Merchant y sitio estático.
- `packages/site-optimizer`: auditoría determinista de rutas, contenido, media,
  Merchant, rendimiento y contexto público para agentes.

La especificación funcional y el alcance están en
[`docs/product-spec.md`](docs/product-spec.md).

La operación segura está documentada en
[`docs/backup-and-recovery.md`](docs/backup-and-recovery.md), y el piloto real en
[`docs/pilot-checklist.md`](docs/pilot-checklist.md).

## SEO y Google Merchant (Fase 6)

La exportacion genera HTML inicial rastreable para inicio, categorias,
colecciones, productos y politicas. Cada producto activo tiene una URL
canonical, enlaces de variante, JSON-LD y presencia en `sitemap.xml`; cada
variante vendible aparece una sola vez en `google-merchant.xml`.

El panel SEO compara dominio, metadata, imagenes, identificadores, precio,
disponibilidad, JSON-LD y feed, y muestra el destino de correccion. El feed solo
se publica en modo production; el draft usa `noindex` y no incluye Merchant.

El checkout v1 termina en WhatsApp. Esto se marca como modo experimental porque
Google puede exigir una finalizacion de compra convencional dentro del sitio.

## Movimiento premium (Fase 7)

Los modulos declaran sus zonas animables y Studio controla preset, intensidad,
distancia, duracion, delay, stagger, easing, punto de entrada y ejecucion unica.
Los presets de entrada actuales son `fade`, `fade-up`, `slide`, `scale`,
`stagger`, `parallax`, `scroll-progress` y `layer-stack`. El storefront activa
`inView` con `IntersectionObserver`; `parallax` y `scroll-progress` usan CSS
Scroll-driven Animations (scroll-timeline) con fallback de un solo frame pasivo.
`prefers-reduced-motion`, pantallas pequenas y JavaScript desactivado conservan
el estado final visible.

El 2026-08-08 se revirtió por completo la sesión de revamp de movimiento
(presets `zoom-in`/`blur-in`, capability `micro`, módulos FAQ/stats y la tienda
candidata "Predeterminado Revamp"); la tienda Predeterminado vuelve al sistema
descrito arriba. Detalle en el [`CHANGELOG`](CHANGELOG.md).

## Hardening y recuperación (Fase 8)

Studio valida cada proyecto al abrirlo y separa los registros incompatibles para
que una tienda dañada no impida abrir las demás. El dashboard muestra la causa,
conserva el registro original y permite reemplazarlo importando un respaldo
`.solara.json`; el envelope se valida antes de persistirse.

La pantalla de Recursos muestra el uso de cuota de IndexedDB y sólo permite
limpiar la caché regenerable de imágenes. El exportador genera `_headers` con
CSP, Referrer-Policy, Permissions-Policy y protección contra framing.

El gate incluye `corepack pnpm check:budgets`, que bloquea bundles iniciales de
Studio por encima de 700 KiB crudos de JavaScript o 100 KiB crudos de CSS. La
matriz multinavegador y Lighthouse se ejecutan en el gate de release, no en
cada cambio local.

## Release candidate (Fase 9)

El bucle local ejecuta Chromium. `corepack pnpm test:e2e:release` activa la
matriz Chromium, Firefox y WebKit; el workflow separado se dispara manualmente
o con tags `v*` y conserva sus diagnósticos durante 14 días. `release:manifest`
genera metadata del commit y artefactos en `.release/`, fuera del repositorio.

La auditoría Lighthouse usa `.lighthouserc.json` contra la carpeta exportada de
producción servida localmente o en el dominio piloto. Se ejecuta con
`corepack pnpm dlx @lhci/cli autorun --config=.lighthouserc.json` para no sumar
una dependencia pesada al Studio ni al storefront.

## Optimizacion automatica post-generacion

Cada exportacion ejecuta `@solara/site-optimizer` sobre el mismo snapshot que
usa el HTML, JSON-LD, sitemap y feed. El informe es determinista e incluye:

- rutas indexables, canonicals, slugs reservados y productos huerfanos;
- cobertura de descripcion, imagenes, precios e identificadores comerciales;
- peso de imagenes y videos, variantes responsive y candidatos eager;
- entidad de marca, politicas, enlaces publicos y cobertura factual para agentes;
- hash del snapshot, score 0-100 y hallazgos criticos, warnings e informativos.

En produccion se generan opcionalmente `ai-context.json` y `llms.txt` desde el
mismo snapshot. No contienen data URLs ni datos personales privados. La casilla
esta disponible en Exportar y queda activada por defecto; se puede desactivar
para una exportacion sin contexto publico. El boton de produccion sigue
bloqueado ante errores criticos.

El panel SEO muestra la salud del proyecto antes de exportar. El gate local
incluye una comprobacion determinista de la demo de 50 productos, la escala de
50 productos y 15 categorias, y la plantilla limpia:

```text
corepack pnpm check:optimization
```

El contexto para agentes es una ayuda de descubrimiento, no un reemplazo del
SEO fundamental: el contenido HTML sigue siendo rastreable, semantico y util
sin JavaScript.

`corepack pnpm check:budgets` tambien comprueba el runtime publico: JavaScript
<= 52 KiB crudos (medido ~48,9 KiB) y CSS <= 8 KiB crudos (medido ~7,3 KiB),
ademas de los limites
del bundle inicial de Studio.

## Piloto real (Fase 10)

`corepack pnpm pilot:preflight` valida el paquete production antes de publicar:
feed, sitemap, JSON-LD, canonical, robots, headers y sitio reproducible. La
publicación, verificación de dominio, Search Console y Merchant Center quedan
manuales porque requieren credenciales y autorización del usuario; el checklist
está en [`docs/pilot-checklist.md`](docs/pilot-checklist.md).

Para validar una tienda concreta, definir `SOLARA_PILOT_PROJECT_ARCHIVE` con su
respaldo `.solara.json`. En PowerShell:

```powershell
$env:SOLARA_PILOT_PROJECT_ARCHIVE = "C:\ruta\tienda.solara.json"
corepack pnpm pilot:preflight
```

Sin esa variable se usa el fixture base Modo Sur.

Con ese mismo respaldo, `corepack pnpm pilot:export` genera la carpeta
`.release/pilot-site/` lista para publicar.

En Preview, los assets embebidos no se serializan dentro del `srcdoc`: el iframe
los solicita por `postMessage`, los hidrata una sola vez y reutiliza sus URLs
`blob:` locales. Esto evita repetir la misma base64 en cada tarjeta y mantiene
el sandbox del preview. Durante esa hidratación, las imágenes del preview se
marcan como eager para que el editor no dependa de desplazar el iframe; el sitio público
conserva `loading="lazy"` donde corresponde.

## Distribución portable para Windows

El checkout sigue siendo el modo de desarrollo. Para crear una carpeta que se
pueda copiar a otro equipo sin Node, pnpm ni el navegador del sistema:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm desktop:build
corepack pnpm desktop:package
corepack pnpm portable:smoke
corepack pnpm test:e2e:portable
```

La salida es `.release/portable/SolaraCommerce-Portable/`. Incluye Electron,
Chromium, Studio compilado y el shell `solara://studio/`. `proyectos/` es la
fuente de verdad de las tiendas; `.solara-runtime/` contiene el perfil aislado,
logs y transacciones regenerables. Copiá la carpeta completa, no sólo el `.exe`.

`Abrir SolaraCommerce.cmd` abre el `.exe` adyacente cuando existe y conserva el
servidor HTTP de desarrollo como fallback cuando se ejecuta desde un checkout.
La distribución puede moverse a rutas con espacios o Unicode y dos copias en
carpetas distintas pueden ejecutarse simultáneamente. Los sitios exportados se
abren mediante un servidor efímero loopback; `file://` no es el modo soportado
para índices, búsqueda y mejoras JavaScript.

La arquitectura, los límites de seguridad y la actualización de una copia están
en [`docs/PORTABILITY.md`](docs/PORTABILITY.md). `portable:clean` elimina sólo
la salida generada bajo `.release/portable/`.
