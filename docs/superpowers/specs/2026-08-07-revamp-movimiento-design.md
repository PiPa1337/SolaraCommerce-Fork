# Revamp de movimiento — Design spec

**Fecha:** 2026-08-07
**Estado:** aprobado por el usuario (plan presentado y aprobado en conversación)

## Objetivo

Modernizar la capa de movimiento del storefront Catalog Modern: efectos de
hover, animaciones de scroll/appear, atmósfera ambiental y micro-interacciones
(tilt, magnetic, spotlight, parallax con mouse), más dos módulos ligeros
nuevos (FAQ accordion y stats con contadores). Se trata como "demo del techo"
dentro de los contratos de SolaraCommerce. La candidata visual se entrega como
tienda separada ("Predeterminado Revamp") para comparar con la actual; la
Predeterminado actual no se toca en contenido ni estructura.

**Referencia:** prompts "TecnoSiblings" y "ceiling" (fuente de los efectos
genéricos); se extraen SOLO los efectos/animaciones/hovers/scrolls/appears.

## Decisiones confirmadas

- Paleta actual (marfil/tinta/verde musgo) — sin dark-tech.
- Sin cursor custom, sin preloader, sin partículas canvas, sin Three.js/GSAP,
  sin CDN ni deps externas.
- Techo runtime JS: 56 KiB (subido de 52 el 2026-08-07; medido 53,2 KiB con el alcance aprobado).
- Presets nuevos en el motor: `zoom-in` y `blur-in`.
- Micro-interacciones JS: tilt 3D, botones magnéticos, spotlight, hero
  parallax con mouse, back-to-top con anillo, kinetic typography.
- Módulos ligeros nuevos: `catalog-faq`, `catalog-stats`.
- Los efectos compartidos (CSS de módulos y presets) mejoran también la
  Predeterminado actual al re-exportar; no cambian layout ni contenido y son
  reversibles. La candidata difiere solo en configuración de motion y las
  secciones nuevas.

## Contratos invariantes

- `StoreProjectV2Schema`/`schemaVersion: 2` sin cambios de forma (solo
  literales aditivos en `MotionPresetSchema`).
- Runtime público: serialización por `fn.toString()` — toda función nueva
  dentro de `storefrontBoot` es autocontenida; `check:runtime-serialization`
  sigue verde.
- Static-first: HTML útil sin JS; estados finales visibles; `prefers-reduced-motion`
  desactiva todo efecto; teclado/foco intactos; `transform/opacity/filter`
  solamente (sin layout).
- Budgets: JS runtime ≤ 56 KiB; CSS runtime ≤ 8 KiB; storefront.css ≤ 780 KiB.
- Sin CDN, sin fuentes externas (tipografías locales existentes).

## Catálogo de efectos (con detalle de calidad)

### A. Hover (CSS puro)
1. **Cards producto**: elevación + glow cálido + zoom interno. Sombra
   `0 18px 40px -12px` (color del tema), 450ms `cubic-bezier(.22,1,.36,1)`;
   imagen `scale(1.08)` 600ms con `overflow:hidden`.
2. **Borde gradiente animado** en cards: `conic-gradient` rotando con
   `@property --angle`; fallback estático (sin `@property`).
3. **Spotlight mouse** en cards: radial-gradient con `--mx/--my` (JS en 1A),
   opacity 0→1 300ms.
4. **Botones**: shine sweep (pseudo-elemento, 600ms, delay 150ms) +
   `translateY(-2px)` + glow del accent; variantes primary y secundarios.
5. **Links navbar**: underline `scaleX 0→1` 350ms con gradiente del tema.
6. **Bento categorías**: `scale(1.03)` 500ms + overlay gradiente 300ms.
7. **Testimonios/newsletter**: elevación + glow (mismo lenguaje que cards).
8. **Imagen pan suave** en cards/blog: `scale 1.05→1.12` 800ms expo-out.
9. **Focus-visible glow**: ring 2px + halo `0 0 0 4px` del tema.

