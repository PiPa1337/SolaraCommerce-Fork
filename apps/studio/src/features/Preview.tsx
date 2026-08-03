import { Desktop, DeviceMobile, DeviceTablet, EyeSlash } from "@phosphor-icons/react";
import type { StoreProjectV1 } from "@solara/project-schema";
import { useEffect, useMemo, useState } from "react";
import { IconButton } from "../components/Ui";

type PreviewSize = "desktop" | "tablet" | "mobile";

export function Preview({ project }: { project: StoreProjectV1 }) {
  const [size, setSize] = useState<PreviewSize>("desktop");
  const [route, setRoute] = useState("/");
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
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
    if (!previewRoutes.some((item) => item.path === route)) setRoute("/");
  }, [previewRoutes, route]);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      void import("@solara/exporter")
        .then(({ renderPreviewHtml }) => {
          if (!active) return;
          try {
            setHtml(renderPreviewHtml(project, "draft", route));
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
              reason instanceof Error
                ? reason.message
                : "No se pudo cargar el renderer de preview.",
            );
          }
        });
    }, 140);
    return () => {
      active = false;
      window.clearTimeout(timeout);
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
