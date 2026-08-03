import { Desktop, DeviceMobile, DeviceTablet, EyeSlash } from "@phosphor-icons/react";
import type { StoreProjectV1 } from "@solara/project-schema";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconButton } from "../components/Ui";

type PreviewSize = "desktop" | "tablet" | "mobile";

export function Preview({ project }: { project: StoreProjectV1 }) {
  const [size, setSize] = useState<PreviewSize>("desktop");
  const [route, setRoute] = useState("/");
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const previewAssetSources = useRef<ReadonlyMap<string, string>>(new Map());
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const previewRoutes = useMemo(() => {
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
        ? [{ path: `/categorias/${firstRoot.slug}/`, label: `Categoría: ${firstRoot.title}` }]
        : []),
      ...(firstChild
        ? [{ path: `/categorias/${firstChild.slug}/`, label: `Subcategoría: ${firstChild.title}` }]
        : []),
      ...(paginatedCategory
        ? [
            {
              path: `/categorias/${paginatedCategory.slug}/pagina/2/`,
              label: `Categoría página 2: ${paginatedCategory.title}`,
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
      ...(project.commerceTemplates.checkout.enabled
        ? [{ path: "/compra/", label: "Compra" }]
        : []),
    ];
  }, [
    project.categories,
    project.products,
    project.commerceTemplates.category.productsPerPage,
    project.commerceTemplates.search.enabled,
    project.commerceTemplates.cart.enabled,
    project.commerceTemplates.checkout.enabled,
  ]);

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
    if (!previewRoutes.some((item) => item.path === route)) setRoute("/");
  }, [previewRoutes, route]);

  useEffect(() => {
    let active = true;
    void import("@solara/exporter")
      .then(({ getPreviewAssetSources, renderPreviewHtml }) => {
        if (!active) return;
        try {
          previewAssetSources.current = getPreviewAssetSources(project);
          setHtml(renderPreviewHtml(project, "draft", route, { assetTransport: "parent" }));
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
      <header>
        <strong>Vista previa</strong>
        <label className="preview-route">
          <span className="visually-hidden">Ruta de vista previa</span>
          <select value={route} onChange={(event) => setRoute(event.target.value)}>
            {previewRoutes.map((item) => (
              <option key={item.path} value={item.path}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
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
