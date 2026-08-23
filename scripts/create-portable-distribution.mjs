/**
 * Convierte el directorio `win-unpacked` de electron-builder en una carpeta
 * portable estable. Sólo copia datos de `proyectos/` si ya existen; los builds
 * y el runtime permanecen fuera del repositorio gracias a `.gitignore`.
 *
 * Preserva el estado del portable anterior: las tiendas guardadas por la app
 * (versión de manifest más nueva que la del repo) y `.solara-runtime/` se
 * conservan a través de cada rebuild. Así un `desktop:package` nunca vuelve a
 * perder guardados del usuario.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const unpacked = resolve(root, ".release/portable/build/win-unpacked");
const destination = resolve(root, ".release/portable/SolaraCommerce-Portable");

/** Inspecciona una tienda sin confiar sólo en la versión declarada. */
async function inspectStore(storeDir) {
  const root = resolve(storeDir);
  const result = { exists: existsSync(root), healthy: false, version: 0, savedAt: 0 };
  if (!result.exists) return result;
  try {
    const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
    const version = Number(manifest.current?.version) || 0;
    const projectPath = manifest.current?.projectPath;
    const currentPath = typeof projectPath === "string" ? resolve(root, projectPath) : "";
    const inside =
      currentPath === root ||
      currentPath.startsWith(`${root}${process.platform === "win32" ? "\\" : "/"}`);
    if (!inside || !currentPath) return { ...result, version };
    const currentBytes = await readFile(currentPath);
    const actualHash = createHash("sha256").update(currentBytes).digest("hex");
    const healthy =
      manifest.format === "solara-local-project" &&
      manifest.manifestVersion === 2 &&
      actualHash === manifest.current?.sha256;
    return {
      exists: true,
      healthy,
      version,
      savedAt: Date.parse(manifest.current?.savedAt ?? "") || 0,
    };
  } catch {
    return result;
  }
}

/**
 * Decide si la copia preservada del portable debe ganarle a la del repo:
 * gana cuando el portable tiene una versión de guardado más nueva.
 */
export async function shouldKeepPortableStore(preservedStore, repoStore) {
  if (!existsSync(preservedStore)) return false;
  if (!existsSync(repoStore)) return true;
  const [preserved, repo] = await Promise.all([
    inspectStore(preservedStore),
    inspectStore(repoStore),
  ]);
  if (preserved.healthy !== repo.healthy) return preserved.healthy;
  if (preserved.version !== repo.version) return preserved.version > repo.version;
  if (preserved.healthy && preserved.savedAt !== repo.savedAt) {
    return preserved.savedAt > repo.savedAt;
  }
  // Si ambos estados sanos empatan, el portable ya es la copia que el usuario
  // estaba usando. Los manifests mínimos de tests o estados no verificables
  // conservan la política anterior: el repo gana en empate.
  return preserved.healthy;
}

/**
 * OneDrive puede bloquear un rename entre volúmenes o durante una
 * sincronización aunque la carpeta se pueda copiar. La copia conserva el
 * respaldo y permite que el rebuild continúe sin descartar el estado portable.
 */
export async function preserveDirectory(source, destinationPath) {
  try {
    await rename(source, destinationPath);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (!["EPERM", "EXDEV", "EBUSY"].includes(code)) throw error;
    await cp(source, destinationPath, { recursive: true });
  }
}

function isTransientDirectoryLock(error) {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return ["EBUSY", "EPERM", "EXDEV"].includes(code);
}

