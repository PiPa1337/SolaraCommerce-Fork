// build-runtime — genera el bundle externo + source map del storefront runtime
// para el modo draft (debuggeable). Production sigue usando el inline serializado.

import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "dist");
mkdirSync(outDir, { recursive: true });

const entry = resolve(here, "..", "src", "entry-draft.ts");

await build({
  entryPoints: [entry],
  absWorkingDir: here,
  outfile: resolve(outDir, "storefront-runtime.js"),
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: false,
  sourcemap: true,
  legalComments: "none",
});

const js = readFileSync(resolve(outDir, "storefront-runtime.js"), "utf8");
console.log("[build-runtime] OK " + js.length + " bytes");
