/**
 * Convierte el directorio `win-unpacked` de electron-builder en una carpeta
 * portable estable. Sólo copia datos de `proyectos/` si ya existen; los builds
 * y el runtime permanecen fuera del repositorio gracias a `.gitignore`.
 */

import { existsSync } from "node:fs";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const unpacked = resolve(root, ".release/portable/build/win-unpacked");
const destination = resolve(root, ".release/portable/SolaraCommerce-Portable");

if (!existsSync(join(unpacked, "SolaraCommerce.exe"))) {
  throw new Error(
    "No se encontró win-unpacked/SolaraCommerce.exe. Ejecutá desktop:package primero.",
  );
}

await rm(destination, { recursive: true, force: true });
await cp(unpacked, destination, { recursive: true });
await mkdir(join(destination, "proyectos"), { recursive: true });
await mkdir(join(destination, ".solara-runtime"), { recursive: true });

const sourceProjects = resolve(root, "proyectos");
if (existsSync(sourceProjects)) {
  await cp(sourceProjects, join(destination, "proyectos"), { recursive: true, force: true });
}

await cp(resolve(root, "Abrir SolaraCommerce.cmd"), join(destination, "Abrir SolaraCommerce.cmd"));
// El CMD referencia `scripts\open-solara.ps1`; la distribución portable debe
// incluirlo para que el launcher siga funcionando si se quita el ejecutable.
await mkdir(join(destination, "scripts"), { recursive: true });
await cp(resolve(root, "scripts/open-solara.ps1"), join(destination, "scripts", "open-solara.ps1"));
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
