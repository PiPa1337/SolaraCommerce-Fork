/**
 * U7 — Verificación multi-viewport de ajuste al layout (plan 2026-08-09).
 *
 * Abre el dashboard, el editor (Catálogo, Preparar, Resumen) y Export en los
 * viewports 1366×768, 1440×900 y 1920×1080 y aserta que:
 *   - no hay scroll vertical DE PÁGINA:
 *       document.documentElement.scrollHeight <= clientHeight + 1;
 *   - no hay desborde horizontal de body:
 *       document.body.scrollWidth <= ancho del viewport + 1.
 *
 * El scroll interno de los paneles es legítimo; el scroll de página no.
 * Un test por combinación (área × viewport) para que el cierre pueda
 * identificar y asignar cada violación residual a su agente dueño.
 */
import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

test.setTimeout(process.env.CI ? 120_000 : 90_000);

let server: Server;
let studioUrl: string;

test.beforeAll(async () => {
  const running = await startStudioServer();
  server = running.server;
  studioUrl = running.url;
});

test.afterAll(async () => {
  await stopStudioServer(server);
});

const viewports = [
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
] as const;

/**
 * Violaciones conocidas en el estado de mitad de ola: [área, viewport] → motivo.
 * Cerradas por U2 (d50c943): el dashboard ya ajusta los tres viewports.
 */
const KNOWN_VIOLATIONS: Record<string, string> = {};

/** Nombres de área para los mensajes del reporte. */
const AREA_NAMES: Record<string, string> = {
  dashboard: "dashboard",
  "editor-catalogo": "editor · Catálogo",
  "editor-preparar": "editor · Preparar",
  "editor-resumen": "editor · Resumen",
  "editor-export": "editor · Exportar",
};

async function openDashboard(page: Page): Promise<void> {
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 30_000,
  });
}

/** Entra a la tienda Predeterminado desde un dashboard ya cargado. */
async function openDemoStore(page: Page): Promise<void> {
  const card = page.locator(".dashboard-store-card").filter({ hasText: "Predeterminado" }).first();
  await card.locator(".dashboard-store-card__button").click();
  await page
    .getByRole("complementary", { name: "Tienda seleccionada: Predeterminado" })
    .getByRole("button", { name: "Abrir tienda" })
    .click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
}

async function openEditorTab(page: Page, tab: string, heading: string): Promise<void> {
  await openDashboard(page);
  await openDemoStore(page);
  await page.getByRole("tab", { name: tab, exact: true }).click();
  await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
}