/** Reemplaza una carpeta o actualiza su contenido si Windows bloquea un borrado. */
async function replaceDirectory(source, destinationPath) {
  try {
    await rm(destinationPath, { recursive: true, force: true });
    await cp(source, destinationPath, { recursive: true });
    return false;
  } catch (error) {
    if (!isTransientDirectoryLock(error)) throw error;
    await mkdir(destinationPath, { recursive: true });
    await cp(source, destinationPath, { recursive: true, force: true });
    return true;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!existsSync(join(unpacked, "SolaraCommerce.exe"))) {
    throw new Error(
      "No se encontró win-unpacked/SolaraCommerce.exe. Ejecutá desktop:package primero.",
    );
  }

  // 1. Preservar el estado del portable actual (proyectos + runtime).
  const backupDir = await mkdtemp(join(tmpdir(), "solara-portable-state-"));
  const preservedProyectos = join(backupDir, "proyectos");
  const preservedRuntime = join(backupDir, "solara-runtime");
  if (existsSync(destination)) {
    if (existsSync(join(destination, "proyectos"))) {
      await preserveDirectory(join(destination, "proyectos"), preservedProyectos);
    }
    if (existsSync(join(destination, ".solara-runtime"))) {
      await preserveDirectory(join(destination, ".solara-runtime"), preservedRuntime);
    }
  }

  const overlaidPortable = await replaceDirectory(unpacked, destination);
  await mkdir(join(destination, "proyectos"), { recursive: true });
  await mkdir(join(destination, ".solara-runtime"), { recursive: true });

  if (overlaidPortable) {
    console.warn(
      "El portable anterior estaba ocupado; se actualizaron sus archivos sin borrar carpetas bloqueadas.",
    );
  }

  // 2. Copiar las tiendas del repo.
  const sourceProjects = resolve(root, "proyectos");
  if (existsSync(sourceProjects)) {
    await cp(sourceProjects, join(destination, "proyectos"), { recursive: true, force: true });
  }

  // 3. Reemplazar por las versiones más nuevas guardadas en el portable.
  if (existsSync(preservedProyectos)) {
    const entries = await readdir(preservedProyectos, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const preservedStore = join(preservedProyectos, entry.name);
      const destinationStore = join(destination, "proyectos", entry.name);
      if (await shouldKeepPortableStore(preservedStore, destinationStore)) {
        await replaceDirectory(preservedStore, destinationStore);
      }
    }
  }

  // 4. Restaurar el perfil/runtime del portable.
  if (existsSync(preservedRuntime)) {
    await replaceDirectory(preservedRuntime, join(destination, ".solara-runtime"));
  }
  await rm(backupDir, { recursive: true, force: true });

  await cp(
    resolve(root, "Abrir SolaraCommerce.cmd"),
    join(destination, "Abrir SolaraCommerce.cmd"),
  );
  // El CMD referencia `scripts\open-solara.ps1`; la distribución portable debe
  // incluirlo para que el launcher siga funcionando si se quita el ejecutable.
  await mkdir(join(destination, "scripts"), { recursive: true });
  await cp(
    resolve(root, "scripts/open-solara.ps1"),
    join(destination, "scripts", "open-solara.ps1"),
  );
  await writeFile(
    join(destination, "README-PORTABLE.txt"),
    [
      "SolaraCommerce Portable",
      "",
      "Abrí SolaraCommerce.exe o Abrir SolaraCommerce.cmd.",
      "Esta carpeta es autocontenida: no necesita Node, pnpm ni una instalación del navegador.",
      "",
      "Las tiendas y sus exportaciones viven en proyectos/.",
      "El estado regenerable y el perfil local viven en .solara-runtime/.",
      "Podés copiar toda la carpeta a otra unidad o ruta, incluso si contiene espacios o Unicode.",
      "",
    ].join("\r\n"),
    "utf8",
  );

  console.log(`Distribución portable creada en ${destination}`);
  // Limpiar build/win-unpacked para evitar confusión con múltiples EXEs.
  // La única fuente de verdad es SolaraCommerce-Portable/.
  const unpackedDir = resolve(root, ".release/portable/build/win-unpacked");
  if (existsSync(unpackedDir)) {
    await rm(unpackedDir, { recursive: true, force: true });
    console.log("build/win-unpacked eliminado (fuente única: SolaraCommerce-Portable/)");
  }
}
