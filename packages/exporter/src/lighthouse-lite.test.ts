import { describe, expect, it } from "vitest";
import { runLighthouseLite } from "./lighthouse-lite.js";

describe("lighthouse lite", () => {
  it("score alto para HTML bien formado", () => {
    const html = [
      "<!doctype html><html lang='es-AR'><head>",
      "<title>Test | Marca</title>",
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      '<meta name="description" content="Descripcion larga suficiente para pasar el check de entre setenta y ciento sesenta caracteres.">',
      '<link rel="canonical" href="https://example.com/">',
      '<meta name="robots" content="index,follow">',
      '<meta property="og:title" content="T"><meta property="og:description" content="D"><meta property="og:image" content="i">',
      "</head><body><h1>Titulo</h1></body></html>",
    ].join("");
    const result = runLighthouseLite(html);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("score bajo para HTML vacio", () => {
    const result = runLighthouseLite("<html><body></body></html>");
    expect(result.score).toBeLessThan(50);
  });
});
