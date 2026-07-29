# Fase activa: baseline reproducible y CI

## Objetivo

Garantizar que el proyecto puede instalarse y verificarse desde un checkout limpio,
y que GitHub ejecuta el mismo gate sobre Windows, Node 22 y Chromium.

## Alcance

- Instalación con `pnpm-lock.yaml` congelado.
- Guard contra secretos y archivos versionados mayores a 10 MB.
- Formato, tipos, unit tests, build y benchmark.
- Playwright Chromium sobre el build ya generado.
- Diagnósticos E2E conservados siete días sólo cuando falla Playwright.

## Verificación

- `corepack pnpm check:repository`
- `corepack pnpm check`
- `corepack pnpm build`
- `corepack pnpm benchmark:export`
- `corepack pnpm test:e2e`

## No objetivos

No se modifican contratos, catálogo, módulos, SEO ni movimiento. Lighthouse,
axe, Firefox y WebKit permanecen reservados para la fase de hardening.
