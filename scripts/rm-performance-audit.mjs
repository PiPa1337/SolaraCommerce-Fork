import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const corepack = join(dirname(process.execPath), "node_modules", "corepack", "dist", "corepack.js");
const skipPortable = process.env.SOLARA_PERF_SKIP_PORTABLE === "1";

function runPnpm(args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [corepack, "pnpm", ...args], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`pnpm ${args.join(" ")} terminó con código ${code ?? 1}.`));
    });
  });
}

async function runNode(args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`node ${args.join(" ")} terminó con código ${code ?? 1}.`));
    });
  });
}

async function main() {
  let failure;
  try {
    await runPnpm(["run", "build"]);
    await runPnpm(["run", "audit:performance:rm:readonly"]);
    await runPnpm(["run", "audit:performance:rm:node"]);
    await runPnpm(["run", "audit:performance:rm:browser"]);
    const portable = resolve(
      root,
      ".release",
      "portable",
      "SolaraCommerce-Portable",
      "SolaraCommerce.exe",
    );
    if (skipPortable) {
      console.warn("[rm-performance] portable omitido por SOLARA_PERF_SKIP_PORTABLE=1");
    } else if (!existsSync(portable)) {
      throw new Error(
        "No existe el portable empaquetado; ejecutá desktop:package o usá SOLARA_PERF_SKIP_PORTABLE=1.",
      );
    } else {
      await runNode(["scripts/rm-performance-portable.mjs"]);
    }
  } catch (error) {
    failure = error;
  } finally {
    await runNode(["scripts/rm-performance-merge.mjs"]).catch((error) => {
      failure ??= error;
    });
  }
  if (failure) throw failure;
}

await main();
