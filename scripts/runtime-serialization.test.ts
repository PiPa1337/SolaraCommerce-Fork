import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { expect, test } from "vitest";
import type { SearchEntryTokens } from "../packages/storefront-runtime/src/search";

/**
 * Regresión del runtime serializado: el Studio en producción bundlea
 * `packages/storefront-runtime/src/index.ts` con esbuild (minify), y
 * `STOREFRONT_RUNTIME_JS` se construye concatenando `fn.toString()` de los
 * helpers de búsqueda. Cuando los helpers se referencian entre sí, esbuild
 * renombra esas referencias en el bundle (ej. `matchToken` llama a
 * `levenshtein` con su nombre mangled), pero el string serializado sólo
 * contiene el cuerpo con el nombre mangled — que no existe en el contexto de
 * evaluación del sitio público → ReferenceError. Este test bundlea los
 * helpers exactamente como el bundle de producción y verifica que el string
 * resultante evalúa y ejecuta en ambos modos (minify y sin minify).
 */

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

const PROBE_ENTRY = `import {
  levenshtein,
  matchToken,
  normalizeSearchTokens,
  scoreEntry,
} from "./packages/storefront-runtime/src/search";

globalThis.__probeHelpers = [
  ["normalizeSearchTokens", normalizeSearchTokens],
  ["levenshtein", levenshtein],
  ["matchToken", matchToken],
  ["scoreEntry", scoreEntry],
];`;

const HELPER_NAMES = ["normalizeSearchTokens", "levenshtein", "matchToken", "scoreEntry"] as const;

function boot(): void {
  const score = scoreEntry(["taza"], {
    title: ["taza", "de", "ceramica"],
    brand: [],
    tags: [],
    categories: [],
    description: [],
  });
  if (typeof score !== "number" || score <= 0) {
    throw new Error("scoreEntry no devuelve un puntaje valido en el runtime serializado");
  }
  if (matchToken("tza", "taza") !== "fuzzy") {
    throw new Error("matchToken no aplica fuzzy en el runtime serializado");
  }
}

type SerializedHelper = [string, (...args: never[]) => unknown];

async function serializeHelpers(minify: boolean) {
  const result = await build({
    stdin: {
      contents: PROBE_ENTRY,
      sourcefile: "probe.ts",
      loader: "ts",
      resolveDir: REPO_ROOT,
    },
    bundle: true,
    minify,
    format: "iife",
    write: false,
  });
  const sandbox: Record<string, unknown> = {};
  const loadBundle = new Function(
    "globalThis",
    `${result.outputFiles?.[0]?.text ?? ""}
return globalThis.__probeHelpers;`,
  );
  const helpers = (loadBundle(sandbox) ?? []) as SerializedHelper[];
  expect(helpers.map(([name]) => name)).toEqual([...HELPER_NAMES]);
  return helpers;
}

function evaluateRuntime(helpers: SerializedHelper[]) {
  const runtime = `${helpers.map(([name, fn]) => `const ${name} = ${fn.toString()};`).join("\n")}
globalThis.__solaraSearchHelpers = { ${helpers.map(([name]) => name).join(", ")} };
(${boot.toString()})();`;
  const sandbox: Record<string, unknown> = {};
  new Function("globalThis", runtime)(sandbox);
  const api = sandbox.__solaraSearchHelpers as {
    scoreEntry: (terms: readonly string[], entry: SearchEntryTokens) => number;
    matchToken: (term: string, token: string) => "exact" | "prefix" | "substring" | "fuzzy" | null;
  };
  const entry: SearchEntryTokens = {
    title: ["taza", "de", "ceramica"],
    brand: [],
    tags: [],
    categories: [],
    description: [],
  };
  expect(api.matchToken("tza", "taza")).toBe("fuzzy");
  expect(api.scoreEntry(["taza"], entry)).toBeGreaterThan(0);
}

test("el runtime serializado funciona bundleado con minify (modo producción)", async () => {
  await evaluateRuntime(await serializeHelpers(true));
});

test("el runtime serializado funciona bundleado sin minify", async () => {
  await evaluateRuntime(await serializeHelpers(false));
});
