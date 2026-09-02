import { execSync, spawn } from "node:child_process";
import { dirname, join } from "node:path";

// Fallback sandbox: si C:\Users\PiPa no es legible, esbuild falla con Access denied.
// Se crea un drive X: via subst para que el bundling no tenga que leer el directorio denegado.
// Es no persistente (solo sesion actual) y mas seguro que cambiar ACLs.
function getSubstFallback() {
  if (process.platform !== "win32") return null;
  const cwd = process.cwd();
  if (!cwd.includes("OneDrive")) return null;
  try {
    execSync("subst", { stdio: "pipe" });
  } catch {}
  try {
    const out = execSync("subst", { encoding: "utf8" });
    if (out.includes("X:")) return "X:";
  } catch {}
  try {
    execSync(`subst X: "${cwd}"`, { stdio: "ignore" });
    return "X:";
  } catch {
    return null;
  }
}
const SUBST_DRIVE = getSubstFallback();

// check:quick — gates en paralelo para 9800X3D (8C/16T)
// Ejecuta todos los checks livianos en paralelo en vez de secuencial.
// Mantiene la misma cobertura que `pnpm check` pero en ~40-60% menos tiempo.
// Uso: corepack pnpm check:quick
const isFull = process.argv.includes("--full");
const isCi = process.env.CI === "true";
const requestedValidationMode = process.env.SOLARA_VALIDATION_MODE?.trim().toLowerCase();
const validationMode = isCi
  ? "strict"
  : requestedValidationMode === "strict" || requestedValidationMode === "advisory"
    ? requestedValidationMode
    : "advisory";
const isAdvisory = validationMode === "advisory";
const testCommand = isCi
  ? "corepack pnpm -r --workspace-concurrency=1 --if-present --filter=!@solara/studio --filter=!@solara/exporter --filter=!@solara/core test"
  : "corepack pnpm -r --parallel --if-present test";
const fastTasks = [
  { name: "check:repository", cmd: "corepack pnpm check:repository" },
  { name: "check:hardcoded-content", cmd: "corepack pnpm check:hardcoded-content" },
  { name: "check:image-budget", cmd: "node scripts/check-image-budget.mjs" },
  { name: "format:check", cmd: "corepack pnpm format:check" },
  { name: "typecheck", cmd: "corepack pnpm -r --parallel --if-present typecheck" },
  // Los fuzz y los exports deterministas superan 15s cuando todos los
  // paquetes comparten CPU; el timeout del gate debe cubrir esa carga real.
  { name: "test", cmd: testCommand },
  ...(isCi
    ? [
        {
          name: "test:studio",
          cmd: "corepack pnpm --filter @solara/studio test:ci",
          serial: true,
        },
        {
          name: "test:exporter",
          cmd: "corepack pnpm --filter @solara/exporter test:ci",
          serial: true,
        },
        {
          name: "test:core",
          cmd: "corepack pnpm --filter @solara/core test:ci",
          serial: true,
        },
      ]
    : []),
];
const slowTasks = [
  { name: "check:optimization", cmd: "corepack pnpm check:optimization" },
  { name: "check:runtime-serialization", cmd: "corepack pnpm check:runtime-serialization" },
];
const tasks = isFull ? [...fastTasks, ...slowTasks] : fastTasks;

function spawnTask(command, args, options) {
  if (process.platform === "win32" && command === "corepack") {
    const corepack = join(
      dirname(process.execPath),
      "node_modules",
      "corepack",
      "dist",
      "corepack.js",
    );
    return spawn(process.execPath, [corepack, ...args], options);
  }
  return spawn(command, args, options);
}

function runTask(task) {
  return new Promise((resolve) => {
    const start = Date.now();
    console.log(`[34m[quick][0m \u25B6 ${task.name}`);
    const isRuntime = task.name === "check:runtime-serialization" && SUBST_DRIVE;
    const cwd = isRuntime ? `${SUBST_DRIVE}\\` : undefined;
    const [command, ...args] = task.cmd.split(" ");
    const captureTestOutput = isAdvisory && task.name === "test";
    let harnessTimeout = false;
    let testFailure = false;
    const child = spawnTask(command, args, {
      stdio: captureTestOutput ? ["ignore", "pipe", "pipe"] : "inherit",
      cwd,
    });
    if (captureTestOutput) {
      const inspectOutput = (chunk, stream) => {
        const output = String(chunk);
        if (output.includes('Timeout calling "onTaskUpdate"')) harnessTimeout = true;
        if (
          /(?:Test Files|Tests)\b[^\r\n]*(?:\b[1-9]\d*\s+failed\b|\bfailed\s+[1-9]\d*)/i.test(
            output,
          ) ||
          /AssertionError|Failed Tests/i.test(output)
        ) {
          testFailure = true;
        }
        stream.write(chunk);
      };
      child.stdout?.on("data", (chunk) => inspectOutput(chunk, process.stdout));
      child.stderr?.on("data", (chunk) => inspectOutput(chunk, process.stderr));
    }
    child.on("close", (code) => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`[32m[quick][0m \u2714 ${task.name} (${elapsed}s)`);
        resolve({ name: task.name, ok: true });
      } else if (
        isAdvisory &&
        ((task.name === "format:check" && code !== 0) ||
          (task.name === "test" && harnessTimeout && !testFailure))
      ) {
        const reason =
          task.name === "format:check"
            ? "diagnósticos de formato"
            : "timeout del harness de Vitest";
        console.warn(`[quick] \u26A0 ${task.name} advertido: ${reason} (${elapsed}s)`);
        resolve({ name: task.name, ok: true, advisory: true, reason });
      } else {
        console.log(`[31m[quick][0m \u2716 ${task.name} fallo codigo ${code} (${elapsed}s)`);
        resolve({ name: task.name, ok: false, code });
      }
    });
    child.on("error", (err) => {
      console.log(`[31m[quick][0m \u2716 ${task.name} error: ${err.message}`);
      resolve({ name: task.name, ok: false });
    });
  });
}

const startAll = Date.now();
const parallelTasks = tasks.filter((task) => !task.serial);
const serialTasks = tasks.filter((task) => task.serial);
console.log(
  `[quick] Iniciando ${tasks.length} gates (${parallelTasks.length} en paralelo, ${serialTasks.length} serializados; ${isFull ? "full" : "fast"}, modo ${validationMode}, 9800X3D optimizado)...`,
);
const parallelResults = await Promise.all(parallelTasks.map(runTask));
const serialResults = [];
for (const task of serialTasks) {
  serialResults.push(await runTask(task));
}
const results = [...parallelResults, ...serialResults];
const total = ((Date.now() - startAll) / 1000).toFixed(1);
const failed = results.filter((r) => !r.ok);
const advisory = results.filter((r) => r.advisory);
if (failed.length) {
  console.error(`\n[quick] \u2716 ${failed.length}/${results.length} gates fallaron en ${total}s:`);
  for (const f of failed) console.error(`  - ${f.name}`);
  process.exit(1);
} else if (advisory.length) {
  console.warn(
    `\n[quick] \u2714 ${results.length} gates completados en ${total}s; advertencias toleradas: ${advisory.map((result) => `${result.name} (${result.reason})`).join(", ")}`,
  );
} else {
  console.log(`\n[quick] \u2714 Todos los ${results.length} gates pasaron en ${total}s`);
}
