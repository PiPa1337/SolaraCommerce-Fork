/**
 * Preview del storefront. Renderiza HTML mediante el mismo exporter que genera
 * el sitio público y sólo hidrata assets del iframe por postMessage; no debe
 * convertirse en una segunda implementación visual.
 */
import {
  Desktop,
  DeviceMobile,
  DeviceTablet,
  EyeSlash,
  SidebarSimple,
} from "@phosphor-icons/react";
import type { StoreProjectV1 } from "@solara/project-schema";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Tooltip } from "../components/primitives";
import { Button, IconButton } from "../components/Ui";
import { loadExporter } from "../lib/loadExporter";

export type PreviewSize = "desktop" | "tablet" | "mobile";
export type PreviewZoom = 100 | 75 | 50;
export type PreviewRoute = { path: string; label: string };

const ZOOM_OPTIONS: Array<{ value: PreviewZoom; label: string }> = [
  { value: 100, label: "100%" },
  { value: 75, label: "75%" },
  { value: 50, label: "50%" },
];

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

/**
 * La vista previa transporta los assets por postMessage y nunca resuelve el
 * dominio del proyecto; el exporter emite el preload LCP absoluto sólo en
 * modo producción, por lo que el iframe del preview no dispara peticiones
 * reales a la URL pública del sitio.
 */
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
  zoom,
  onRouteChange,
  onSizeChange,
  onZoomChange,
  onOpenEditor,
}: {
  routes: PreviewRoute[];
  route: string;
  size: PreviewSize;
  zoom: PreviewZoom;
  onRouteChange(route: string): void;
  onSizeChange(size: PreviewSize): void;
  onZoomChange(zoom: PreviewZoom): void;
  onOpenEditor(): void;
}) {
  const routeListId = useId();
  const [routeDraft, setRouteDraft] = useState(route);
  useEffect(() => {
    setRouteDraft(route);
  }, [route]);

  const commitRoute = useCallback(() => {
    const next = routeDraft.trim();
    if (!next) {
      setRouteDraft(route);
      return;
    }
    if (next !== route) onRouteChange(next);
  }, [onRouteChange, route, routeDraft]);

  return (
    <div className="preview-toolbar">
      <div className="preview-heading">
        <Tooltip tip="Abrir panel de edición" position="bottom">
          <IconButton
            icon={SidebarSimple}
            label={"Abrir panel de edici\u00f3n"}
            onClick={onOpenEditor}
          />
        </Tooltip>
        <strong>Vista previa</strong>
      </div>
      <output
        className="preview-route-announce visually-hidden"
        aria-live="polite"
        data-testid="ui-preview-route-announce"
      >
        {`Vista previa: ${route}`}
      </output>
      <label className="preview-route">
        <span className="visually-hidden">Ruta de vista previa</span>
        <input
          data-testid="ui-preview-route"
          type="text"
          list={routeListId}
          aria-label="Ruta de vista previa"
          autoComplete="off"
          spellCheck={false}
          value={routeDraft}
          onChange={(event) => setRouteDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            commitRoute();
          }}
          onBlur={commitRoute}
        />
      </label>
      <datalist id={routeListId}>
        {routes.map((item) => (
          <option key={item.path} value={item.path}>
            {item.label}
          </option>
        ))}
      </datalist>
      <fieldset className="preview-zoom">
        <legend className="visually-hidden">{"Zoom de vista previa"}</legend>
        {ZOOM_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="preview-zoom__button"
            aria-pressed={zoom === option.value}
            onClick={() => onZoomChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </fieldset>
      <fieldset className="preview-sizes">
        <legend className="visually-hidden">{"Tama\u00f1o de vista previa"}</legend>
        <Tooltip tip="Vista de escritorio" position="bottom">
          <IconButton
            icon={Desktop}
            label="Vista de escritorio"
            aria-pressed={size === "desktop"}
            onClick={() => onSizeChange("desktop")}
          />
        </Tooltip>
        <Tooltip tip="Vista de tablet" position="bottom">
          <IconButton
            icon={DeviceTablet}
            label="Vista de tablet"
            aria-pressed={size === "tablet"}
            onClick={() => onSizeChange("tablet")}
          />
        </Tooltip>
        <Tooltip tip="Vista móvil" position="bottom">
          <IconButton
            icon={DeviceMobile}
            label={"Vista m\u00f3vil"}
            aria-pressed={size === "mobile"}
            onClick={() => onSizeChange("mobile")}
          />
        </Tooltip>
      </fieldset>
    </div>
  );
}

export function Preview({
  project,
  route,
  size,
  zoom,
}: {
  project: StoreProjectV1;
  route: string;
  size: PreviewSize;
  zoom: PreviewZoom;
}) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [renderToken, setRenderToken] = useState(0);
  const [iframeReady, setIframeReady] = useState(false);
  const previewAssetSources = useRef<ReadonlyMap<string, string>>(new Map());
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const previewObserver = useRef<IntersectionObserver | null>(null);
  const pausedRef = useRef(false);
  const intersectingRef = useRef(true);
  const visibleRef = useRef(!document.hidden);

  /**
   * Contrato con el runtime del storefront (Task A4): un postMessage
   * { type: "solara-pause" } detiene observadores, animaciones y scroll-work;
   * { type: "solara-resume" } los reanuda. El preview pausa cuando la pestaña
   * está oculta o el iframe queda fuera de viewport.
   */
  const setPaused = useCallback((paused: boolean) => {
    if (paused === pausedRef.current) return;
    pausedRef.current = paused;
    previewFrame.current?.contentWindow?.postMessage(
      { type: paused ? "solara-pause" : "solara-resume" },
      "*",
    );
  }, []);

  const evaluatePause = useCallback(() => {
    setPaused(!visibleRef.current || !intersectingRef.current);
  }, [setPaused]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      visibleRef.current = !document.hidden;
      evaluatePause();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [evaluatePause]);

  /* El observer sigue al iframe (condicional según html/error): al montar el
     nodo observa, al desmontar desconecta y limpia la referencia. */
  const attachPreviewObserver = useCallback(
    (node: HTMLIFrameElement | null) => {
      previewObserver.current?.disconnect();
      previewObserver.current = null;
      previewFrame.current = node;
      if (!node) return;
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          intersectingRef.current = entry.isIntersecting;
          evaluatePause();
        }
      });
      observer.observe(node);
      previewObserver.current = observer;
    },
    [evaluatePause],
  );

  useEffect(() => {
    return () => {
      previewFrame.current?.contentWindow?.postMessage({ type: "solara-pause" }, "*");
    };
  }, []);

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
    void loadExporter(renderToken)
      .then(({ getPreviewAssetSources, renderPreviewHtml }) => {
        if (!active) return;
        try {
          previewAssetSources.current = getPreviewAssetSources(project);
          setHtml(
            addPreviewScrollbarPolicy(
              renderPreviewHtml(project, "draft", route, { assetTransport: "parent" }),
            ),
          );
          setIframeReady(false);
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
  }, [project, route, renderToken]);

  return (
    <aside className="preview-pane" aria-label="Vista previa de la tienda">
      <div className={`preview-stage preview-stage--${size}`}>
        {error ? (
          <div className="preview-error">
            <EyeSlash aria-hidden size={28} />
            <strong>{"La vista previa necesita atenci\u00f3n"}</strong>
            <p>{error}</p>
            <Button variant="secondary" onClick={() => setRenderToken((token) => token + 1)}>
              Recargar vista previa
            </Button>
          </div>
        ) : !html ? (
          <output className="preview-loading" aria-live="polite">
            <strong>Preparando vista previa</strong>
            <p>Optimizando recursos de esta tienda...</p>
          </output>
        ) : (
          <>
            <iframe
              ref={attachPreviewObserver}
              title={`Vista previa ${size}`}
              srcDoc={html}
              sandbox="allow-forms allow-scripts"
              style={zoom !== 100 ? { zoom: zoom / 100 } : undefined}
              onLoad={() => {
                setIframeReady(true);
                if (pausedRef.current) {
                  previewFrame.current?.contentWindow?.postMessage({ type: "solara-pause" }, "*");
                }
              }}
            />
            {!iframeReady ? (
              <output
                className="preview-overlay"
                data-testid="ui-preview-loading"
                aria-live="polite"
              >
                <span className="save-spinner" aria-hidden />
                Cargando vista previa
              </output>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}
