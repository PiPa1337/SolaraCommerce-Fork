import { describe, expect, it } from "vitest";
import { imageMimeTypeFromSource, parseDataUrl } from "./assets";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("parseDataUrl", () => {
  it("decodifica base64 canónico a los bytes correctos", () => {
    const parsed = parseDataUrl("data:text/plain;base64,aGVsbG8=");
    expect(parsed?.mimeType).toBe("text/plain");
    expect(new TextDecoder().decode(parsed?.bytes)).toBe("hello");
  });

  it("tolera whitespace dentro del payload base64", () => {
    const parsed = parseDataUrl("data:text/plain;base64,aGVs\nbG8=\n");
    expect(new TextDecoder().decode(parsed?.bytes)).toBe("hello");
  });

  it("percent-decodea payloads no base64", () => {
    const parsed = parseDataUrl("data:image/svg+xml,%3Csvg/%3E");
    expect(new TextDecoder().decode(parsed?.bytes)).toBe("<svg/>");
  });

  it("rechaza base64 inválido", () => {
    expect(parseDataUrl("data:image/png;base64,!!!")).toBeUndefined();
    expect(parseDataUrl("data:image/png;base64,AAAAA")).toBeUndefined();
  });

  it("rechaza payloads sin coma de header", () => {
    expect(parseDataUrl("data:image/png")).toBeUndefined();
  });

  it("memoiza: la misma fuente devuelve el mismo objeto decodificado", () => {
    const first = parseDataUrl(PNG_1PX);
    const second = parseDataUrl(PNG_1PX);
    expect(second).toBe(first);
  });

  it("memoiza también los resultados inválidos", () => {
    const first = parseDataUrl("data:image/png;base64,!!!");
    const second = parseDataUrl("data:image/png;base64,!!!");
    expect(second).toBe(first);
  });

  it("no confunde fuentes distintas con el mismo prefijo", () => {
    const a = parseDataUrl("data:text/plain;base64,aGVsbG8=");
    const b = parseDataUrl("data:text/plain;base64,aGVsbG8h");
    expect(a).not.toBe(b);
    expect(a?.bytes.byteLength).toBe(5);
    expect(b?.bytes.byteLength).toBe(6);
  });

  it("imageMimeTypeFromSource deduce el MIME de los bytes reales", () => {
    expect(imageMimeTypeFromSource(PNG_1PX, "image/jpeg")).toBe("image/png");
  });
});