/** Describe las violaciones observadas para el reporte (con selectores). */
async function describeViolations(
  page: Page,
  viewport: { width: number; height: number },
): Promise<string[]> {
  return page.evaluate((vw) => {
    const describeEl = (el: Element): string => {
      const classes = String(el.className || "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .join(".");
      const testid = el.getAttribute("data-testid");
      const id = el.getAttribute("id");
      const parts = [
        el.tagName.toLowerCase(),
        classes ? `.${classes}` : "",
        testid ? `[data-testid=${testid}]` : "",
        id ? `#${id}` : "",
      ].filter(Boolean);
      return parts.join(" ");
    };

    const doc = document.documentElement;
    const lines: string[] = [];
    lines.push(
      `viewport=${vw.width}x${vw.height} scrollHeight=${doc.scrollHeight} clientHeight=${doc.clientHeight}`,
    );
    lines.push(
      `body.scrollWidth=${document.body.scrollWidth} html.scrollWidth=${doc.scrollWidth} clientWidth=${doc.clientWidth}`,
    );

    const containedByClippingAncestor = (el: Element): boolean => {
      let node: Element | null = el.parentElement;
      while (node && node !== document.body) {
        const style = getComputedStyle(node);
        const clips = ["auto", "scroll", "hidden"].includes(style.overflowY);
        if (clips) {
          const r = node.getBoundingClientRect();
          const er = el.getBoundingClientRect();
          if (er.bottom <= r.bottom + 1 && er.top >= r.top - 1) return true;
        }
        node = node.parentElement;
      }
      return false;
    };

    const verticalContributors: string[] = [];
    const seenVertical = new Set<string>();
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.bottom > vw.height + 1 && !containedByClippingAncestor(el)) {
        const desc = describeEl(el);
        if (!seenVertical.has(desc)) {
          seenVertical.add(desc);
          verticalContributors.push(
            `${desc} top=${Math.round(rect.top)} bottom=${Math.round(rect.bottom)} height=${Math.round(rect.height)}`,
          );
        }
      }
    }
    if (verticalContributors.length > 0) {
      lines.push(
        "elementos con borde inferior más allá del viewport, fuera de contenedores con scroll (top 12):",
      );
      lines.push(...verticalContributors.slice(0, 12));
    }

    const offenders: string[] = [];
    const seen = new Set<string>();
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right > vw.width + 1 || rect.left < -1) {
        const desc = describeEl(el);
        if (!seen.has(desc)) {
          seen.add(desc);
          offenders.push(
            `${desc} left=${Math.round(rect.left)} right=${Math.round(rect.right)} width=${Math.round(rect.width)}`,
          );
        }
      }
    }
    if (offenders.length > 0) {
      lines.push("elementos que exceden el borde horizontal (top 12):");
      lines.push(...offenders.slice(0, 12));
    }
    return lines;
  }, viewport);
}

async function assertLayoutFit(
  page: Page,
  viewport: { width: number; height: number },
  context: string,
): Promise<void> {
  try {
    await expect
      .poll(
        () =>
          page.evaluate((vw) => {
            const doc = document.documentElement;
            const verticalOk = doc.scrollHeight <= doc.clientHeight + 1;
            const horizontalOk = document.body.scrollWidth <= vw + 1;
            return verticalOk && horizontalOk;
          }, viewport.width),
        {
          message: `${context}: sin scroll vertical de página ni desborde horizontal`,
          timeout: 20_000,
        },
      )
      .toBe(true);
  } catch (error) {
    const detail = await describeViolations(page, viewport);
    throw new Error(`${context}\n${detail.join("\n")}`, { cause: error });
  }
}

interface FitCase {
  area: string;
  title: string;
  open: (page: Page) => Promise<void>;
}

const cases: FitCase[] = [
  {
    area: "dashboard",
    title: "dashboard",
    open: (page) => openDashboard(page),
  },
  {
    area: "editor-catalogo",
    title: "editor con la pestaña Catálogo",
    open: (page) => openEditorTab(page, "Catálogo", "Catálogo"),
  },
  {
    area: "editor-preparar",
    title: "editor con la pestaña Preparar",
    open: (page) => openEditorTab(page, "Preparar", "Preparar tienda"),
  },
  {
    area: "editor-resumen",
    title: "editor con la pestaña Resumen",
    open: (page) => openEditorTab(page, "Resumen", "Resumen"),
  },
  {
    area: "editor-export",
    title: "editor con la pestaña Exportar",
    open: (page) => openEditorTab(page, "Exportar", "Exportar"),
  },
];

for (const viewport of viewports) {
  for (const fitCase of cases) {
    test(`ajuste al viewport sin scroll ni desbordes: ${fitCase.title} · ${viewport.name}`, async ({
      page,
    }) => {
      const key = `${fitCase.area}@${viewport.name}`;
      const known = KNOWN_VIOLATIONS[key];
      if (known) {
        // Violación conocida del estado de mitad de ola; el cierre (U8/U9/T10)
        // la valida contra el TODO de .superpowers/sdd/ui-t7-report.md.
        test.skip(true, `violación conocida: ${known}`);
      }
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await fitCase.open(page);
      await assertLayoutFit(page, viewport, `${AREA_NAMES[fitCase.area]} · ${viewport.name}`);
    });
  }
}
