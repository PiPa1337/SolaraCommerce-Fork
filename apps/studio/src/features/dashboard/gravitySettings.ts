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
  off: {
    label: "Off",
    description: "1 muestra: sin acumulación temporal y con el menor coste de GPU",
  },
  low: {
    label: "Bajo",
    description: "2 muestras: suaviza bordes con un aumento mínimo de carga",
  },
  medium: {
    label: "Medio",
    description: "4 muestras: equilibrio entre bordes limpios y uso de GPU",
  },
  high: {
    label: "Alto",
    description: "8 muestras: reduce más el parpadeo de filamentos y bordes dentados",
  },
  "very-high": {
    label: "Muy alto",
    description: "12 muestras: estabiliza detalles finos con mayor coste de GPU",
  },
  extreme: {
    label: "Extremo",
    description: "16 muestras: máxima estabilidad temporal y mayor uso de GPU",
  },
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
  staticDiskDetails: boolean;
  pauseWhenHidden: boolean;
  taaQuality: GravityTaaQuality;
}

export type NumericGravitySetting = Exclude<
  keyof GravitySettings,
  "staticDiskDetails" | "pauseWhenHidden" | "taaQuality"
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

export const GRAVITY_CINEMATIC_SETTINGS: readonly NumericGravitySetting[] = [
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

const GRAVITY_PRESET_NUMERIC_SETTINGS = GRAVITY_NUMERIC_SETTINGS.filter(
  (setting) => !GRAVITY_CINEMATIC_SETTINGS.includes(setting),
);

export function applyBuiltInGravityPreset(
  current: GravitySettings,
  preset: GravitySettings,
): GravitySettings {
  const next = { ...preset };
  for (const setting of GRAVITY_CINEMATIC_SETTINGS) {
    next[setting] = current[setting];
  }
  next.staticDiskDetails = current.staticDiskDetails;
  return next;
}

export function isGravityPresetActive(settings: GravitySettings, preset: GravitySettings): boolean {
  return (
    GRAVITY_PRESET_NUMERIC_SETTINGS.every((setting) => settings[setting] === preset[setting]) &&
    settings.pauseWhenHidden === preset.pauseWhenHidden &&
    settings.taaQuality === preset.taaQuality
  );
}

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
  staticDiskDetails: true,
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
    staticDiskDetails: true,
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
    staticDiskDetails: true,
    pauseWhenHidden: true,
    taaQuality: "extreme",
  },
};

export const GRAVITY_PRESET_META: Record<GravityPresetId, { label: string; description: string }> =
  {
    efficiency: {
      label: "Eficiencia",
      description: "Baja resolución, FPS y capas para reducir el uso de GPU",
    },
    current: {
      label: "Actual",
      description: "Mantiene 100% de resolución, 60 FPS y 3 capas",
    },
    maximum: {
      label: "Máxima",
      description: "Sube resolución, FPS, capas y densidad de estrellas; usa más GPU",
    },
  };

export const GRAVITY_PRESET_IDS: GravityPresetId[] = ["efficiency", "current", "maximum"];

export const GRAVITY_PREFERENCES_STORAGE_KEY = "solara-commerce-gravity-preferences-v1";
export const GRAVITY_PREFERENCES_ENDPOINT = "/__solara/storage/preferences/gravity";
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
  const staticDiskDetails =
    candidate.staticDiskDetails === undefined ? true : candidate.staticDiskDetails;
  if (typeof staticDiskDetails !== "boolean") return null;
  const taaQuality = candidate.taaQuality === undefined ? "off" : candidate.taaQuality;
  if (!isGravityTaaQuality(taaQuality)) return null;
  return {
    ...DEFAULT_GRAVITY_SETTINGS,
    ...candidate,
    staticDiskDetails,
    taaQuality,
  } as GravitySettings;
}

export function isGravitySettings(value: unknown): value is GravitySettings {
  return parseGravitySettings(value) !== null;
}

function parseGravityPreferences(value: unknown): GravityPreferences | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
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
}

export function loadGravityPreferences(): GravityPreferences {
  const fallback = createDefaultGravityPreferences();
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(GRAVITY_PREFERENCES_STORAGE_KEY);
    if (!raw) return fallback;
    return parseGravityPreferences(JSON.parse(raw)) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function loadGravityPreferencesFromDisk(): Promise<GravityPreferences | null> {
  if (typeof window === "undefined") return null;
  try {
    const response = await fetch(GRAVITY_PREFERENCES_ENDPOINT, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
    return parseGravityPreferences((body as Record<string, unknown>).preferences);
  } catch {
    return null;
  }
}

export async function persistGravityPreferencesToDisk(
  preferences: GravityPreferences,
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const response = await fetch(GRAVITY_PREFERENCES_ENDPOINT, {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferences),
    });
    return response.ok;
  } catch {
    return false;
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
