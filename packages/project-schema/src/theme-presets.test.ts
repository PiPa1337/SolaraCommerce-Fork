import { describe, expect, it } from "vitest";
import type { Theme } from "./index";
import { StoreProjectV2Schema } from "./index";
import { applyPreset, THEME_PRESETS } from "./theme-presets";

const baseTheme: Theme = {
  colorMode: "light",
  colors: {
    background: "#fcfcfb",
    surface: "#f0f0ee",
    text: "#0b0b0c",
    muted: "#696966",
    accent: "#0b0b0c",
    accentText: "#ffffff",
    border: "#dededa",
    sale: "#d94a55",
    rating: "#d99a12",
  },
  darkColors: undefined,
  typography: {
    display: "Georgia, serif",
    body: "system-ui, sans-serif",
    scale: 1.2,
    lineHeightTight: 1.15,
    lineHeightBody: 1.6,
    letterSpacingDisplay: "-0.02em",
    fontWeightDisplay: 500,
    fontWeightBody: 400,
  },
  spacingScale: 1,
  spacing: {
    sectionY: "clamp(3rem, 6vw, 6rem)",
    cardGap: "clamp(1rem, 2vw, 2rem)",
    containerPaddingX: "1rem",
  },
  shadows: { card: "none", elevated: "none", overlay: "0 24px 70px rgba(0,0,0,.14)" },
  borders: { width: "1px", style: "solid" },
  motion: { durationFast: "150ms", durationNormal: "280ms", easing: "cubic-bezier(.16,1,.3,1)" },
  radius: 8,
  container: 1240,
};

describe("theme presets", () => {
  it("define al menos 5 presets con id y label unicos", () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(5);
    const ids = THEME_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("applyPreset no muta el tema original", () => {
    const original = structuredClone(baseTheme);
    applyPreset(baseTheme, "editorial");
    expect(baseTheme).toEqual(original);
  });

  it("cada preset produce colores validos para cada campo", () => {
    for (const preset of THEME_PRESETS) {
      if (!preset.tokens.colors) continue;
      for (const [key, value] of Object.entries(preset.tokens.colors)) {
        expect(value, `${preset.id}.${key}`).toMatch(/^#[0-9a-fA-F]{3,6}$/);
      }
    }
  });

  it("applyPreset cambia los colores del tema", () => {
    const themed = applyPreset(baseTheme, "minimal");
    expect(themed.colors.background).not.toBe(baseTheme.colors.background);
    expect(themed.radius).toBe(0);
  });

  it("applyPreset con id desconocido retorna el tema original", () => {
    const themed = applyPreset(baseTheme, "no-existe");
    expect(themed).toEqual(baseTheme);
  });
});
