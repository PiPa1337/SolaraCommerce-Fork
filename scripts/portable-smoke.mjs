/** Smoke test determinista para una carpeta portable ya empaquetada. */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = resolve(root, ".release/portable/SolaraCommerce-Portable");
const executable = join(source, "SolaraCommerce.exe");
if (!existsSync(executable)) throw new Error("No existe la distribución portable para probar.");

const testRoot = mkdtempSync(join(tmpdir(), "solara-portable-smoke-"));
const copies = [
  join(testRoot, "Copia A con espacios - á"),
  join(testRoot, "Copia B con espacios - β"),
];

async function cleanupTestRoot(path) {
  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await rm(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError;
}

try {
  await Promise.all(
    copies.map(async (copy) => {
      await cp(source, copy, { recursive: true });
      // El paquete puede conservar estado de una ejecución local; cada copia
      // debe probar un perfil y proyectos realmente aislados.
      await Promise.all([
        rm(join(copy, ".solara-runtime"), {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 250,
        }),
        rm(join(copy, "proyectos"), {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 250,
        }),
      ]);
    }),
  );
  const children = copies.map((copy) => {
    // El smoke no valida la composición GPU. Forzar rasterizado software evita
    // que una DLL gráfica ausente en el runner mate el proceso antes del test.
    const child = spawn(
      join(copy, "SolaraCommerce.exe"),
      ["--solara-smoke", "--disable-gpu", "--disable-gpu-compositing", "--in-process-gpu"],
      {
        cwd: copy,
        env: { ...process.env, SOLARA_PORTABLE_SMOKE: "1" },
        stdio: "ignore",
        windowsHide: true,
      },
    );
    return new Promise((resolveExit, reject) => {
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("Una copia portable no finalizó el smoke test a tiempo."));
      }, 20_000);
      child.once("error", reject);
      child.once("exit", (code) => {
        clearTimeout(timer);
        resolveExit(code ?? 1);
      });
    });
  });
  const exitCodes = await Promise.all(children);
  if (exitCodes.some((code) => code !== 0)) {
    throw new Error(`Una copia portable terminó con códigos ${exitCodes.join(", ")}.`);
  }
  for (const copy of copies) {
    const instance = join(copy, ".solara-runtime", "instance.json");
    if (!existsSync(instance)) throw new Error("El smoke test no creó instance.json.");
    const parsed = JSON.parse(readFileSync(instance, "utf8"));
    if (parsed.format !== "solara-portable-instance" || parsed.layoutVersion !== 1) {
      throw new Error("instance.json no tiene el contrato portable esperado.");
    }
    if (!existsSync(join(copy, "proyectos")))
      throw new Error("La copia no tiene proyectos aislados.");
  }
  if (
    join(copies[0], ".solara-runtime", "electron-user-data") ===
    join(copies[1], ".solara-runtime", "electron-user-data")
  ) {
    throw new Error("Las copias portable comparten perfil.");
  }
  console.log("portable smoke: OK");
} finally {
  // Electron puede conservar brevemente un handle de la copia Unicode tras
  // emitir `exit`; los reintentos evitan que esa ventana oculte un smoke válido.
  await cleanupTestRoot(testRoot);
}
