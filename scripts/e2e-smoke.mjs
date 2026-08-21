import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// e2e-smoke — smoke ampliado (~2min, 15 specs) con cache de build Studio
// Valida flujos criticos sin compilar Studio si no hay cambios.
// Uso: corepack pnpm test:e2e:smoke [-- args extra para playwright]

const smokeSpecs = [
  "tests/e2e/catalog-modern-v2.spec.ts",
  "tests/e2e/exporter-sentinel.spec.ts",
  "tests/e2e/scale-store.spec.ts",
  "tests/e2e/storefront-nojs.spec.ts",
  "tests/e2e/ui-sweep-a27.spec.ts",
  "tests/e2e/ui-sweep-a28.spec.ts",
  "tests/e2e/ui-sweep-a29.spec.ts",
  "tests/e2e/ui-sweep-a30.spec.ts",
  "tests/e2e/axe-site.spec.ts",
  "tests/e2e/nojs-coverage.spec.ts",
  "tests/e2e/focus-visible.spec.ts",
  "tests/e2e/interacciones.spec.ts",
  "tests/e2e/catalog.spec.ts",
  "tests/e2e/assets.spec.ts",
  "tests/e2e/exported-store.spec.ts",
];

function maxMtimeRecursive(dir) {
  let max = 0;
  if (!existsSync(dir)) return 0;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = maxMtimeRecursive(full);
      if (sub > max) max = sub;
    } else {
      try {
        const m = statSync(full).mtimeMs;
        if (m > max) max = m;
      } catch {}
    }
  }
  return max;
}

function getSourceMaxMtime() {
  const roots = [
    resolve("apps/studio/src"),
    resolve("apps/studio/index.html"),
    resolve("apps/studio/package.json"),
    resolve("apps/studio/vite.config.ts"),
    resolve("apps/studio/vite.config.js"),
    resolve("apps/studio/tsconfig.json"),
    // Paquetes que Studio importa (cambios aqui invalidan dist)
    resolve("packages/project-schema/src"),
    resolve("packages/core/src"),
    resolve("packages/modules/src"),
    resolve("packages/exporter/src"),
    resolve("packages/storefront-runtime/src"),
    resolve("packages/module-sdk/src"),
    resolve("packages/site-optimizer/src"),
  ];
  let max = 0;
  for (const p of roots) {
    if (!existsSync(p)) continue;
    try {
      const stat = statSync(p);
      if (stat.isDirectory()) {
        const m = maxMtimeRecursive(p);
        if (m > max) max = m;
      } else {
        if (stat.mtimeMs > max) max = stat.mtimeMs;
      }
    } catch {}
  }
  // Tambien considerar public y config vite
  return max;
}

function shouldBuild() {
  const distIndex = resolve("apps/studio/dist/index.html");
  if (!existsSync(distIndex)) {
    console.log("[smoke] dist no existe -> build requerido");
    return true;
  }
  const distMtime = statSync(distIndex).mtimeMs;
  const srcMtime = getSourceMaxMtime();
  if (srcMtime === 0) {
    console.log("[smoke] no se pudo calcular mtime fuente -> build por seguridad");
    return true;
  }
  if (srcMtime > distMtime) {
    console.log(
      "[smoke] fuente mas nueva que dist (" +
        new Date(srcMtime).toLocaleTimeString() +
        " > " +
        new Date(distMtime).toLocaleTimeString() +
        ") -> build requerido",
    );
    return true;
  }
  console.log(
    "[smoke] dist vigente (dist " +
      new Date(distMtime).toLocaleTimeString() +
      " >= fuente " +
      new Date(srcMtime).toLocaleTimeString() +
      ") -> reutilizando build",
  );
  return false;
}

function spawnCmd(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: true, stdio: "inherit", ...opts });
    child.on("close", (code) => resolve(code));
    child.on("error", () => resolve(1));
  });
}

const rawArgs = process.argv.slice(2);
const isFull = rawArgs.includes("--full");
const extraArgs = rawArgs.filter((a) => a !== "--full");
const needBuild = shouldBuild();
if (needBuild) {
  console.log("[smoke] ▶ corepack pnpm --filter @solara/studio build");
  const code = await spawnCmd("corepack", ["pnpm", "--filter", "@solara/studio", "build"]);
  if (code !== 0) {
    console.error(`[smoke] ✖ build fallo con codigo ${code}`);
    process.exit(code ?? 1);
  }
  console.log("[smoke] ✔ build completo");
} else {
  console.log("[smoke] ⏭ build cacheado, saltando compilacion (ahorra ~30-60s)");
}

if (isFull) {
  console.log(
    "[smoke] --full: solo build cacheado, no ejecuta smoke specs (el caller hará playwright test completo)",
  );
  process.exit(0);
}
// Construir comando playwright con workers optimizados (8 por defecto, env override)
// y solo Chromium (smoke no necesita Firefox/WebKit)
const playwrightArgs = ["exec", "playwright", "test", ...smokeSpecs, ...extraArgs];
console.log(`[smoke] ▶ corepack pnpm ${playwrightArgs.join(" ")}`);
const code = await spawnCmd("corepack", ["pnpm", ...playwrightArgs]);
if (code !== 0) {
  console.error(`[smoke] ✖ smoke fallo con codigo ${code}`);
  process.exit(code ?? 1);
}
console.log("[smoke] ✔ smoke ampliado 15 specs paso");
