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
import { dirname, join, resolve } from "node:path";
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
  if (!existsSync(repoStore)) return (await inspectStore(preservedStore)).healthy;
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

/** Recupera estado preservado si el overlay se interrumpe por un lock de Windows. */
export async function restorePreservedDirectoryIfMissing(source, destinationPath) {
  if (!existsSync(source) || existsSync(destinationPath)) return true;
  try {
    await cp(source, destinationPath, { recursive: true });
    return true;
  } catch (error) {
    console.error(`No se pudo restaurar ${destinationPath} desde el respaldo temporal.`, error);
    return false;
  }
}

/** Reemplaza una carpeta sin dejar un overlay parcial si Windows la tiene abierta. */
export async function replaceDirectory(source, destinationPath) {
  const backupPath = join(
    dirname(destinationPath),
    `.${destinationPath.split(/[\\/]/).pop()}-previous-${process.pid}-${Date.now()}`,
  );
  let destinationMoved = false;
  try {
    if (existsSync(destinationPath)) {
      // Renombrar la carpeta completa es la barrera: un EXE abierto hace
      // fallar este paso antes de modificar archivos del portable en uso.
      await rename(destinationPath, backupPath);
      destinationMoved = true;
    }
    await rename(source, destinationPath);
    if (destinationMoved) await rm(backupPath, { recursive: true, force: true });
    return false;
  } catch (error) {
    if (destinationMoved) {
      try {
        if (existsSync(destinationPath)) {
          await rm(destinationPath, { recursive: true, force: true });
        }
        await rename(backupPath, destinationPath);
      } catch (restoreError) {
        console.error(
          `No se pudo restaurar el portable anterior en ${destinationPath}.`,
          restoreError,
        );
      }
    }
    throw error;
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

  try {
    await replaceDirectory(unpacked, destination);
  } catch (error) {
    const projectsRestored = await restorePreservedDirectoryIfMissing(
      preservedProyectos,
      join(destination, "proyectos"),
    );
    const runtimeRestored = await restorePreservedDirectoryIfMissing(
      preservedRuntime,
      join(destination, ".solara-runtime"),
    );
    if (projectsRestored && runtimeRestored) {
      await rm(backupDir, { recursive: true, force: true });
    } else {
      console.error(`El respaldo temporal quedó conservado en ${backupDir}.`);
    }
    throw error;
  }
  await mkdir(join(destination, "proyectos"), { recursive: true });
  await mkdir(join(destination, ".solara-runtime"), { recursive: true });

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
      const keepPreserved = await shouldKeepPortableStore(preservedStore, destinationStore);
      if (keepPreserved) {
        await replaceDirectory(preservedStore, destinationStore);
      } else if (!(await inspectStore(preservedStore)).healthy) {
        const recoveryRoot = join(destination, "recovery", "portable-stores");
        await mkdir(recoveryRoot, { recursive: true });
        const quarantinePath = join(recoveryRoot, `${entry.name}-${Date.now()}`);
        await cp(preservedStore, quarantinePath, { recursive: true });
        console.warn(`Respaldo portable no verificable conservado en ${quarantinePath}`);
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
  await cp(
    resolve(root, "SolaraCommerce-Agent.cmd"),
    join(destination, "SolaraCommerce-Agent.cmd"),
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
      "Para automatización cerrá la app y usá SolaraCommerce-Agent.cmd.",
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
