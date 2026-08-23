# Guardianes automáticos de calidad

Este documento describe cada spec que actúa como guardián: qué valida, cómo
ejecutarlo y qué rompería si fallara.

## Guardianes geométricos

Miden el layout real con `getBoundingClientRect()`. No dependen de screenshots.

| Spec | Qué valida | Ejecutar |
| --- | --- | --- |
| `__vision__/alignment.spec.ts` | Tabs del nav con misma X/Y; columnas del builder alineadas; section-row con alto acotado; cards del dashboard consistentes | `pnpm exec playwright test tests/e2e/__vision__/alignment.spec.ts` |
| `__vision__/storefront-alignment.spec.ts` | Cards por grilla con ancho uniforme; módulos centrados; sin overflow en 320px | `pnpm exec playwright test tests/e2e/__vision__/storefront-alignment.spec.ts` |
| `visual-break.spec.ts` | Overflow horizontal en 10 viewports (320-2560) con datos adversarios (títulos largos, Unicode, precios extremos) | `pnpm exec playwright test tests/e2e/visual-break.spec.ts` |

## Guardianes adversariales

Simulan condiciones hostiles o entradas maliciosas.

| Spec | Qué valida | Ejecutar |
| --- | --- | --- |
| `__bugs__/content-edge-cases.spec.ts` | Textos extremos (RTL, emoji, 5000 chars), precios $0.01/$99999999.99, sin imágenes | `pnpm exec playwright test tests/e2e/__bugs__/content-edge-cases.spec.ts` |
| `__bugs__/navigation-matrix.spec.ts` | Todo link interno responde 200; sin duplicados por trailing slash | `pnpm exec playwright test tests/e2e/__bugs__/navigation-matrix.spec.ts` |
| `__bugs__/runtime-failures.spec.ts` | localStorage bloqueado, catalog corrupto, imágenes rotas — sin errores JS ni overflow | `pnpm exec playwright test tests/e2e/__bugs__/runtime-failures.spec.ts` |
| `__bugs__/forms-adversarial.spec.ts` | XSS en checkout/contacto, 10k chars, solo emojis — sin ejecución ni inyección | `pnpm exec playwright test tests/e2e/__bugs__/forms-adversarial.spec.ts` |
| `__bugs__/seo-integrity.spec.ts` | Canonical único, JSON-LD parseable, sitemap sin rutas rotas | `pnpm exec playwright test tests/e2e/__bugs__/seo-integrity.spec.ts` |

## Guardianes de presupuesto

| Script | Qué valida | Límite |
| --- | --- | --- |
| `check-budgets.mjs` | Studio JS/CSS iniciales | 720/112 KiB |
| `check-image-budget.mjs` | PNG >200KB en fixtures | Prohibido |
| `public-storefront-budget.test.ts` | CSS V2 exportado ≤180 KiB, JS runtime ≤64 KiB | Bloqueante en CI |

## Guardianes de seguridad

| Spec | Qué valida |
| --- | --- |
| `security-redteam.test.ts` | Path traversal, XSS en settings, CSV formula injection, auth de handler |
| `chaos-storage.test.mjs` | Disco lleno, locks transitorios, staging huérfano |
| `portable-adversarial.test.ts` | Movimiento de carpeta, locks, crash recovery, rutas profundas |

## Specs de visión (diagnóstico manual)

No son gate. Generan capturas para inspección visual.

| Spec | Captura | Output |
| --- | --- | --- |
| `storefront-deep-vision.spec.ts` | 11 rutas × 19 viewports + estados interactivos | `screenshots/storefront-vision/` (~209 PNG) |
| `studio-vision.spec.ts` | 9 pantallas × 4 viewports del editor | `screenshots/studio-vision/` |
