import { installFrameRateCap, MAX_APP_FPS } from "@solara/storefront-runtime";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyStudioTheme } from "./lib/studioTheme";
import "./styles.css";

installFrameRateCap(window, MAX_APP_FPS);
applyStudioTheme("dark");
document.documentElement.style.colorScheme = "dark";
document.documentElement.dataset.solaraFpsCap = String(MAX_APP_FPS);

const container = document.getElementById("root");
if (!container) {
  throw new Error("No se encontró el contenedor principal.");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// El shell portable usa solara:// y mantiene su perfil aislado; un
// Service Worker sobre el navegador no debe mezclarse con ese origen.
// Launcher HTTP conserva comportamiento PWA.
if (
  "serviceWorker" in navigator &&
  import.meta.env.PROD &&
  window.location.protocol !== "solara:"
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Chequeo periodico para detectar deploys nuevos mientras la tab queda abierta.
        window.setInterval(() => {
          registration.update().catch(() => undefined);
        }, 60_000);

        const notifyUpdate = (worker: ServiceWorker | null) => {
          if (!worker) return;
          window.dispatchEvent(new CustomEvent("solara-sw-update", { detail: worker }));
          try {
            localStorage.setItem("solara-sw-update-available", "1");
          } catch {
            // storage bloqueado: aviso solo en memoria.
          }
        };

        if (registration.waiting) notifyUpdate(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              notifyUpdate(worker);
            }
          });
        });

        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          // Notificar a App que el SW cambio; App decide si recargar (no recargar automaticamente en primer install)
          window.dispatchEvent(new CustomEvent("solara-sw-controllerchange"));
        });
      })
      .catch(() => undefined);

    // Banner de App puede pedir activacion inmediata
    window.addEventListener("solara-sw-activate", () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
      });
    });
  });
}
