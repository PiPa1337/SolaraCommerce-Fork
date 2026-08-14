import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { expect, test } from "vitest";
import type { SearchEntryTokens } from "../packages/storefront-runtime/src/search";

/**
 * Regresión del runtime serializado: el Studio en producción bundlea
 * `packages/storefront-runtime/src/index.ts` con esbuild (minify), y
 * `STOREFRONT_RUNTIME_JS` se construye concatenando `fn.toString()` de los
 * helpers de búsqueda. Esbuild puede renombrar bindings durante el bundle, por
 * lo que cada helper debe seguir siendo autocontenido y exponerse bajo un
 * nombre canónico. Este test reproduce el bundle de producción y verifica que
 * el string resultante evalúa y ejecuta con minify y sin minify.
 */

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const PROBE_ENTRY = `import {
  levenshtein,
  normalizeSearchTokens,
  scoreEntry,
} from "./packages/storefront-runtime/src/search";

globalThis.__probeHelpers = [
  ["normalizeSearchTokens", normalizeSearchTokens],
  ["levenshtein", levenshtein],
  ["scoreEntry", scoreEntry],
];`;

const HELPER_NAMES = ["normalizeSearchTokens", "levenshtein", "scoreEntry"] as const;

const FULL_RUNTIME_ENTRY = `import { STOREFRONT_RUNTIME_JS } from "./packages/storefront-runtime/src/index";
globalThis.__serializedRuntime = STOREFRONT_RUNTIME_JS;`;

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

async function serializeFullRuntime() {
  const result = await build({
    stdin: {
      contents: FULL_RUNTIME_ENTRY,
      sourcefile: "full-runtime-probe.ts",
      loader: "ts",
      resolveDir: REPO_ROOT,
    },
    bundle: true,
    minify: true,
    format: "iife",
    write: false,
  });
  const sandbox: Record<string, unknown> = {};
  const loadBundle = new Function(
    "globalThis",
    `${result.outputFiles?.[0]?.text ?? ""}
return globalThis.__serializedRuntime;`,
  );
  return loadBundle(sandbox) as string;
}

function evaluateRuntime(helpers: SerializedHelper[]) {
  const runtime = `${helpers.map(([name, fn]) => `const ${name} = ${fn.toString()};`).join("\n")}
globalThis.__solaraSearchHelpers = { ${helpers.map(([name]) => name).join(", ")} };
(${boot.toString()})();`;
  const sandbox: Record<string, unknown> = {};
  new Function("globalThis", runtime)(sandbox);
  const api = sandbox.__solaraSearchHelpers as {
    scoreEntry: (terms: readonly string[], entry: SearchEntryTokens) => number;
  };
  const entry: SearchEntryTokens = {
    title: ["taza", "de", "ceramica"],
    brand: [],
    tags: [],
    categories: [],
    description: [],
  };
  expect(api.scoreEntry(["taza"], entry)).toBeGreaterThan(0);
}

test("el runtime serializado funciona bundleado con minify (modo producción)", async () => {
  await evaluateRuntime(await serializeHelpers(true));
});

test("el runtime serializado funciona bundleado sin minify", async () => {
  await evaluateRuntime(await serializeHelpers(false));
});

test("el runtime completo conserva los bindings de carrito al bundlear con minify", async () => {
  const runtime = await serializeFullRuntime();
  const parseCartDeclaration = runtime.match(
    /const ([A-Za-z_$][\w$]*) = function ([A-Za-z_$][\w$]*)\(a\)\{return Array\.isArray\(a\)\?/,
  );
  const reconcileCartDeclaration = runtime.match(
    /const ([A-Za-z_$][\w$]*) = function ([A-Za-z_$][\w$]*)\(a,e\)\{const/,
  );

  expect(parseCartDeclaration?.[1]).toBe(parseCartDeclaration?.[2]);
  expect(reconcileCartDeclaration?.[1]).toBe(reconcileCartDeclaration?.[2]);
});
