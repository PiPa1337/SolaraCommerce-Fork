#!/usr/bin/env node
import { spawn } from "node:child_process";
// e2e-stability — mide la tasa de fallo por spec corriendo playwright N veces.
// Uso:
//   node scripts/e2e-stability.mjs            # 5 corridas, specs del smoke
//   STABILITY_RUNS=3 node scripts/e2e-stability.mjs   # otra cantidad
//   node scripts/e2e-stability.mjs tests/e2e/assets.spec.ts tests/e2e/...  # specs puntuales
// Salida: tabla spec -> fallos/N + JSON en test-results/stability/ (no versionado).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const runs = Number(process.env.STABILITY_RUNS ?? 5);
if (!Number.isInteger(runs) || runs < 1 || runs > 20) {
  console.error("[stability] STABILITY_RUNS debe ser un entero entre 1 y 20");
  process.exit(1);
}

let specs = process.argv.slice(2).filter((arg) => arg.endsWith(".spec.ts"));
if (specs.length === 0) {
  // Fuente única de verdad: la lista del smoke (parseo simple y robusto)
  const smokeSource = readFileSync(resolve("scripts/e2e-smoke.mjs"), "utf8");
  specs = [...smokeSource.matchAll(/"(tests\/e2e\/[a-z0-9-]+\.spec\.ts)"/g)].map(
    (match) => match[1],
  );
}
if (specs.length === 0) {
  console.error("[stability] no se detectaron specs para correr");
  process.exit(1);
}

// Normalizador: convierte rutas mixtas de la salida de playwright a la forma
// "tests/e2e/archivo.spec.ts" para agrupar por spec contenedor.
function normalizeSpecPath(rawPath) {
  const normalized = rawPath.replaceAll("\\", "/").toLowerCase();
  // El path viene con sufijo ":linea:columna" (ubicación del test); quitarlo
  // para poder comparar contra el spec contenedor.
  const withoutLocation = normalized.replace(/:\d+:\d+$/, "");
  return specs.find((spec) => withoutLocation.endsWith(spec.toLowerCase())) ?? null;
}

console.log(`[stability] ${runs} corridas x ${specs.length} specs`);
// El historial vive en el tmp del sistema: Playwright limpia test-results/
// en cada corrida y borraria el JSON si se escribiera alla.
const historyDirectory = join(tmpdir(), "solara-e2e-stability");
mkdirSync(historyDirectory, { recursive: true });
const failuresBySpec = new Map(specs.map((spec) => [spec, 0]));
const history = [];

for (let run = 1; run <= runs; run += 1) {
  console.log(`\n[stability] ▶ corrida ${run}/${runs}`);
  let out = "";
  const code = await new Promise((resolve) => {
    const command = process.platform === "win32" ? process.execPath : "corepack";
    const args = ["pnpm", "exec", "playwright", "test", ...specs, "--workers=8"];
    const finalArgs =
      process.platform === "win32"
        ? [
            join(dirname(process.execPath), "node_modules", "corepack", "dist", "corepack.js"),
            ...args,
          ]
        : args;
    const child = spawn(command, finalArgs, {});
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      out += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      out += text;
      process.stderr.write(text);
    });
    child.on("close", resolve);
    child.on("error", () => resolve(1));
  });

  // La salida lista cada test fallado (y su retry) con: x N [chromium] › ruta › título
  // Agrupar por archivo contenedor; deduplicar retries dentro de la misma corrida.
  const failedSpecs = new Set();
  for (const match of out.matchAll(/x\s+\d+\s+\[[^\]]+\]\s+›\s+([^›]+?)\s+›/g)) {
    const spec = normalizeSpecPath(match[1].trim());
    if (spec) failedSpecs.add(spec);
  }
  for (const spec of failedSpecs) {
    failuresBySpec.set(spec, failuresBySpec.get(spec) + 1);
  }
  history.push({
    run,
    exitCode: code,
    failedSpecs: [...failedSpecs],
    at: new Date().toISOString(),
  });
  console.log(
    `[stability] ◼ corrida ${run}: ${code === 0 ? "verde" : `rojo (${failedSpecs.size} specs)`}`,
  );
}

const report = specs
  .map((spec) => ({
    spec,
    fails: failuresBySpec.get(spec),
    runs,
    ratePct: Number(((failuresBySpec.get(spec) / runs) * 100).toFixed(0)),
  }))
  .sort((a, b) => b.fails - a.fails || a.spec.localeCompare(b.spec));

console.log("\n[stability] ═══ RESULTADO ═══");
console.log("spec | fallos/corridas | %");
for (const row of report) {
  const flag = row.fails > 0 ? " ⚠" : " ✔";
  console.log(`${flag} ${row.spec} | ${row.fails}/${row.runs} | ${row.ratePct}%`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = join(historyDirectory, `stability-${stamp}.json`);
writeFileSync(outFile, JSON.stringify({ runs, specs, report, history }, null, 2));
console.log(`[stability] historial: ${outFile}`);
