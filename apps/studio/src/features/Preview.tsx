import {
  Desktop,
  DeviceMobile,
  DeviceTablet,
  EyeSlash,
  SidebarSimple,
} from "@phosphor-icons/react";
import type { StoreProjectV1 } from "@solara/project-schema";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "../components/Ui";

export type PreviewSize = "desktop" | "tablet" | "mobile";
export type PreviewRoute = { path: string; label: string };

const PREVIEW_SCROLLBAR_STYLE = `<style data-solara-preview-scrollbar>
html,
body {
  --solara-preview-scrollbar-policy: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

html::-webkit-scrollbar,
body::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}
</style>`;

function addPreviewScrollbarPolicy(document: string): string {
  const headEnd = document.indexOf("</head>");
  if (headEnd === -1) return `${PREVIEW_SCROLLBAR_STYLE}${document}`;
  return `${document.slice(0, headEnd)}${PREVIEW_SCROLLBAR_STYLE}\n${document.slice(headEnd)}`;
}

export function getPreviewRoutes(project: StoreProjectV1): PreviewRoute[] {
  const firstRoot = project.categories.find((category) => category.parentId === undefined);
  const firstChild = project.categories.find((category) => category.parentId !== undefined);
  const paginatedCategory = project.categories.find(
    (category) => category.productIds.length > project.commerceTemplates.category.productsPerPage,
  );
  const firstProduct = project.products[0];
  const lastProduct = project.products.at(-1);
  return [
    { path: "/", label: "Home" },
    ...(firstRoot
      ? [{ path: `/categorias/${firstRoot.slug}/`, label: `Categor\u00eda: ${firstRoot.title}` }]
      : []),
    ...(firstChild
      ? [
          {
            path: `/categorias/${firstChild.slug}/`,
            label: `Subcategor\u00eda: ${firstChild.title}`,
          },
        ]
      : []),
    ...(paginatedCategory
      ? [
          {
            path: `/categorias/${paginatedCategory.slug}/pagina/2/`,
            label: `Categor\u00eda p\u00e1gina 2: ${paginatedCategory.title}`,
          },
        ]
      : []),
    ...(firstProduct ? [{ path: `/productos/${firstProduct.slug}/`, label: "Producto" }] : []),
    ...(lastProduct && lastProduct.id !== firstProduct?.id
      ? [{ path: `/productos/${lastProduct.slug}/`, label: "Producto final" }]
      : []),
    ...(project.commerceTemplates.search.enabled ? [{ path: "/buscar/", label: "Buscar" }] : []),
    { path: "/contacto/", label: "Contacto" },
    { path: "/nosotros/", label: "Nosotros" },
    ...(project.commerceTemplates.cart.enabled ? [{ path: "/carrito/", label: "Carrito" }] : []),
    ...(project.commerceTemplates.checkout.enabled ? [{ path: "/compra/", label: "Compra" }] : []),
  ];
}

export function PreviewToolbar({
  routes,
  route,
  size,
  onRouteChange,
  onSizeChange,
  onOpenEditor,
}: {
  routes: PreviewRoute[];
  route: string;
  size: PreviewSize;
  onRouteChange(route: string): void;
  onSizeChange(size: PreviewSize): void;
  onOpenEditor(): void;
}) {
  return (
    <div className="preview-toolbar">
      <div className="preview-heading">
        <IconButton
          icon={SidebarSimple}
          label={"Abrir panel de edici\u00f3n"}
          onClick={onOpenEditor}
        />
        <strong>Vista previa</strong>
      </div>
      <label className="preview-route">
        <span className="visually-hidden">Ruta de vista previa</span>
        <select value={route} onChange={(event) => onRouteChange(event.target.value)}>
          {routes.map((item) => (
            <option key={item.path} value={item.path}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="preview-sizes">
        <legend className="visually-hidden">{"Tama\u00f1o de vista previa"}</legend>
        <IconButton
          icon={Desktop}
          label="Vista de escritorio"
          aria-pressed={size === "desktop"}
          onClick={() => onSizeChange("desktop")}
        />
        <IconButton
          icon={DeviceTablet}
          label="Vista de tablet"
          aria-pressed={size === "tablet"}
          onClick={() => onSizeChange("tablet")}
        />
        <IconButton
          icon={DeviceMobile}
          label={"Vista m\u00f3vil"}
          aria-pressed={size === "mobile"}
          onClick={() => onSizeChange("mobile")}
        />
      </fieldset>
    </div>
  );
}

export function Preview({
  project,
  route,
  size,
}: {
  project: StoreProjectV1;
  route: string;
  size: PreviewSize;
}) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const previewAssetSources = useRef<ReadonlyMap<string, string>>(new Map());
  const previewFrame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handlePreviewAssetRequest = (event: MessageEvent<unknown>) => {
      if (event.source !== previewFrame.current?.contentWindow) return;
      if (!event.data || typeof event.data !== "object") return;
      const message = event.data as { type?: unknown; paths?: unknown };
      if (message.type !== "solara-preview-assets-request" || !Array.isArray(message.paths)) return;
      const sources: Record<string, string> = {};
      message.paths.forEach((path) => {
        if (typeof path !== "string") return;
        const source = previewAssetSources.current.get(path);
        if (source) sources[path] = source;
      });
      event.source?.postMessage({ type: "solara-preview-assets-response", sources }, "*");
    };
    window.addEventListener("message", handlePreviewAssetRequest);
    return () => window.removeEventListener("message", handlePreviewAssetRequest);
  }, []);

  useEffect(() => {
    let active = true;
    void import("@solara/exporter")
      .then(({ getPreviewAssetSources, renderPreviewHtml }) => {
        if (!active) return;
        try {
          previewAssetSources.current = getPreviewAssetSources(project);
          setHtml(
            addPreviewScrollbarPolicy(
              renderPreviewHtml(project, "draft", route, { assetTransport: "parent" }),
            ),
          );
          setError("");
        } catch (reason) {
          setError(
            reason instanceof Error ? reason.message : "No se pudo generar la vista previa.",
          );
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : "No se pudo cargar el renderer de preview.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [project, route]);

  return (
    <aside className="preview-pane" aria-label="Vista previa de la tienda">
      <div className={`preview-stage preview-stage--${size}`}>
        {error ? (
          <div className="preview-error">
            <EyeSlash aria-hidden size={28} />
            <strong>{"La vista previa necesita atenci\u00f3n"}</strong>
            <p>{error}</p>
          </div>
        ) : !html ? (
          <output className="preview-loading" aria-live="polite">
            <strong>Preparando vista previa</strong>
            <p>Optimizando recursos de esta tienda...</p>
          </output>
        ) : (
          <iframe
            ref={previewFrame}
            title={`Vista previa ${size}`}
            srcDoc={html}
            sandbox="allow-forms allow-scripts"
          />
        )}
      </div>
    </aside>
  );
}
