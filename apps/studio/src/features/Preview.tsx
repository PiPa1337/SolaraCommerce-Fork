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

function readPreviewCartState(storeId: string): string {
  const parse = (serialized: string | null): string | undefined => {
    if (serialized === null) return undefined;
    try {
      const parsed = JSON.parse(serialized);
      if (!Array.isArray(parsed)) return undefined;
      const validLine = parsed.some((line) => {
        if (!line || typeof line !== "object") return false;
        const value = line as Record<string, unknown>;
        return (
          typeof value.variantId === "string" &&
          value.variantId.length > 0 &&
          typeof value.title === "string" &&
          typeof value.variantTitle === "string" &&
          typeof value.sku === "string" &&
          typeof value.unitPrice === "number" &&
          Number.isFinite(value.unitPrice) &&
          typeof value.quantity === "number" &&
          Number.isFinite(value.quantity) &&
          value.quantity >= 1 &&
          value.quantity <= 99
        );
      });
      return parsed.length === 0 || validLine ? serialized : undefined;
    } catch {
      return undefined;
    }
  };
  try {
    const key = `solara-cart:${storeId}`;
    const stored = parse(window.localStorage.getItem(key));
    const backup = parse(window.localStorage.getItem(`${key}:backup`));
    if (stored !== undefined && JSON.parse(stored).length > 0) return stored;
    return backup ?? stored ?? "[]";
  } catch {}
  return "[]";
}

function addPreviewCartState(
  document: string,
  storeId: string,
  sessionId: string,
  serialized = readPreviewCartState(storeId),
): string {
  const element = `<script id="solara-preview-cart" data-session="${sessionId}" data-key="solara-cart:${storeId}" data-hydrated="true" type="application/json">${serialized.replace(/</g, "\\u003c")}</script>`;
  const headEnd = document.indexOf("</head>");
  if (headEnd === -1) return `${element}${document}`;
  return `${document.slice(0, headEnd)}${element}\n${document.slice(headEnd)}`;
}

function addPreviewNavigationBridge(document: string): string {
  const bridge = `<script data-solara-preview-navigation>
(() => {
  const state = document.getElementById("solara-preview-cart");
  const session = state?.dataset.session ?? "";
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    const href = anchor.getAttribute("href") ?? "";
    if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/#")) return;
    event.preventDefault();
    if (state) {
      parent.postMessage({
        type: "solara-preview-cart-snapshot",
        key: state.dataset.key ?? "",
        value: state.textContent ?? "[]",
        session,
      }, "*");
    }
    parent.postMessage({ type: "solara-preview-navigate", path: href, session }, "*");
  }, true);
})();
</script>`;
  const bodyEnd = document.indexOf("</body>");
  if (bodyEnd === -1) return `${document}${bridge}`;
  return `${document.slice(0, bodyEnd)}${bridge}\n${document.slice(bodyEnd)}`;
}

/**
 * La vista previa transporta los assets por postMessage y nunca resuelve el
 * dominio del proyecto; el exporter emite el preload LCP absoluto sólo en
 * modo producción, por lo que el iframe del preview no dispara peticiones
 * reales a la URL pública del sitio.
 */
