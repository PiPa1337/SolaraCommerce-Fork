export type StudioTheme = "dark";

export const STUDIO_THEME_STORAGE_KEY = "solara-studio-theme";

// Dark-only: light theme deprecado. Migra preferencia antigua silenciosamente.
export function readStudioTheme(): StudioTheme {
  try {
    const v = window.localStorage.getItem(STUDIO_THEME_STORAGE_KEY);
    if (v === "light") window.localStorage.removeItem(STUDIO_THEME_STORAGE_KEY);
  } catch {}
  return "dark";
}

export function applyStudioTheme(_theme: StudioTheme): void {
  document.documentElement.setAttribute("data-studio-theme", "dark");
  document.documentElement.style.colorScheme = "dark";
}

export function storeStudioTheme(_theme: StudioTheme): void {}
