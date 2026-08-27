import { spawnSync } from "node:child_process";
import { delimiter, dirname, join, resolve } from "node:path";

const command = process.platform === "win32" ? process.execPath : "corepack";
const commandArgs =
  process.platform === "win32"
    ? [join(dirname(process.execPath), "node_modules", "corepack", "dist", "corepack.js")]
    : [];
const workspaceNodePath = resolve("node_modules/.pnpm/node_modules");

if (!process.versions.node.startsWith("22.")) {
  console.error(`El release candidate requiere Node 22; se detectó ${process.version}.`);
  process.exit(1);
}

function run(args) {
  const result = spawnSync(command, [...commandArgs, ...args], {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_PATH: [workspaceNodePath, process.env.NODE_PATH].filter(Boolean).join(delimiter),
      PLAYWRIGHT_MULTI_BROWSER: "1",
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.env.SOLARA_SKIP_E2E_BUILD !== "1") {
  run(["pnpm", "--filter", "@solara/studio", "build"]);
}
const playwrightCli = resolve("node_modules/@playwright/test/cli.js");
const result = spawnSync(process.execPath, [playwrightCli, "test"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_PATH: [workspaceNodePath, process.env.NODE_PATH].filter(Boolean).join(delimiter),
    PLAYWRIGHT_MULTI_BROWSER: "1",
  },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
