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
  workbench-background: "#080b0e"
  workbench-surface: "#101820"
  workbench-surface-raised: "#17212b"
  workbench-glass: "rgb(13 22 36 / 0.78)"
  workbench-ink: "#f2f5f7"
  workbench-muted: "#b1bdc8"
  workbench-line: "rgb(232 242 255 / 0.16)"
  workbench-line-strong: "rgb(242 248 255 / 0.3)"
  workbench-field: "#0b141e"
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
  workbench-control: "8px"
  workbench-group: "10px"
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
  workbench-panel:
    backgroundColor: "{colors.workbench-glass}"
    textColor: "{colors.workbench-ink}"
    rounded: "{rounded.studio-panel}"
    padding: "0 22px 24px"
  workbench-field:
    backgroundColor: "{colors.workbench-field}"
    textColor: "{colors.workbench-ink}"
    rounded: "{rounded.workbench-control}"
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

The desktop store workbench inherits the dashboard's cool glass, depth and Arial
typography on a stationary background. Its scoped tokens override the older
Studio defaults only inside the workbench. The operational layout and eight-area
tool map are documented in `docs/EDITOR_WORKBENCH.md`.

**Key Characteristics:**

- Theme tokens are data-driven for public stores.
- Preview and export share the same semantic renderer.
- Responsive behavior is a contract, not a decorative breakpoint choice.
- Motion ends in a useful final state and respects reduced motion.

## Colors

The storefront reference palette is warm, editorial and low-chroma, with a
terracotta accent. The Studio uses near-black surfaces, warm text and an orange
working accent. The Gargantua dashboard keeps its near-neutral void (`#080b08`),
desaturated blue-gray haze and pale hot-disk highlights, while its operational
surfaces use a cool, translucent glass recipe with restrained light borders.
Champagne amber remains limited to brand/background and semantic actions; it does
not tint the dashboard chrome. Public theme presets may replace the reference
storefront values.

### Primary

- **Terracotta accent** (`#a63d2f`): primary action and editorial emphasis in the
  Catalog Modern V2 reference.
- **Studio orange** (`#ff6a00`): active controls and focus language inside Studio.
- **Workbench champagne:** the existing cosmic amber marks actions, selected
  navigation icons and focus inside the workbench; cool translucent surfaces and
  pale text remain dominant. Orange remains a base Studio token, not the
  workbench's effective accent.

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

The workbench retains the dashboard's Arial stack. Section headings use 25px,
1.15 line-height and -0.03em tracking, reducing to 22px in narrow panel containers.
Body and field copy use 13px with 1.5 line-height; navigation uses 12px. Text has
no decorative shadow. These are operational roles, not public display tokens.

## Layout

The public renderer uses a theme-provided container and spacing scale. Catalog
Modern V2 has a reference container up to 1760px, wide editorial composition and
mobile layouts that collapse without horizontal scrolling. The active responsive
contract is tested at 390x844, 1024x900 and 1440x900, with boundary checks around
768px and 1200px.

Studio is a full-height application shell. The dashboard may scroll with its
content, while the editor contains scrolling inside its panels. Preserve the
existing 4px spacing scale for editor alignment. The desktop workbench has a
left navigation rail, a main panel filling the space up to a right-aligned preview,
with 12px gutters and no 768px cap on the main panel. Tablet and Mobile reserve
up to 768px and 390px respectively for the preview and give the remainder to the
main panel. A selected item or section opens its detail in that same panel,
replacing the visible list while keeping it mounted to preserve state and scroll.
There is one visible working panel beside the preview. Container queries adapt
fields and toolbars to the panel's actual available width.

**The Preview Viewport Rule.** Tablet (768px) and Mobile (390px) describe the
iframe's internal viewport, not supported editor device classes. Scale the
rendered frame to fit without changing that viewport. Opening the main panel
temporarily selects Tablet; device changes while it is open remain temporary,
and closing it restores the preset selected before opening. Opening or closing
a detail within that panel leaves the preview device, route and zoom unchanged;
the device selector remains available. The
desktop editor must not be documented as a 320px mobile application.

## Elevation & Depth

Public depth is primarily tonal and theme-driven; cards, elevated surfaces and
overlays use the theme's shadow tokens rather than arbitrary decoration. Studio
uses restrained panel and floating shadows (`0 24px 60px rgba(0, 0, 0, 0.44)` and
`0 8px 24px rgba(0, 0, 0, 0.36)`) against dark surfaces.

The workbench overrides panel depth with a soft shadow
(`0 18px 48px rgb(0 0 0 / 0.28)`), a faint inset highlight and 16px backdrop blur.
Its subtle radial background and panel gradients are stationary. Detail and
sticky navigation surfaces are more opaque to keep controls readable.

**The Stationary Workshop Rule.** Inherit the dashboard's glass materials, not
its animated background; the preview remains the store's own rendered document.

## Shapes

Public shape is controlled by the store theme. The V2 reference uses a 2px base
radius and square search-form treatment. Studio uses 6px inputs, 16px panels and
24px large surfaces. Focus rings are visible and must not be replaced with
decoration that reduces contrast.

Workbench overrides use 8px controls, 10px navigation/group surfaces and 16px
main/detail surfaces. The preview has rounded 12px corners and an inset outline,
so decoration does not subtract pixels from the emulated viewport.

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
- Workbench fields override these with a stable dark fill, 8px radius and 38px
  minimum height (excluding checkboxes/radios). Focus uses a 2px amber outline
  offset by 3px; selected primary-action text remains dark for contrast.

### Navigation

Public navigation must remain crawlable, keyboard accessible and useful without
JavaScript. Mobile navigation is a full interaction state with focus return and
no horizontal scroll. Studio navigation belongs to the editor shell and should
not leak public-storefront styles.

Workbench navigation separates preparation, editing and publication while
retaining all eight areas. Selected areas use a light border and glass highlight.
Sticky local navigation scrolls and focuses a group without unmounting its forms;
the active treatment records the selected group. Contextual details use the same
working panel through portals and return focus on close. Sections and assets have
explicit return actions; saving or cancelling a product returns to its catalog.

## Do's and Don'ts

### Do:

- **Do** derive public colors, radius, spacing, typography and motion from the
  project's theme tokens.
- **Do** preserve Preview/export parity and test the three responsive modes.
- **Do** keep reduced-motion and no-JavaScript states useful.
- **Do** scope public CSS under the existing storefront/module roots.
- **Do** scope workbench materials to the editor shell and adapt controls to
  panel width in both list and detail views.

### Don't:

- **Don't** mix Studio tokens with storefront tokens.
- **Don't** interpret Tablet/Mobile preview presets as tablet/mobile editor
  layouts or copy the dashboard animation into the workbench.
- **Don't** introduce a new visual family when the task is a refinement.
- **Don't** solve a design finding by changing persisted data, schema, IDs or
  native-agent operations.
- **Don't** add decorative motion, gradients, shadows or effects without a
  product/brief reason and responsive evidence.
