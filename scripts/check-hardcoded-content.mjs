import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const allowlist = JSON.parse(
  readFileSync(resolve("scripts/hardcoded-content-allowlist.json"), "utf8"),
);
const sourceExtensions = new Set([".cjs", ".css", ".html", ".js", ".mjs", ".ts", ".tsx"]);
const suspiciousPatterns = [
  { label: "marca legacy Modo Sur", pattern: /\bModo Sur\b/i },
  { label: "marca legacy Casa Luma", pattern: /\bCasa Luma\b/i },
  { label: "nombre de demo Predeterminado", pattern: /\bPredeterminado\b/i },
  {
    label: "dominio de fixture",
    pattern: /(?:modo-sur|casa-luma|tienda-demo|tienda-referencia)[^\s"']*\.example/i,
  },
  {
    label: "email de fixture",
    pattern: /hola@(?:modo-sur|casa-luma|tienda-demo|tienda-referencia)[^\s"']*\.example/i,
  },
  { label: "teléfono determinista", pattern: /\b549(?:1100000000|1123456789)\b/ },
];

function repositoryFiles() {
  return execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    stdio: ["ignore", "pipe", "inherit"],
  })
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((path) => sourceExtensions.has(extname(path)) || path.endsWith(".md"));
}

function normalizePath(path) {
  return path.replaceAll("\\", "/");
}

function isTestOrDocumentation(path) {
  return (
    path.startsWith("tests/") ||
    path.startsWith("docs/") ||
    path === "CHANGELOG.md" ||
    path === "HANDOFF.md" ||
    path.includes(".test.") ||
    path.includes("/test/")
  );
}

function isFixture(path) {
  return /(?:fixture|scale-fixture|portable-e2e)/i.test(path);
}

function isAuditTool(path) {
  return (
    path === "scripts/check-hardcoded-content.mjs" ||
    path === "scripts/hardcoded-content-allowlist.json"
  );
}

function allowlisted(path, literal) {
  return allowlist.some(
    (entry) => entry.path === path && literal.toLowerCase().includes(entry.literal.toLowerCase()),
  );
}

function categoryFor(path, literal) {
  if (isTestOrDocumentation(path)) return "fixture/test/documentación";
  if (isFixture(path)) return "fixture determinista";
  if (path.includes("repository") || path.includes("request-handler")) return "contrato/migración";
  if (literal.includes("solara.com.ar")) return "plataforma Solara";
  return "posible dato de tienda";
}

const findings = [];
const violations = [];
for (const rawPath of repositoryFiles()) {
  const path = normalizePath(rawPath);
  let text;
  try {
    text = readFileSync(resolve(rawPath), "utf8");
  } catch {
    continue;
  }
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const { label, pattern } of suspiciousPatterns) {
      const match = line.match(pattern);
      if (!match) continue;
      const literal = match[0];
      const finding = {
        path,
        line: index + 1,
        literal,
        category: categoryFor(path, literal),
        allowlisted: allowlisted(path, literal),
        label,
      };
      findings.push(finding);
      const activeSource =
        path.startsWith("apps/") || path.startsWith("packages/") || path.startsWith("scripts/");
      if (
        activeSource &&
        !isTestOrDocumentation(path) &&
        !isFixture(path) &&
        !isAuditTool(path) &&
        !finding.allowlisted
      ) {
        violations.push(finding);
      }
    }
  });
}

if (findings.length > 0) {
  console.log("Auditoría de contenido hardcodeado:");
  for (const finding of findings) {
    console.log(
      `- ${finding.path}:${finding.line} [${finding.category}] ${finding.label}: ${finding.literal}${finding.allowlisted ? " (allowlist exacta)" : ""}`,
    );
  }
}

if (violations.length > 0) {
  console.error("\nEl gate encontró contenido específico de una tienda sin clasificación:");
  for (const violation of violations) {
    console.error(`- ${violation.path}:${violation.line} ${violation.literal}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `\nGate de hardcodes OK: ${findings.length} hallazgos, sin filtraciones activas no justificadas.`,
  );
}
