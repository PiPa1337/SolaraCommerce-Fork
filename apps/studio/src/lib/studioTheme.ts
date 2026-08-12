export type StudioTheme = "light" | "dark";

export const STUDIO_THEME_STORAGE_KEY = "solara-studio-theme";

/** El Studio nace oscuro; una preferencia clara guardada siempre tiene prioridad. */
export function readStudioTheme(): StudioTheme {
  try {
    return window.localStorage.getItem(STUDIO_THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyStudioTheme(theme: StudioTheme): void {
  document.documentElement.setAttribute("data-studio-theme", theme);
}

export function storeStudioTheme(theme: StudioTheme): void {
  try {
    window.localStorage.setItem(STUDIO_THEME_STORAGE_KEY, theme);
  } catch {
    // Almacenamiento bloqueado: el tema se conserva sólo en memoria.
  }
}
