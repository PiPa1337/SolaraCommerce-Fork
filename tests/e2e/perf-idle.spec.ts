import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

/**
 * Harness de medición de CPU en reposo del Studio (Task A5 del plan de
 * rendimiento 2026-08-09). Mide el trabajo del hilo principal con CDP
 * `Performance.getMetrics` durante 5 segundos y lo expresa en ms/s.
 *
 * Casos:
 *   a) dashboard abierto (fondo de gradiente estático);
 *   b) editor abierto con el preview corriendo;
 *   c) editor con preview en pestaña oculta (emulación de visibilidad);
 *   d) probe de registros requestAnimationFrame por segundo (sumado a
 *      todos los frames, incluyendo el iframe del preview).
 *
 * Nota de implementación (verificada contra el Chromium de Playwright 1.55):
 * `Page.setWebLifecycleState({ state: "frozen" })` responde OK pero NO congela
 * la página en headless (rAF y timers siguen corriendo) y
 * `Emulation.setPageVisibilityState` no existe en este Chromium. Por eso el
 * caso (c) emula la ocultación con un hook que redefine `document.hidden` /
 * `document.visibilityState` y despacha `visibilitychange`, ejercitando los
 * handlers cooperativos del Studio (A1-A4) sin depender del throttling del
 * navegador, que en headless no es accionable por CDP.
 *
 * Los umbrales fueron recalibrados en el cierre (2026-08-09) con mediciones
 * post-fixes. Contrato honesto:
 *   - el fondo del dashboard es ahora un GRADIENTE ESTÁTICO (el agujero negro
 *     WebGL se eliminó): los casos visibles son guardas de REGRESIÓN estrictas
 *     (un segundo loop rAF o un render loop de React los haría saltar).
 *   - oculto: el trabajo debe ser ~0; umbrales estrictos (25 ms/s de Task,
 *     rAF ≈ 0).
 */
const SETTLE_MS = 3_000;
const SAMPLE_MS = 5_000;

const DASHBOARD_SCRIPT_BUDGET_MS_PER_S = 100;
const DASHBOARD_TASK_BUDGET_MS_PER_S = 100;
const EDITOR_SCRIPT_BUDGET_MS_PER_S = 100;
const EDITOR_TASK_BUDGET_MS_PER_S = 100;
const HIDDEN_SCRIPT_BUDGET_MS_PER_S = 25;
const HIDDEN_TASK_BUDGET_MS_PER_S = 25;
const HIDDEN_RAF_BUDGET_PER_S = 2;
const RAF_BUDGET_PER_S = 500;

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

test.setTimeout(180_000);

declare global {
  interface Window {
    __solaraRafProbe?: { perSecond: () => number };
    __solaraSetHidden?: (hidden: boolean) => void;
  }
}

function installRafProbe(page: Page): Promise<void> {
  return page.addInitScript(() => {
    if (window.__solaraRafProbe !== undefined) return;
    const stamps: number[] = [];
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      stamps.push(performance.now());
      if (stamps.length > 4_000) stamps.splice(0, stamps.length - 2_000);
      return original((time: number) => callback(time));
    };
    window.__solaraRafProbe = {
      perSecond: () => {
        const cutoff = performance.now() - 3_000;
        let count = 0;
        for (const stamp of stamps) if (stamp >= cutoff) count++;
        return count / 3;
      },
    };
  });
}

function installVisibilityEmulation(page: Page): Promise<void> {
  return page.addInitScript(() => {
    if (window.__solaraSetHidden !== undefined) return;
    let hidden = false;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (hidden ? "hidden" : "visible"),
    });
    window.__solaraSetHidden = (value: boolean) => {
      if (hidden === value) return;
      hidden = value;
      document.dispatchEvent(new Event("visibilitychange"));
    };
  });
}

interface IdleSample {
  scriptMsPerSecond: number;
  taskMsPerSecond: number;
}

async function measureIdle(page: Page, seconds = SAMPLE_MS / 1_000): Promise<IdleSample> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const before = await cdp.send("Performance.getMetrics");
  await page.waitForTimeout(Math.round(seconds * 1_000));
  const after = await cdp.send("Performance.getMetrics");
  const delta = (name: string): number => {
    const initial = before.metrics.find((metric) => metric.name === name)?.value ?? 0;
    const final = after.metrics.find((metric) => metric.name === name)?.value ?? 0;
    return final - initial;
  };
  return {
    scriptMsPerSecond: (delta("ScriptDuration") * 1_000) / seconds,
    taskMsPerSecond: (delta("TaskDuration") * 1_000) / seconds,
  };
}

async function rafPerSecondAllFrames(page: Page): Promise<number> {
  let total = 0;
  for (const frame of page.frames()) {
    total += await frame.evaluate(() => window.__solaraRafProbe?.perSecond() ?? 0);
  }
  return total;
}

async function setHiddenInAllFrames(page: Page, hidden: boolean): Promise<void> {
  for (const frame of page.frames()) {
    await frame.evaluate((value) => window.__solaraSetHidden?.(value), hidden);
  }
}

async function openDashboard(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(studioUrl);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
}

async function openEditor(page: Page): Promise<void> {
  await openDashboard(page);
  const card = page.locator(".dashboard-store-card").filter({ hasText: "Predeterminado" }).first();
  await card.locator(".dashboard-store-card__button").click();
  await card.getByRole("button", { name: "Abrir esta tienda" }).click();
  await expect(page.getByRole("navigation", { name: "Áreas de la tienda" })).toBeVisible();
  await expect(page.locator(".preview-pane iframe").first()).toBeVisible();
}

