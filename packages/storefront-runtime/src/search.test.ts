import { describe, expect, it } from "vitest";
import {
  levenshtein,
  matchToken,
  normalizeSearchTokens,
  type SearchEntryTokens,
  scoreEntry,
} from "./search";

const entry: SearchEntryTokens = {
  title: ["taza", "de", "ceramica"],
  brand: ["casa", "luma"],
  tags: ["casa"],
  categories: ["cocina", "favoritos"],
  description: ["taza", "para", "todos", "los", "dias"],
};

describe("normalizeSearchTokens (runtime)", () => {
  it("normaliza igual que core", () => {
    expect(normalizeSearchTokens("ÁÉÍÓÚÜÑ áéíóúüñ")).toEqual(["aeiouun", "aeiouun"]);
    expect(normalizeSearchTokens("  taza   de  ")).toEqual(["taza", "de"]);
  });
});

describe("levenshtein", () => {
  it("calcula distancias conocidas", () => {
    expect(levenshtein("taza", "taza")).toBe(0);
    expect(levenshtein("tza", "taza")).toBe(1);
    expect(levenshtein("taz", "taza")).toBe(1);
    expect(levenshtein("xazat", "taza")).toBe(2);
    expect(levenshtein("", "taza")).toBe(4);
    expect(levenshtein("remera", "remeras")).toBe(1);
  });
});

describe("matchToken", () => {
  it("distingue exacto, prefijo y substring", () => {
    expect(matchToken("taza", "taza")).toBe("exact");
    expect(matchToken("taz", "taza")).toBe("prefix");
    expect(matchToken("aza", "taza")).toBe("substring");
    expect(matchToken("taz", "taz")).toBe("exact");
  });

  it("aplica fuzzy por longitud de token", () => {
    expect(matchToken("tza", "taza")).toBe("fuzzy"); // token 4 chars, dist 1
    expect(matchToken("tzaz", "taza")).toBeNull(); // token 4 chars, dist 2 > 1
    expect(matchToken("ceramica", "ceramik")).toBe("fuzzy"); // token 7 chars, dist 2
    expect(matchToken("ceramikx", "ceramica")).toBe("fuzzy"); // token 8 chars, dist 2
    expect(matchToken("ceramixx", "ceramica")).toBe("fuzzy"); // token 8 chars, dist 2, par de ceramikx
  });

  it("no aplica fuzzy a términos o tokens cortos", () => {
    expect(matchToken("az", "taza")).toBe("substring"); // "az" es substring de "taza"; el guard sólo aplica a fuzzy
    expect(matchToken("taz", "ta")).toBeNull(); // token < 3
  });
});

describe("scoreEntry", () => {
  it("premia título exacto sobre coincidencia en descripción", () => {
    const titleHit = scoreEntry(["taza"], entry);
    const descriptionOnly = scoreEntry(["dias"], entry);
    expect(titleHit).toBeGreaterThan(descriptionOnly);
  });

  it("aplica pesos por campo y tipo", () => {
    const exactTitle = scoreEntry(["ceramica"], entry); // 10 * 3
    const prefixBrand = scoreEntry(["casa"], entry); // 7 * 2
    const substringDescription = scoreEntry(["ias"], entry); // 5 * 0.5
    expect(exactTitle).toBeGreaterThan(prefixBrand);
    expect(prefixBrand).toBeGreaterThan(substringDescription);
  });

  it("bonifica términos adicionales del mismo producto", () => {
    const oneTerm = scoreEntry(["taza"], entry);
    const twoTerms = scoreEntry(["taza", "ceramica"], entry);
    expect(twoTerms).toBeGreaterThan(oneTerm + 10 * 3); // +2 de bonus multi-término
  });

  it("devuelve 0 sin coincidencias", () => {
    expect(scoreEntry(["zzzzz", "qqqq"], entry)).toBe(0);
  });
});
