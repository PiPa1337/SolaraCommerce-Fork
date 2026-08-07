/**
 * Matcher de búsqueda puro del storefront. Cada función es autocontenida:
 * el runtime público se serializa concatenando su fuente (ver
 * STOREFRONT_RUNTIME_JS en index.ts), por lo que NO deben importar nada.
 */

/** Copia del runtime; mantener en paridad con @solara/core (test en exporter). */
export function normalizeSearchTokens(value: string): string[] {
  return String(value ?? "")
    .toLocaleLowerCase("es-AR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (longer.length - shorter.length > 2) return longer.length;
  const previous = Array.from({ length: shorter.length + 1 }, (_, index) => index);
  const current = new Array<number>(shorter.length + 1);
  for (let i = 1; i <= longer.length; i++) {
    current[0] = i;
    for (let j = 1; j <= shorter.length; j++) {
      const cost = longer[i - 1] === shorter[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] as number) + 1,
        (previous[j] as number) + 1,
        (previous[j - 1] as number) + cost,
      );
    }
    for (let j = 0; j <= shorter.length; j++) previous[j] = current[j] as number;
  }
  return current[shorter.length] as number;
}

export type TokenMatch = "exact" | "prefix" | "substring" | "fuzzy" | null;

export function matchToken(term: string, token: string): TokenMatch {
  // Función autocontenida a propósito: el runtime público se serializa con
  // fn.toString() (STOREFRONT_RUNTIME_JS) y esbuild renombra las referencias
  // cruzadas al minificar, dejando nombres mangled sin enlazar en el string
  // serializado. `distance` es una copia privada del algoritmo de levenshtein.
  const distance = (a: string, b: string): number => {
    if (a === b) return 0;
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    if (longer.length - shorter.length > 2) return longer.length;
    const previous = Array.from({ length: shorter.length + 1 }, (_, index) => index);
    const current = new Array<number>(shorter.length + 1);
    for (let i = 1; i <= longer.length; i++) {
      current[0] = i;
      for (let j = 1; j <= shorter.length; j++) {
        const cost = longer[i - 1] === shorter[j - 1] ? 0 : 1;
        current[j] = Math.min(
          (current[j - 1] as number) + 1,
          (previous[j] as number) + 1,
          (previous[j - 1] as number) + cost,
        );
      }
      for (let j = 0; j <= shorter.length; j++) previous[j] = current[j] as number;
    }
    return current[shorter.length] as number;
  };

  if (term === token) return "exact";
  if (token.startsWith(term)) return "prefix";
  if (token.includes(term)) return "substring";
  if (term.length < 3 || token.length < 3) return null;
  const limit = token.length <= 4 ? 1 : 2;
  return distance(term, token) <= limit ? "fuzzy" : null;
}

export interface SearchEntryTokens {
  title: string[];
  brand: string[];
  tags: string[];
  categories: string[];
  description: string[];
}

export function scoreEntry(queryTerms: readonly string[], entry: SearchEntryTokens): number {
  // Copias privadas autocontenidas (distance + match) por el mismo motivo que
  // en matchToken: el runtime público serializa fn.toString() y esbuild
  // renombraría las referencias a levenshtein/matchToken al minificar.
  // Los límites fuzzy deben ser idénticos a matchToken: token/term < 3 → null;
  // token <= 4 → límite 1, si no → límite 2.
  const distance = (a: string, b: string): number => {
    if (a === b) return 0;
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    if (longer.length - shorter.length > 2) return longer.length;
    const previous = Array.from({ length: shorter.length + 1 }, (_, index) => index);
    const current = new Array<number>(shorter.length + 1);
    for (let i = 1; i <= longer.length; i++) {
      current[0] = i;
      for (let j = 1; j <= shorter.length; j++) {
        const cost = longer[i - 1] === shorter[j - 1] ? 0 : 1;
        current[j] = Math.min(
          (current[j - 1] as number) + 1,
          (previous[j] as number) + 1,
          (previous[j - 1] as number) + cost,
        );
      }
      for (let j = 0; j <= shorter.length; j++) previous[j] = current[j] as number;
    }
    return current[shorter.length] as number;
  };
  const match = (term: string, token: string): TokenMatch => {
    if (term === token) return "exact";
    if (token.startsWith(term)) return "prefix";
    if (token.includes(term)) return "substring";
    if (term.length < 3 || token.length < 3) return null;
    const limit = token.length <= 4 ? 1 : 2;
    return distance(term, token) <= limit ? "fuzzy" : null;
  };
  // Estos pesos deben permanecer dentro de la función: el runtime público
  // serializa el fuente de las funciones y no incluiría las consts de módulo.
  const MATCH_WEIGHT: Record<Exclude<TokenMatch, null>, number> = {
    exact: 10,
    prefix: 7,
    substring: 5,
    fuzzy: 3,
  };
  const FIELD_WEIGHT: Record<keyof SearchEntryTokens, number> = {
    title: 3,
    brand: 2,
    tags: 1.5,
    categories: 1,
    description: 0.5,
  };
  let total = 0;
  let matchedTerms = 0;
  for (const term of queryTerms) {
    let termScore = 0;
    for (const field of Object.keys(entry) as (keyof SearchEntryTokens)[]) {
      let best: TokenMatch = null;
      for (const token of entry[field] ?? []) {
        const m = match(term, token);
        if (m !== null && (best === null || MATCH_WEIGHT[m] > MATCH_WEIGHT[best])) {
          best = m;
        }
      }
      if (best !== null) termScore = Math.max(termScore, MATCH_WEIGHT[best] * FIELD_WEIGHT[field]);
    }
    if (termScore > 0) {
      total += termScore;
      matchedTerms += 1;
    }
  }
  if (matchedTerms > 1) total += (matchedTerms - 1) * 2;
  return total;
}
