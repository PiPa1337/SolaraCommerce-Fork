import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyStudioTheme, readStudioTheme } from "./lib/studioTheme";
import "./styles.css";

applyStudioTheme(readStudioTheme());

const container = document.getElementById("root");
if (!container) {
  throw new Error("No se encontró el contenedor principal.");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// El shell portable usa `solara://` y mantiene su perfil aislado; un
// Service Worker registrado sobre el navegador del sistema no debe mezclarse
// con ese origen. El launcher HTTP de desarrollo conserva el comportamiento
// PWA existente.
if (
  "serviceWorker" in navigator &&
  import.meta.env.PROD &&
  window.location.protocol !== "solara:"
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