export function getPreviewRoutes(project: StoreProjectV1): PreviewRoute[] {
  const standaloneV2PagesRemoved = project.commerceTemplates.designFamily === "catalog-modern-v2";
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
    ...(standaloneV2PagesRemoved
      ? []
      : [
          { path: "/contacto/", label: "Contacto" },
          { path: "/nosotros/", label: "Nosotros" },
        ]),
    ...(project.commerceTemplates.cart.enabled ? [{ path: "/carrito/", label: "Carrito" }] : []),
    ...(project.commerceTemplates.checkout.enabled && !standaloneV2PagesRemoved
      ? [{ path: "/compra/", label: "Compra" }]
      : []),
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
  onRouteChange,
}: {
  project: StoreProjectV1;
  route: string;
  size: PreviewSize;
  zoom: PreviewZoom;
  onRouteChange(route: string): void;
}) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [renderToken, setRenderToken] = useState(0);
  const [iframeReady, setIframeReady] = useState(false);
  const [htmlSession, setHtmlSession] = useState("");
  const previewAssetSources = useRef<ReadonlyMap<string, string>>(new Map());
  const previewFrameWindows = useRef<Window[]>([]);
  const previewRenderSessionRef = useRef(0);
  const activePreviewSessionRef = useRef("");
  const previewCartStateRef = useRef<{ key: string; serialized: string } | null>(null);
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const previewObserver = useRef<IntersectionObserver | null>(null);
  const pausedRef = useRef(false);
  const intersectingRef = useRef(true);
  const visibleRef = useRef(!document.hidden);
  const previewSandbox =
    typeof window !== "undefined" && window.location.protocol === "solara:"
      ? "allow-forms allow-scripts allow-same-origin"
      : "allow-forms allow-scripts";

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
      if (node.contentWindow) {
        previewFrameWindows.current = [
          ...previewFrameWindows.current.slice(-2),
          node.contentWindow,
        ];
      }
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
      if (!event.data || typeof event.data !== "object") return;
      const message = event.data as { type?: unknown; paths?: unknown };
      const cartMessage = event.data as {
        type?: unknown;
        key?: unknown;
        value?: unknown;
        session?: unknown;
      };
      const navigationMessage = event.data as {
        type?: unknown;
        path?: unknown;
        session?: unknown;
      };
      if (
        navigationMessage.type === "solara-preview-navigate" &&
        typeof navigationMessage.path === "string" &&
        navigationMessage.path.startsWith("/") &&
        !navigationMessage.path.startsWith("//") &&
        navigationMessage.session === activePreviewSessionRef.current
      ) {
        if (!event.source || !previewFrameWindows.current.includes(event.source as Window)) return;
        onRouteChange(navigationMessage.path);
        return;
      }
      if (
        (cartMessage.type === "solara-preview-cart-write" ||
          cartMessage.type === "solara-preview-cart-snapshot") &&
        typeof cartMessage.key === "string" &&
        cartMessage.key === `solara-cart:${project.id}` &&
        cartMessage.session === activePreviewSessionRef.current
      ) {
        if (event.source !== previewFrame.current?.contentWindow) return;
        const serialized = typeof cartMessage.value === "string" ? cartMessage.value : "[]";
        const cleared = cartMessage.type === "solara-preview-cart-write";
        try {
          const parsed = JSON.parse(serialized);
          if (!Array.isArray(parsed) || (!cleared && parsed.length === 0)) return;
          previewCartStateRef.current = { key: cartMessage.key, serialized };
        } catch {
          return;
        }
        try {
          window.localStorage.setItem(cartMessage.key, serialized);
          window.localStorage.setItem(`${cartMessage.key}:backup`, serialized);
        } catch {}
        return;
      }
      if (!event.source || !previewFrameWindows.current.includes(event.source as Window)) return;
      if (message.type !== "solara-preview-assets-request" || !Array.isArray(message.paths)) return;
      const sources: Record<string, string> = {};
      message.paths.forEach((path) => {
        if (typeof path !== "string") return;
        const source = previewAssetSources.current.get(path);
        if (source) sources[path] = source;
      });
      (event.source as Window).postMessage(
        { type: "solara-preview-assets-response", sources },
        "*",
      );
    };
    window.addEventListener("message", handlePreviewAssetRequest);
    return () => window.removeEventListener("message", handlePreviewAssetRequest);
  }, [onRouteChange, project.id]);

  // El render del sitio completo es caro: agrupa los cambios rápidos (typing,
  // sliders) en una sola regeneración por ráfaga. El debounce no retrasa la
  // edición (el estado siempre está al día) y el preview queda a 150ms del
  // último cambio, imperceptible al ojo.
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      const previewSession = String(++previewRenderSessionRef.current);
      void loadExporter(renderToken)
        .then(({ getPreviewAssetSources, renderPreviewHtml }) => {
          if (!active) return;
          try {
            previewAssetSources.current = getPreviewAssetSources(project);
            activePreviewSessionRef.current = previewSession;
            setHtmlSession(previewSession);
            const cartKey = `solara-cart:${project.id}`;
            const serializedCart =
              previewCartStateRef.current?.key === cartKey
                ? previewCartStateRef.current.serialized
                : readPreviewCartState(project.id);
            setHtml(
              addPreviewNavigationBridge(
                addPreviewCartState(
                  addPreviewScrollbarPolicy(
                    renderPreviewHtml(project, "draft", route, { assetTransport: "parent" }),
                  ),
                  project.id,
                  previewSession,
                  serializedCart,
                ),
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
              reason instanceof Error
                ? reason.message
                : "No se pudo cargar el renderer de preview.",
            );
          }
        });
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timer);
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
              key={htmlSession}
              ref={attachPreviewObserver}
              title={`Vista previa ${size}`}
              srcDoc={html}
              // Electron no carga srcdoc con origen opaco; conserva su origen
              // sólo en el protocolo portable. En HTTP mantiene el sandbox
              // más restrictivo y evita el warning de Chromium.
              sandbox={previewSandbox}
              style={zoom !== 100 ? { zoom: zoom / 100 } : undefined}
              onLoad={(event) => {
                if (event.currentTarget.contentWindow) {
                  previewFrameWindows.current = [
                    ...previewFrameWindows.current.slice(-2),
                    event.currentTarget.contentWindow,
                  ];
                }
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
