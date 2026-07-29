import { Desktop, DeviceMobile, DeviceTablet, EyeSlash } from "@phosphor-icons/react";
import { renderPreviewHtml } from "@solara/exporter";
import type { StoreProjectV1 } from "@solara/project-schema";
import { useEffect, useState } from "react";
import { IconButton } from "../components/Ui";

type PreviewSize = "desktop" | "tablet" | "mobile";

export function Preview({ project }: { project: StoreProjectV1 }) {
  const [size, setSize] = useState<PreviewSize>("desktop");
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        setHtml(renderPreviewHtml(project, "draft"));
        setError("");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "No se pudo generar la vista previa.");
      }
    }, 140);
    return () => window.clearTimeout(timeout);
  }, [project]);

  return (
    <aside className="preview-pane" aria-label="Vista previa de la tienda">
      <header>
        <strong>Vista previa</strong>
        <fieldset className="preview-sizes">
          <legend className="visually-hidden">Tamaño de vista previa</legend>
          <IconButton
            icon={Desktop}
            label="Vista de escritorio"
            aria-pressed={size === "desktop"}
            onClick={() => setSize("desktop")}
          />
          <IconButton
            icon={DeviceTablet}
            label="Vista de tablet"
            aria-pressed={size === "tablet"}
            onClick={() => setSize("tablet")}
          />
          <IconButton
            icon={DeviceMobile}
            label="Vista móvil"
            aria-pressed={size === "mobile"}
            onClick={() => setSize("mobile")}
          />
        </fieldset>
      </header>
      <div className={`preview-stage preview-stage--${size}`}>
        {error ? (
          <div className="preview-error">
            <EyeSlash aria-hidden size={28} />
            <strong>La vista previa necesita atención</strong>
            <p>{error}</p>
          </div>
        ) : (
          <iframe
            title={`Vista previa ${size}`}
            srcDoc={html}
            sandbox="allow-forms allow-scripts"
          />
        )}
      </div>
    </aside>
  );
}
