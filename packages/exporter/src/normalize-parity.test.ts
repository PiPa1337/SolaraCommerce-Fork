import { normalizeSearchTokens as coreTokens } from "@solara/core";
import { describe, expect, it } from "vitest";
// La ruta relativa es necesaria: @solara/storefront-runtime sólo exporta su
// index.ts; search.ts es un módulo interno sin exports map público.
import { normalizeSearchTokens as runtimeTokens } from "../../storefront-runtime/src/search";

const corpus = [
  "ÁÉÍÓÚÜÑ áéíóúüñ",
  "a\u0301 cafe\u0301 señor",
  "  Taza   DE   Cerámica  ",
  "campera quilted - 2026",
  "",
  "ñandú miércoles ü",
];

describe("paridad de normalización de búsqueda", () => {
  it("core y runtime producen los mismos tokens", () => {
    for (const value of corpus) {
      expect(runtimeTokens(value)).toEqual(coreTokens(value));
    }
  });
});