### B. Scroll / appear (motor + 2 presets)
10. **Preset `zoom-in`**: `scale(1.06)→1` + opacity, 600ms expo-out.
11. **Preset `blur-in`**: `blur(10px)→0` + opacity, 700ms (solo entrada).
12. **Candidata reconfigurada**: hero `parallax`/`layer-stack`; grillas
    `stagger` 60–90ms; bento `scale`; distancias 18–28px; curva overshoot
    `cubic-bezier(.34,1.56,.64,1)` en hero.
13. **Scroll-reveal de títulos de sección**: `animation-timeline: view()` con
    opacity+translateY; fallback pasivo.
14. **Reveal clip-path de imágenes**: `clip-path: inset(12%)→0` + scale con
    `view()` (hero/bento).
15. **Kinetic typography** en título del hero: split por palabra (JS),
    stagger reveal con rotación 2° + gradient-shift; sin JS = texto estático.
16. **Scroll progress + back-to-top**: preset `scroll-progress` en el shell +
    botón con anillo SVG `dashoffset`.

### C. Ambient (CSS casi todo)
17. **Noise overlay + grain**: SVG `feTurbulence` data-URI, opacity 0.04,
    `pointer-events:none`, animación `steps()` 4 posiciones 8s.
18. **Marquee brand strip**: `translateX -50%` infinito 28s linear, pausa en
    hover (módulo existente).
19. **Gradient-shift** en títulos/eyebrow: `background-position 200%`, 6s
    `ease-in-out` alternate.
20. **Pulse rings**: 3 anillos `scale+opacity`, delays 0/0.8/1.6s, loop 3s.
21. **Dots parpadeantes**: keyframe opacity/scale escalonado por `--i`.
22. **Shimmer/light-sweep** en imágenes destacadas: 1.2s al hover (hero: sutil
    permanente).
23. **Scrollbar custom**: 10px, thumb con gradiente del tema, hover glow +
    `scrollbar-color` + selección de texto teñida.
24. **Anuncio con borde luminoso**: línea gradiente animada inferior.

### D. Micro-interacción (JS, capability `micro`, desktop-only)
25. **Tilt 3D** en cards: `rotateX/Y ≤6°`, perspectiva 800px, retorno 200ms,
    `translateZ(20px)` en imagen.
26. **Botones magnéticos**: atracción ≤8px, retorno overshoot.
27. **Hero parallax mouse**: capas ±12px con lerp en rAF.

### Módulos nuevos (2A)
28. **`catalog-faq`**: accordion, uno abierto a la vez, `grid-template-rows
    0fr→1fr`, icono rotación 180°, `aria-expanded`/`aria-controls`, teclado.
29. **`catalog-stats`**: 4 contadores rAF 1.2s expo-out al entrar en
    viewport; números estáticos sin JS; formato locale.

## Candidata "Predeterminado Revamp"

- Seed `revamp` en `buildCatalogModernProject` (extiende
  `CatalogModernSeed`): clona `catalogModernStore` y reconfigura `motion` de
  secciones (catálogo B.12). Determinista. Las secciones FAQ y stats NO las
  agrega el seed: las agrega `ensureRevampDemoProject` en el paso de
  repository (insertadas antes del footer).
- `ensureRevampDemoProject()` en `apps/studio/src/lib/repository.ts`
  (idempotente, patrón `ensureScaleDemoProject`; ID
  `store-modo-sur-revamp`, nombre "Predeterminado Revamp") + llamado en
  `App.tsx`. Se puede quitar para reciclar sin afectar nada.

## Verificación

- Budgets: JS ≤ 52 (esperado ~49.2), CSS runtime ≤ 8 (~7.3), storefront.css
  ≤ 780. `check:runtime-serialization` verde.
- Schema: tests de `MotionPresetSchema` con los literales nuevos + round-trip.
- E2E: FAQ (uno abierto, teclado), stats (números finales), reduced-motion,
  no-JS de home, matriz 390/768/1024/1440.
- Ejecutables reconstruidos al cierre.
