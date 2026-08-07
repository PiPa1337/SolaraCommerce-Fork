# Estrategia de testing

La suite está organizada por riesgo: funciones puras y schemas rápidos primero,
integración de paquetes después y navegador al cerrar una fase. No se debe
ejecutar Lighthouse o todos los navegadores después de cada cambio pequeño.

## Capas

### Unitarias

Vitest cubre schemas, migraciones, reducer de dominio, historial, seguridad de
módulos, runtime de carrito/WhatsApp, renderer/exporter y optimizer. Cada
paquete contiene sus pruebas junto al código. Es la primera verificación para
cualquier transformación determinista.

```powershell
corepack pnpm --filter @solara/project-schema test
corepack pnpm --filter @solara/core test
corepack pnpm --filter @solara/exporter test
corepack pnpm --filter @solara/storefront-runtime test
```

### Integración

`corepack pnpm check` ejecuta repository scan, formato, typecheck, tests de todos
los paquetes y checks de optimizer. `build` comprueba que los paquetes se
compilan en orden.

```powershell
corepack pnpm check
corepack pnpm build
```

### Exportación y presupuestos

```powershell
corepack pnpm benchmark:export
corepack pnpm check:budgets
corepack pnpm check:optimization
```

Los fixtures pequeños verifican render visual; `catalogScaleStore` verifica 50
productos, jerarquía y 60 variantes; el benchmark de core usa 1.000 productos.

### Playwright

`test:e2e` compila Studio y ejecuta Chromium contra un servidor local. En CI el
build ya está hecho y se usa `test:e2e:ci`.

```powershell
corepack pnpm playwright:install:chromium
corepack pnpm test:e2e
corepack pnpm test:e2e:ci
```

La matriz de release instala Chromium, Firefox y WebKit mediante
`PLAYWRIGHT_MULTI_BROWSER=1`. Los tests visuales se activan sólo con
`VISUAL_REVIEW_STAGE=...` y escriben en `test-results/visual-review/`, que no se
versiona.

## Flujos críticos que deben conservarse

- crear una tienda limpia desde la plantilla Catalog Modern;
- crear/duplicar/archivar/restaurar una tienda;
- editar identidad, navegación, productos, categorías, assets y secciones;
- importar y exportar CSV;
- deshacer/rehacer y recuperar un draft;
- abrir preview home, categoría, producto, búsqueda, carrito y compra;
- guardar en `proyectos/` y recuperar después de reiniciar el servidor;
- generar HTML sin JavaScript, JSON-LD, sitemap, Merchant y contexto IA;
- seleccionar una variante, agregar al carrito y generar el mensaje WhatsApp.

## Qué probar ante cada tipo de cambio

| Cambio | Mínimo | Cierre recomendado |
| --- | --- | --- |
| Schema/migración | tests de schema y fixtures | `check`, `build`, E2E de persistencia |
| Reducer/CSV | tests de `core` y round-trip | benchmark de catálogo |
| Módulo/estilo público | tests de módulo/exporter | E2E responsive + captura manual |
| Preview/Studio | typecheck de Studio | `test:e2e` Chromium |
| Guardado local | tests de repository/servidor | ciclo real launcher + E2E |
| SEO/exporter | tests de HTML/JSON-LD/sitemap/feed | `benchmark:export`, E2E sin JS |

## Diagnóstico

- Un test E2E fallido deja reportes en `playwright-report/` y traces según la
  configuración de Playwright.
- `test:e2e:release` requiere los navegadores instalados y Node 22 en CI.
- El servidor de tests usa loopback; no debe apuntarse a una tienda publicada.
- Para inspeccionar una exportación, usar `pnpm reference:export` o
  `pnpm pilot:export` y revisar el directorio indicado por el script.

## Estrategia futura

Todavía no hay pruebas de fault injection para disco lleno, permisos revocados,
interrupciones durante rename ni ZIP bombs grandes. Antes de convertir el
guardado local en un servicio remoto se deben agregar esos escenarios y una
prueba de recuperación de `manifest.json`.
