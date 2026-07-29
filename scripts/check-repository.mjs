import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const secretPatterns = [
  {
    label: "clave privada",
    pattern: /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/,
  },
  {
    label: "token clásico de GitHub",
    pattern: /\bgh[opusr]_[A-Za-z0-9]{36,}\b/,
  },
  {
    label: "token fine-grained de GitHub",
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  },
  {
    label: "access key de AWS",
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    label: "secreto asignado en texto plano",
    pattern:
      /(?:api[_-]?key|auth[_-]?token|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*["']?(?!(?:changeme|example|placeholder)\b)[A-Za-z0-9_./+=-]{16,}/i,
  },
];

function repositoryFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  return output.toString("utf8").split("\0").filter(Boolean);
}

function isBinary(buffer) {
  const sampleLength = Math.min(buffer.length, 8_192);
  for (let index = 0; index < sampleLength; index++) {
    if (buffer[index] === 0) return true;
  }
  return false;
}

function checkFile(path) {
  const absolutePath = resolve(path);
  const stat = lstatSync(absolutePath);
  if (!stat.isFile()) return [];

  const issues = [];
  if (stat.size > MAX_FILE_BYTES) {
    issues.push(
      `${path}: pesa ${(stat.size / 1024 / 1024).toFixed(2)} MB; el máximo versionable es 10 MB.`,
    );
    return issues;
  }

  const contents = readFileSync(absolutePath);
  if (isBinary(contents)) return issues;
  const text = contents.toString("utf8");
  for (const { label, pattern } of secretPatterns) {
    if (pattern.test(text)) issues.push(`${path}: posible ${label}.`);
  }
  return issues;
}

const requestedPaths = process.argv.slice(2);
const paths = requestedPaths.length > 0 ? requestedPaths : repositoryFiles();
const issues = [];

for (const path of paths) {
  try {
    issues.push(...checkFile(path));
  } catch (error) {
    issues.push(`${path}: no se pudo revisar (${error instanceof Error ? error.message : error}).`);
  }
}

if (issues.length > 0) {
  console.error("El repositorio no cumple las reglas de publicación:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(`Repositorio verificado: ${paths.length} archivos sin secretos ni archivos grandes.`);
}
