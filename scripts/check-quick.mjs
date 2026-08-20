import { execSync, spawn } from "node:child_process";

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
const tasks = [
  { name: "check:repository", cmd: "corepack pnpm check:repository" },
  { name: "check:hardcoded-content", cmd: "corepack pnpm check:hardcoded-content" },
  { name: "format:check", cmd: "corepack pnpm format:check" },
  { name: "typecheck", cmd: "corepack pnpm -r --parallel --if-present typecheck" },
  { name: "test", cmd: "corepack pnpm -r --parallel --if-present test" },
  { name: "check:optimization", cmd: "corepack pnpm check:optimization" },
  { name: "check:runtime-serialization", cmd: "corepack pnpm check:runtime-serialization" },
];

function runTask(task) {
  return new Promise((resolve) => {
    const start = Date.now();
    console.log(`[34m[quick][0m \u25B6 ${task.name}`);
    const isRuntime = task.name === "check:runtime-serialization" && SUBST_DRIVE;
    const cwd = isRuntime ? `${SUBST_DRIVE}\\` : undefined;
    const child = spawn(task.cmd, { shell: true, stdio: "inherit", cwd });
    child.on("close", (code) => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`[32m[quick][0m \u2714 ${task.name} (${elapsed}s)`);
        resolve({ name: task.name, ok: true });
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
console.log(`[quick] Iniciando ${tasks.length} gates en paralelo (9800X3D optimizado)...`);
const results = await Promise.all(tasks.map(runTask));
const total = ((Date.now() - startAll) / 1000).toFixed(1);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n[quick] \u2716 ${failed.length}/${results.length} gates fallaron en ${total}s:`);
  for (const f of failed) console.error(`  - ${f.name}`);
  process.exit(1);
} else {
  console.log(`\n[quick] \u2714 Todos los ${results.length} gates pasaron en ${total}s`);
}
