import { describe, expect, it } from "vitest";
import { normalizeSearchTokens } from "./index";

describe("normalizeSearchTokens", () => {
  it("normaliza minúsculas, acentos y diacríticos", () => {
    expect(normalizeSearchTokens("ÁÉÍÓÚÜÑ áéíóúüñ")).toEqual(["aeiouun", "aeiouun"]);
  });

  it("combina caracteres con diacríticos múltiples", () => {
    expect(normalizeSearchTokens("a\u0301 cafe\u0301")).toEqual(["a", "cafe"]);
  });

  it("separa por espacios múltiples y quita vacíos", () => {
    expect(normalizeSearchTokens("  taza   de   ceramica  ")).toEqual(["taza", "de", "ceramica"]);
  });

  it("devuelve lista vacía para entrada vacía o sin tokens", () => {
    expect(normalizeSearchTokens("")).toEqual([]);
    expect(normalizeSearchTokens("   ")).toEqual([]);
    expect(normalizeSearchTokens(undefined as unknown as string)).toEqual([]);
  });
});
