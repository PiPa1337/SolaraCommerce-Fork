/**
 * Modelo puro de comparación entre dos tiendas para la vista CompareView.
 * No depende de React ni de la UI: los tests unitarios cubren los diffs.
 */
import { getProjectMetrics } from "../../lib/dashboardModel";
import type { StoredProject } from "../../lib/repository";

export interface CompareCountRow {
  label: string;
  left: number;
  right: number;
}

export interface CompareTokenRow {
  label: string;
  left: string;
  right: string;
}

export interface CompareMotionDiff {
  moduleId: string;
  leftPreset: string;
  rightPreset: string;
}

export interface CompareReport {
  leftName: string;
  rightName: string;
  leftSiteStatus: string;
  rightSiteStatus: string;
  counts: CompareCountRow[];
  theme: CompareTokenRow[];
  sectionsOnlyInLeft: string[];
  sectionsOnlyInRight: string[];
  motionDiffs: CompareMotionDiff[];
}

export function siteStatusLabel(record: StoredProject): string {
  if (record.diskSiteStatus === "synced") return "Actualizado en disco";
  if (record.diskSiteStatus === "site-outdated") return "Sitio desactualizado";
  return "Sin sitio en disco";
}

const THEME_TOKEN_LABELS: Array<
  [label: string, read: (project: StoredProject["project"]) => string]
> = [
  ["Modo de color", (project) => project.theme.colorMode],
  ["Color de fondo", (project) => project.theme.colors.background],
  ["Color de superficie", (project) => project.theme.colors.surface],
  ["Color de texto", (project) => project.theme.colors.text],
  ["Texto atenuado", (project) => project.theme.colors.muted],
  ["Color de acento", (project) => project.theme.colors.accent],
  ["Texto sobre acento", (project) => project.theme.colors.accentText],
  ["Color de borde", (project) => project.theme.colors.border],
  ["Tipografía display", (project) => project.theme.typography.display],
  ["Tipografía de texto", (project) => project.theme.typography.body],
  ["Escala tipográfica", (project) => String(project.theme.typography.scale)],
  ["Escala de espaciado", (project) => String(project.theme.spacingScale)],
  ["Radio de esquinas", (project) => `${project.theme.radius} px`],
  ["Ancho de contenedor", (project) => `${project.theme.container} px`],
];

function motionSignature(project: StoredProject["project"], moduleId: string): string {
  const section = project.sections.find((candidate) => candidate.moduleId === moduleId);
  if (!section) return "";
  const motion = section.motion;
  return `${motion.preset}|${motion.intensity}|${motion.duration}|${motion.distance}|${motion.stagger}`;
}

export function buildCompareReport(left: StoredProject, right: StoredProject): CompareReport {
  const leftMetrics = getProjectMetrics(left.project);
  const rightMetrics = getProjectMetrics(right.project);
  const leftVariants = left.project.products.reduce(
    (total, product) => total + product.variants.length,
    0,
  );
  const rightVariants = right.project.products.reduce(
    (total, product) => total + product.variants.length,
    0,
  );

  const counts: CompareCountRow[] = [
    {
      label: "Productos activos",
      left: leftMetrics.activeProducts,
      right: rightMetrics.activeProducts,
    },
    { label: "Variantes", left: leftVariants, right: rightVariants },
    { label: "Categorías", left: leftMetrics.categories, right: rightMetrics.categories },
    { label: "Colecciones", left: leftMetrics.collections, right: rightMetrics.collections },
    { label: "Recursos", left: leftMetrics.assets, right: rightMetrics.assets },
  ];

  const theme: CompareTokenRow[] = THEME_TOKEN_LABELS.map(([label, read]) => ({
    label,
    left: read(left.project),
    right: read(right.project),
  }));

  const leftModules = new Set(left.project.sections.map((section) => section.moduleId));
  const rightModules = new Set(right.project.sections.map((section) => section.moduleId));
  const sectionsOnlyInLeft = [...leftModules]
    .filter((moduleId) => !rightModules.has(moduleId))
    .sort((moduleA, moduleB) => moduleA.localeCompare(moduleB, "es-AR"));
  const sectionsOnlyInRight = [...rightModules]
    .filter((moduleId) => !leftModules.has(moduleId))
    .sort((moduleA, moduleB) => moduleA.localeCompare(moduleB, "es-AR"));
  const motionDiffs = [...leftModules]
    .filter((moduleId) => rightModules.has(moduleId))
    .map((moduleId) => ({
      moduleId,
      leftPreset:
        left.project.sections.find((section) => section.moduleId === moduleId)?.motion.preset ??
        "none",
      rightPreset:
        right.project.sections.find((section) => section.moduleId === moduleId)?.motion.preset ??
        "none",
    }))
    .filter(
      (diff) =>
        motionSignature(left.project, diff.moduleId) !==
        motionSignature(right.project, diff.moduleId),
    );

  return {
    leftName: left.name,
    rightName: right.name,
    leftSiteStatus: siteStatusLabel(left),
    rightSiteStatus: siteStatusLabel(right),
    counts,
    theme,
    sectionsOnlyInLeft,
    sectionsOnlyInRight,
    motionDiffs,
  };
}
