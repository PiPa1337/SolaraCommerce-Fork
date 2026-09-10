import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyBuiltInGravityPreset,
  DEFAULT_GRAVITY_SETTINGS,
  GRAVITY_CINEMATIC_SETTINGS,
  GRAVITY_PRESETS,
  type GravityPreferences,
  type GravitySettings,
  isGravityPresetActive,
  loadGravityPreferencesFromDisk,
  persistGravityPreferencesToDisk,
} from "./gravitySettings";

afterEach(() => vi.unstubAllGlobals());

describe("presets de cinemática del dashboard", () => {
  it("mantiene la cinemática avanzada al aplicar un preset incorporado", () => {
    const current: GravitySettings = {
      ...DEFAULT_GRAVITY_SETTINGS,
      turbulence: 2.1,
      filamentDetail: 2.2,
      gasAbsorption: 2.3,
      diskTilt: 2.4,
      lensStrength: 2.5,
      bloomSpread: 2.6,
      causticIntensity: 2.7,
      galaxyIntensity: 2.8,
      starTwinkle: 2.9,
      vignette: 1.8,
      staticDiskDetails: false,
    };

    const next = applyBuiltInGravityPreset(current, GRAVITY_PRESETS.maximum);

    expect(next).toMatchObject({
      renderScaleMultiplier: 2.5,
      maxFps: 120,
      diskLayers: 6,
      taaQuality: "extreme",
    });
    for (const setting of GRAVITY_CINEMATIC_SETTINGS) {
      expect(next[setting], setting).toBe(current[setting]);
    }
    expect(next.staticDiskDetails).toBe(false);
    expect(isGravityPresetActive(next, GRAVITY_PRESETS.maximum)).toBe(true);
  });
});

describe("preferencias persistentes de Gargantua", () => {
  it("lee y guarda mediante el API de archivo local", async () => {
    const activeSettings = {
      ...DEFAULT_GRAVITY_SETTINGS,
      filamentDetail: 2.75,
      staticDiskDetails: false,
    };
    const preferences: GravityPreferences = {
      customPresets: [activeSettings, null, null],
      activeSettings,
      activeCustomPreset: 0,
      selectedCustomPreset: 0,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, preferences }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadGravityPreferencesFromDisk()).resolves.toEqual(preferences);
    await expect(persistGravityPreferencesToDisk(preferences)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/__solara/storage/preferences/gravity",
      expect.objectContaining({ method: "PUT", body: JSON.stringify(preferences) }),
    );
  });
});