test("dashboard en reposo: el gradiente estático no deja trabajo", async ({ page }) => {
  await installRafProbe(page);
  await openDashboard(page);
  await page.waitForTimeout(SETTLE_MS);

  const idle = await measureIdle(page);
  const raf = await rafPerSecondAllFrames(page);

  console.log(
    `perf-idle: dashboard ScriptDuration ${idle.scriptMsPerSecond.toFixed(1)} ms/s, ` +
      `TaskDuration ${idle.taskMsPerSecond.toFixed(1)} ms/s, rAF ${raf.toFixed(1)}/s ` +
      `(presupuesto ${DASHBOARD_SCRIPT_BUDGET_MS_PER_S}/${DASHBOARD_TASK_BUDGET_MS_PER_S} ms/s, ${RAF_BUDGET_PER_S}/s)`,
  );
  expect(idle.scriptMsPerSecond).toBeLessThanOrEqual(DASHBOARD_SCRIPT_BUDGET_MS_PER_S);
  expect(idle.taskMsPerSecond).toBeLessThanOrEqual(DASHBOARD_TASK_BUDGET_MS_PER_S);
  expect(raf).toBeLessThanOrEqual(RAF_BUDGET_PER_S);
});

test("editor con preview en reposo: queda bajo el presupuesto", async ({ page }) => {
  await installRafProbe(page);
  await openEditor(page);
  await page.waitForTimeout(SETTLE_MS);

  const idle = await measureIdle(page);
  const raf = await rafPerSecondAllFrames(page);

  console.log(
    `perf-idle: editor con preview ScriptDuration ${idle.scriptMsPerSecond.toFixed(1)} ms/s, ` +
      `TaskDuration ${idle.taskMsPerSecond.toFixed(1)} ms/s, rAF ${raf.toFixed(1)}/s ` +
      `(presupuesto provisional ${EDITOR_SCRIPT_BUDGET_MS_PER_S}/${EDITOR_TASK_BUDGET_MS_PER_S} ms/s, ${RAF_BUDGET_PER_S}/s)`,
  );
  expect(idle.scriptMsPerSecond).toBeLessThanOrEqual(EDITOR_SCRIPT_BUDGET_MS_PER_S);
  expect(idle.taskMsPerSecond).toBeLessThanOrEqual(EDITOR_TASK_BUDGET_MS_PER_S);
  expect(raf).toBeLessThanOrEqual(RAF_BUDGET_PER_S);
});

test("editor con preview oculto: la pestaña escondida no trabaja", async ({ page }) => {
  await installRafProbe(page);
  await installVisibilityEmulation(page);
  await openEditor(page);
  await page.waitForTimeout(SETTLE_MS);

  const visible = await measureIdle(page);
  await setHiddenInAllFrames(page, true);
  await page.waitForTimeout(1_000);
  const hidden = await measureIdle(page);
  const raf = await rafPerSecondAllFrames(page);

  console.log(
    `perf-idle: editor oculto ScriptDuration ${hidden.scriptMsPerSecond.toFixed(1)} ms/s ` +
      `(visible antes ${visible.scriptMsPerSecond.toFixed(1)} ms/s), ` +
      `TaskDuration ${hidden.taskMsPerSecond.toFixed(1)} ms/s, rAF ${raf.toFixed(1)}/s ` +
      `(presupuesto ${HIDDEN_SCRIPT_BUDGET_MS_PER_S}/${HIDDEN_TASK_BUDGET_MS_PER_S} ms/s, ${HIDDEN_RAF_BUDGET_PER_S}/s)`,
  );
  expect(hidden.scriptMsPerSecond).toBeLessThanOrEqual(HIDDEN_SCRIPT_BUDGET_MS_PER_S);
  expect(hidden.taskMsPerSecond).toBeLessThanOrEqual(HIDDEN_TASK_BUDGET_MS_PER_S);
  expect(raf).toBeLessThanOrEqual(HIDDEN_RAF_BUDGET_PER_S);
});

test("dashboard oculto: el fondo estático no deja trabajo", async ({ page }) => {
  await installRafProbe(page);
  await installVisibilityEmulation(page);
  await openDashboard(page);
  await page.waitForTimeout(SETTLE_MS);

  const visible = await measureIdle(page);
  await setHiddenInAllFrames(page, true);
  await page.waitForTimeout(1_000);
  const hidden = await measureIdle(page);
  const raf = await rafPerSecondAllFrames(page);

  console.log(
    `perf-idle: dashboard oculto ScriptDuration ${hidden.scriptMsPerSecond.toFixed(1)} ms/s ` +
      `(visible antes ${visible.scriptMsPerSecond.toFixed(1)} ms/s), ` +
      `TaskDuration ${hidden.taskMsPerSecond.toFixed(1)} ms/s, rAF ${raf.toFixed(1)}/s ` +
      `(presupuesto ${HIDDEN_SCRIPT_BUDGET_MS_PER_S}/${HIDDEN_TASK_BUDGET_MS_PER_S} ms/s, rAF ${HIDDEN_RAF_BUDGET_PER_S}/s)`,
  );
  expect(hidden.scriptMsPerSecond).toBeLessThanOrEqual(HIDDEN_SCRIPT_BUDGET_MS_PER_S);
  expect(hidden.taskMsPerSecond).toBeLessThanOrEqual(HIDDEN_TASK_BUDGET_MS_PER_S);
  expect(raf).toBeLessThanOrEqual(HIDDEN_RAF_BUDGET_PER_S);
});
