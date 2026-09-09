export type GravityTaaQuality = "off" | "low" | "medium" | "high" | "very-high" | "extreme";

export const GRAVITY_TAA_QUALITY_IDS: GravityTaaQuality[] = [
  "off",
  "low",
  "medium",
  "high",
  "very-high",
  "extreme",
];

export const GRAVITY_TAA_QUALITY_META: Record<
  GravityTaaQuality,
  { label: string; description: string }
> = {
  off: { label: "Off", description: "Render actual, sin acumulación" },
  low: { label: "Bajo", description: "Suaviza bordes con poco coste" },
  medium: { label: "Medio", description: "Equilibrio entre nitidez y estabilidad" },
  high: { label: "Alto", description: "Máxima limpieza en filamentos" },
  "very-high": { label: "Muy alto", description: "Acumulación profunda para bordes exigentes" },
  extreme: { label: "Extremo", description: "Máxima estabilidad visual y detalle temporal" },
};

export interface GravitySettings {
  renderScaleMultiplier: number;
  maxFps: number;
  diskLayers: number;
  materialSpeed: number;
  pointerResponse: number;
  starDensity: number;
  dustIntensity: number;
  haloIntensity: number;
  warmth: number;
  contrast: number;
  turbulence: number;
  filamentDetail: number;
  gasAbsorption: number;
  diskTilt: number;
  lensStrength: number;
  bloomSpread: number;
  causticIntensity: number;
  galaxyIntensity: number;
  starTwinkle: number;
  vignette: number;
  pauseWhenHidden: boolean;
  taaQuality: GravityTaaQuality;
}

export type NumericGravitySetting = Exclude<
  keyof GravitySettings,
  "pauseWhenHidden" | "taaQuality"
>;

export const GRAVITY_NUMERIC_SETTINGS: NumericGravitySetting[] = [
  "renderScaleMultiplier",
  "maxFps",
  "diskLayers",
  "materialSpeed",
  "pointerResponse",
  "starDensity",
  "dustIntensity",
  "haloIntensity",
  "warmth",
  "contrast",
  "turbulence",
  "filamentDetail",
  "gasAbsorption",
  "diskTilt",
  "lensStrength",
  "bloomSpread",
  "causticIntensity",
  "galaxyIntensity",
  "starTwinkle",
  "vignette",
];

export const DEFAULT_GRAVITY_SETTINGS: GravitySettings = {
  renderScaleMultiplier: 1,
  maxFps: 60,
  diskLayers: 3,
  materialSpeed: 1,
  pointerResponse: 1,
  starDensity: 1,
  dustIntensity: 1,
  haloIntensity: 1,
  warmth: 1,
  contrast: 1,
  turbulence: 1,
  filamentDetail: 1,
  gasAbsorption: 1,
  diskTilt: 1,
  lensStrength: 1,
  bloomSpread: 1,
  causticIntensity: 1,
  galaxyIntensity: 1,
  starTwinkle: 1,
  vignette: 1,
  pauseWhenHidden: true,
  taaQuality: "off",
};

export type GravityPresetId = "efficiency" | "current" | "maximum";

export const GRAVITY_PRESETS: Record<GravityPresetId, GravitySettings> = {
  efficiency: {
    renderScaleMultiplier: 0.1,
    maxFps: 30,
    diskLayers: 1,
    materialSpeed: 0.1,
    pointerResponse: 0.1,
    starDensity: 0.1,
    dustIntensity: 0.1,
    haloIntensity: 0.1,
    warmth: 0.1,
    contrast: 0.1,
    turbulence: 0.1,
    filamentDetail: 0.1,
    gasAbsorption: 0.1,
    diskTilt: 0.1,
    lensStrength: 0.1,
    bloomSpread: 0.1,
    causticIntensity: 0.1,
    galaxyIntensity: 0.1,
    starTwinkle: 0.1,
    vignette: 0.1,
    pauseWhenHidden: true,
    taaQuality: "off",
  },
  current: DEFAULT_GRAVITY_SETTINGS,
  maximum: {
    renderScaleMultiplier: 2.5,
    maxFps: 120,
    diskLayers: 6,
    materialSpeed: 4,
    pointerResponse: 4,
    starDensity: 3,
    dustIntensity: 3,
    haloIntensity: 3,
    warmth: 3,
    contrast: 2.8,
    turbulence: 3,
    filamentDetail: 3,
    gasAbsorption: 3,
    diskTilt: 3,
    lensStrength: 3,
    bloomSpread: 3,
    causticIntensity: 3,
    galaxyIntensity: 3,
    starTwinkle: 3,
    vignette: 3,
    pauseWhenHidden: true,
    taaQuality: "extreme",
  },
};

