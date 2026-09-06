import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

const [requestedMode = "functional", ...playwrightArgs] = process.argv.slice(2);
const allowedModes = new Set(["functional", "audit", "all"]);
if (!allowedModes.has(requestedMode)) {
  console.error(`Modo E2E inválido: ${requestedMode}. Use functional, audit o all.`);
  process.exit(1);
}

const command = process.platform === "win32" ? process.execPath : "corepack";
const commandArgs =
  process.platform === "win32"
    ? [join(dirname(process.execPath), "node_modules", "corepack", "dist", "corepack.js")]
    : [];
const result = spawnSync(
  command,
  [...commandArgs, "pnpm", "exec", "playwright", "test", ...playwrightArgs],
  {
    stdio: "inherit",
    env: { ...process.env, SOLARA_E2E_MODE: requestedMode },
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
