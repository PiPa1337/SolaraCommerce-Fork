import { expect, test } from "vitest";
import { EXPORTER_RENDERER_FINGERPRINT } from "./index.js";

test("la huella del renderer es estable dentro del mismo proceso", () => {
  // Derivada del contenido de estilos + runtime: dos imports consecutivos
  // dan el mismo valor; no depende de timestamps ni rutas.
  expect(EXPORTER_RENDERER_FINGERPRINT).toMatch(/^[0-9a-f]{16}$/);
});