export const GRAVITY_PRESET_META: Record<GravityPresetId, { label: string; description: string }> =
  {
    efficiency: {
      label: "Eficiencia",
      description: "Menos carga para equipos ajustados",
    },
    current: {
      label: "Actual",
      description: "La calidad que ya usa el dashboard",
    },
    maximum: {
      label: "Máxima",
      description: "Más detalle y presencia visual",
    },
  };

export const GRAVITY_PRESET_IDS: GravityPresetId[] = ["efficiency", "current", "maximum"];

export const GRAVITY_PREFERENCES_STORAGE_KEY = "solara-commerce-gravity-preferences-v1";
export const CUSTOM_GRAVITY_PRESET_COUNT = 3;

export interface GravityPreferences {
  customPresets: Array<GravitySettings | null>;
  activeSettings: GravitySettings;
  activeCustomPreset: number | null;
  selectedCustomPreset: number;
}

function createDefaultGravityPreferences(): GravityPreferences {
  return {
    customPresets: Array.from({ length: CUSTOM_GRAVITY_PRESET_COUNT }, () => null),
    activeSettings: DEFAULT_GRAVITY_SETTINGS,
    activeCustomPreset: null,
    selectedCustomPreset: 0,
  };
}

function isGravityPresetIndex(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < CUSTOM_GRAVITY_PRESET_COUNT
  );
}

function isGravityTaaQuality(value: unknown): value is GravityTaaQuality {
  return typeof value === "string" && GRAVITY_TAA_QUALITY_IDS.includes(value as GravityTaaQuality);
}

function parseGravitySettings(value: unknown): GravitySettings | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (
    !GRAVITY_NUMERIC_SETTINGS.every(
      (setting) => typeof candidate[setting] === "number" && Number.isFinite(candidate[setting]),
    ) ||
    typeof candidate.pauseWhenHidden !== "boolean"
  ) {
    return null;
  }
  const taaQuality = candidate.taaQuality === undefined ? "off" : candidate.taaQuality;
  if (!isGravityTaaQuality(taaQuality)) return null;
  return { ...DEFAULT_GRAVITY_SETTINGS, ...candidate, taaQuality } as GravitySettings;
}

export function isGravitySettings(value: unknown): value is GravitySettings {
  return parseGravitySettings(value) !== null;
}

export function loadGravityPreferences(): GravityPreferences {
  const fallback = createDefaultGravityPreferences();
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(GRAVITY_PREFERENCES_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return fallback;
    const candidate = parsed as Record<string, unknown>;
    const storedPresets = Array.isArray(candidate.customPresets) ? candidate.customPresets : [];
    const customPresets = Array.from({ length: CUSTOM_GRAVITY_PRESET_COUNT }, (_, index) => {
      const preset = storedPresets[index];
      return parseGravitySettings(preset);
    });
    const storedActiveCustomPreset = candidate.activeCustomPreset;
    const activeCustomPreset =
      isGravityPresetIndex(storedActiveCustomPreset) && customPresets[storedActiveCustomPreset]
        ? storedActiveCustomPreset
        : null;
    return {
      customPresets,
      activeSettings: parseGravitySettings(candidate.activeSettings) ?? DEFAULT_GRAVITY_SETTINGS,
      activeCustomPreset,
      selectedCustomPreset: isGravityPresetIndex(candidate.selectedCustomPreset)
        ? candidate.selectedCustomPreset
        : 0,
    };
  } catch {
    return fallback;
  }
}

export function persistGravityPreferences(preferences: GravityPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GRAVITY_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // La preferencia es opcional: el dashboard sigue funcionando si el navegador bloquea storage.
  }
}
