import { access } from "node:fs/promises";
import { dirname, extname, resolve as resolvePath, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const workspaceRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const sourceExtensions = [".ts", ".tsx"];

async function existingFile(path) {
  try {
    await access(path);
    return path;
  } catch {
    return undefined;
  }
}

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith(".") && !specifier.startsWith("/")) throw error;
    const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : workspaceRoot;
    const rawPath = resolvePath(dirname(parentPath), specifier);
    const candidates = [];
    if (extname(rawPath) === ".js") candidates.push(rawPath.slice(0, -3));
    else candidates.push(rawPath);
    const candidatePaths = candidates
      .flatMap((candidate) => sourceExtensions.map((extension) => `${candidate}${extension}`))
      .concat(candidates.map((candidate) => `${candidate}/index.ts`))
      .map((candidate) => resolvePath(candidate))
      .filter(
        (candidate) => candidate === workspaceRoot || candidate.startsWith(workspaceRoot + sep),
      );
    let existing;
    for (const candidate of candidatePaths) {
      existing = await existingFile(candidate);
      if (existing) break;
    }
    if (!existing) throw error;
    return { url: pathToFileURL(existing).href, shortCircuit: true };
  }
}
