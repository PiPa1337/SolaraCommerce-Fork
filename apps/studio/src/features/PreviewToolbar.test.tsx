import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PreviewToolbar } from "./Preview";

const routes = [{ path: "/", label: "Inicio" }];

function renderToolbar(desktopDisabled = false) {
  return renderToStaticMarkup(
    <PreviewToolbar
      routes={routes}
      route="/"
      size="tablet"
      zoom={100}
      desktopDisabled={desktopDisabled}
      onRouteChange={() => undefined}
      onSizeChange={() => undefined}
      onZoomChange={() => undefined}
      onOpenEditor={() => undefined}
    />,
  );
}

describe("selector de tamaño del Preview", () => {
  it("bloquea escritorio y explica el motivo mientras el panel lateral está abierto", () => {
    const markup = renderToolbar(true);
    const desktopButton = markup.match(/<button[^>]*aria-label="Vista de escritorio"[^>]*>/)?.[0];

    expect(desktopButton).toContain("disabled");
    expect(markup).toContain("Vista de escritorio no disponible mientras el panel está abierto");
  });

  it("mantiene disponible escritorio cuando no hay panel lateral", () => {
    const markup = renderToolbar();
    const desktopButton = markup.match(/<button[^>]*aria-label="Vista de escritorio"[^>]*>/)?.[0];

    expect(desktopButton).not.toContain("disabled");
    expect(markup).toContain('data-tip="Vista de escritorio"');
  });
});
