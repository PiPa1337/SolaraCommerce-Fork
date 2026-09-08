---
name: SolaraCommerce
description: Local-first studio and static storefront system for editable multi-store commerce.
colors:
  storefront-background: "#f7f5f0"
  storefront-surface: "#e9e5dd"
  storefront-text: "#11110f"
  storefront-muted: "#6d6961"
  storefront-accent: "#a63d2f"
  storefront-accent-text: "#ffffff"
  storefront-border: "#d8d2c7"
  studio-background: "#08090a"
  studio-surface: "#111214"
  studio-surface-strong: "#1b1c1f"
  studio-ink: "#f3f0ea"
  studio-muted: "#9a9a96"
  studio-accent: "#ff6a00"
  studio-cosmic-amber: "#e8b56f"
  white: "#ffffff"
typography:
  storefront-display:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontWeight: 500
    lineHeight: "0.98"
    letterSpacing: "-0.045em"
  storefront-body:
    fontFamily: "Archivo, Arial Narrow, Helvetica Neue, Arial, sans-serif"
    lineHeight: "1.58"
  studio-ui:
    fontFamily: "Arial, sans-serif"
  studio-display:
    fontFamily: "Arial, sans-serif"
rounded:
  storefront-v2: "2px"
  studio-input: "6px"
  studio-panel: "16px"
  studio-large: "24px"
spacing:
  studio-1: "4px"
  studio-2: "8px"
  studio-3: "12px"
  studio-4: "16px"
  studio-6: "24px"
  studio-8: "32px"
components:
  storefront-primary-action:
    backgroundColor: "{colors.storefront-accent}"
    textColor: "{colors.storefront-accent-text}"
    rounded: "{rounded.storefront-v2}"
    padding: "0.75rem 1.1rem"
    height: "48px"
  studio-panel:
    backgroundColor: "{colors.studio-surface}"
    textColor: "{colors.studio-ink}"
    rounded: "{rounded.studio-panel}"
    padding: "24px"
---

# Design System: SolaraCommerce

## Overview

SolaraCommerce has two related but intentionally isolated visual registers. The
Studio is a dark, dense working environment for editing stores. The public
storefront is theme-driven and must let each store own its palette and type while
preserving shared semantic structure, accessibility, and no-JavaScript utility.

Catalog Modern V2 is the current editorial reference for new public composition:
wide containers, asymmetric media, deliberate rhythm, and restrained surfaces.
The dashboard's cosmic shell is an editor surface, not a storefront theme. Do not
merge their tokens or infer that a Studio treatment belongs in exported commerce
pages.

**Key Characteristics:**

- Theme tokens are data-driven for public stores.
- Preview and export share the same semantic renderer.
- Responsive behavior is a contract, not a decorative breakpoint choice.
- Motion ends in a useful final state and respects reduced motion.

## Colors

The storefront reference palette is warm, editorial and low-chroma, with a
terracotta accent. The Studio uses near-black surfaces, warm text and an orange
working accent. The Gargantua dashboard refines that register with a near-neutral
void (`#080b08`), desaturated blue-gray haze, pale hot-disk highlights and a
champagne amber (`#e8b56f`). Public theme presets may replace the reference
storefront values.

### Primary

- **Terracotta accent** (`#a63d2f`): primary action and editorial emphasis in the
  Catalog Modern V2 reference.
- **Studio orange** (`#ff6a00`): active controls and focus language inside Studio.

### Neutral

- **Warm paper** (`#f7f5f0`): Catalog Modern V2 background.
- **Warm surface** (`#e9e5dd`): V2 panels and secondary surfaces.
- **Ink** (`#11110f`): V2 primary text.
- **Muted stone** (`#6d6961`): secondary text.
- **Studio night** (`#08090a`): Studio root background.
- **Studio surface** (`#111214`): editor panels.
- **Studio ink** (`#f3f0ea`): primary editor text.

## Typography

**Storefront display:** Georgia, Times New Roman, serif.
**Storefront body:** Archivo with the existing narrow sans-serif fallbacks.
**Studio UI and display:** Arial, sans-serif, matching the current editor tokens.

Storefront headings use a compact editorial line-height and negative tracking in
the V2 reference. Studio prioritizes scanability and stable control dimensions.
Do not replace the existing families merely because a generic design heuristic
prefers another font; the incumbent code and theme contract are authoritative.

## Layout

The public renderer uses a theme-provided container and spacing scale. Catalog
Modern V2 has a reference container up to 1760px, wide editorial composition and
mobile layouts that collapse without horizontal scrolling. The active responsive
contract is tested at 390x844, 1024x900 and 1440x900, with boundary checks around
768px and 1200px.

Studio is a full-height application shell. The dashboard may scroll with its
content, while the editor contains scrolling inside its panels. Keep the minimum
usable width at 320px and preserve the existing 4px spacing scale for editor
alignment.

## Elevation & Depth

Public depth is primarily tonal and theme-driven; cards, elevated surfaces and
overlays use the theme's shadow tokens rather than arbitrary decoration. Studio
uses restrained panel and floating shadows (`0 24px 60px rgba(0, 0, 0, 0.44)` and
`0 8px 24px rgba(0, 0, 0, 0.36)`) against dark surfaces.

## Shapes

Public shape is controlled by the store theme. The V2 reference uses a 2px base
radius and square search-form treatment. Studio uses 6px inputs, 16px panels and
24px large surfaces. Focus rings are visible and must not be replaced with
decoration that reduces contrast.

## Components

### Buttons

- Public primary and secondary actions are at least 48px high, theme-colored,
  keyboard reachable and use the shared motion tokens.
- Studio buttons use the `--accent` and surface tokens with visible hover, focus,
  disabled and danger states.

### Cards / Containers

- Public cards inherit the active theme and use the shared container/grid helpers.
- Studio panels use the dark surface hierarchy and the `--radius-panel` token.

### Inputs / Fields

- Storefront fields preserve semantic labels, visible focus and the active theme.
- Studio fields use `--radius-input`, `--surface-raised` and the shared focus ring.

### Navigation

Public navigation must remain crawlable, keyboard accessible and useful without
JavaScript. Mobile navigation is a full interaction state with focus return and
no horizontal scroll. Studio navigation belongs to the editor shell and should
not leak public-storefront styles.

## Do's and Don'ts

### Do:

- **Do** derive public colors, radius, spacing, typography and motion from the
  project's theme tokens.
- **Do** preserve Preview/export parity and test the three responsive modes.
- **Do** keep reduced-motion and no-JavaScript states useful.
- **Do** scope public CSS under the existing storefront/module roots.

### Don't:

- **Don't** mix Studio tokens with storefront tokens.
- **Don't** introduce a new visual family when the task is a refinement.
- **Don't** solve a design finding by changing persisted data, schema, IDs or
  native-agent operations.
- **Don't** add decorative motion, gradients, shadows or effects without a
  product/brief reason and responsive evidence.
