import type { Server } from "node:http";
import { expect, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

let server: Server;
let url: string;
test.beforeAll(async () => {
  const running = await startStudioServer();
  server = running.server;
  url = running.url;
});
test.afterAll(async () => stopStudioServer(server));

test("el flujo renueva el gas sin saltos y conserva detalle en sesiones largas", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const names = new WeakMap<WebGLUniformLocation, string>();
    const get = WebGL2RenderingContext.prototype.getUniformLocation;
    const set = WebGL2RenderingContext.prototype.uniform1f;
    const draw = WebGL2RenderingContext.prototype.drawArrays;
    let sampledTime = "";
    WebGL2RenderingContext.prototype.getUniformLocation = function (program, name) {
      const location = get.call(this, program, name);
      if (location) names.set(location, name);
      return location;
    };
    WebGL2RenderingContext.prototype.uniform1f = function (location, value) {
      const time = document.documentElement.dataset.captureTime;
      if (location && names.get(location) === "uTime" && time) {
        value = Number(time);
        sampledTime = time;
      }
      set.call(this, location, value);
    };
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      draw.apply(this, args);
      const canvas = this.canvas;
      if (!(canvas instanceof HTMLCanvasElement) || !sampledTime) return;
      const samples: number[] = [];
      for (const [x, y] of [
        [0.72, 0.75],
        [0.6, 0.4],
        [0.83, 0.3],
      ]) {
        const pixels = new Uint8Array(24 * 24 * 4);
        this.readPixels(
          Math.floor(canvas.width * x),
          Math.floor(canvas.height * y),
          24,
          24,
          this.RGBA,
          this.UNSIGNED_BYTE,
          pixels,
        );
        samples.push(...pixels);
      }
      canvas.dataset.motionPixels = JSON.stringify(samples);
      canvas.dataset.sampledTime = sampledTime;
    };
  });
  await page.goto(url);
  await expect(page.getByTestId("solara-app-boot")).toHaveCount(0, { timeout: 15000 });
  await page.getByLabel("Opacidad de la interfaz del dashboard").fill("0");
  const notice = page.getByRole("button", { name: "Cerrar aviso", exact: true });
  if (await notice.isVisible()) await notice.click();
  const canvas = page.locator(".dashboard-gargantua > .dashboard-gravity-field canvas");
  const sample = async (time: number) => {
    await page.evaluate((value) => {
      document.documentElement.dataset.captureTime = String(value);
    }, time);
    // Let each media event reach the renderer; back-to-back toggles coalesce.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForTimeout(250);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(250);
    await expect(canvas).toHaveAttribute("data-sampled-time", String(time));
    return JSON.parse((await canvas.getAttribute("data-motion-pixels")) ?? "[]") as number[];
  };
  const delta = (a: number[], b: number[]) =>
    a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length;
  const changes: number[] = [];
  let previous: number[] | undefined;
  for (let i = 0; i < 10; i++) {
    const pixels = await sample(10000 + i * 500);
    if (previous) changes.push(delta(previous, pixels));
    previous = pixels;
    await page.screenshot({
      path: testInfo.outputPath(`motion-${String(i + 1).padStart(2, "0")}.png`),
    });
  }
  expect(changes.every((value) => value > 0)).toBe(true);
  for (const boundary of [24000, 48000, 3600000]) {
    const before = await sample(boundary - 100);
    const at = await sample(boundary);
    const after = await sample(boundary + 100);
    const left = delta(before, at),
      right = delta(at, after);
    expect(Math.max(left, right)).toBeLessThan(Math.min(left, right) * 3 + 0.2);
    expect(Math.max(left, right)).toBeLessThan(5);
  }
  await testInfo.attach("motion-deltas", {
    body: JSON.stringify(changes),
    contentType: "application/json",
  });
});

test("el fondo procedural conserva su imagen y recupera el contexto WebGL", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url);
  const field = page.locator(".dashboard-gargantua > .dashboard-gravity-field");
  await expect(field).toHaveAttribute("data-renderer", "webgl2");
  await expect(field).toHaveCSS("background-image", "none");
  await expect(field.locator("canvas")).toHaveCSS("mix-blend-mode", "normal");
  const canLose = await field.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
    const extension = canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context");
    if (!extension) return false;
    extension.loseContext();
    // The extension must survive context loss in order to restore the same canvas.
    setTimeout(() => extension.restoreContext(), 400);
    return true;
  });
  expect(canLose).toBe(true);
  await expect(field).toHaveAttribute("data-renderer", "unavailable");
  await expect(field.locator("canvas")).toBeHidden();
  await expect(field).toHaveAttribute("data-renderer", "webgl2");
  await expect(field.locator("canvas")).toBeVisible();
});

for (const [width, height] of [
  [1883, 835],
  [1024, 768],
  [390, 844],
]) {
  test(`composición cinematográfica a ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(url);
    await expect(page.getByTestId("solara-app-boot")).toHaveCount(0, { timeout: 15000 });
    const field = page.locator(".dashboard-gargantua > .dashboard-gravity-field");
    await expect(field).toHaveAttribute("data-renderer", "webgl2");
    await expect(page.getByRole("heading", { name: "Tus tiendas", exact: true })).toBeVisible();
    const notice = page.getByRole("button", { name: "Cerrar aviso", exact: true });
    if (await notice.isVisible()) await notice.click();
    await page.screenshot({ path: `test-results/overdrive-dashboard-${width}.png` });
    await page.getByLabel("Opacidad de la interfaz del dashboard").fill("0");
    await page.screenshot({ path: `test-results/overdrive-background-${width}.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
  });
}

test("movimiento reducido dibuja una imagen estable sin un bucle de GPU", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const draw = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      const canvas = this.canvas;
      if (canvas instanceof HTMLCanvasElement) {
        canvas.dataset.drawCount = String(Number(canvas.dataset.drawCount ?? "0") + 1);
      }
      return draw.apply(this, args);
    };
  });
  await page.goto(url);
  await expect(page.getByTestId("solara-app-boot")).toHaveCount(0, { timeout: 15000 });
  const canvas = page.locator(".dashboard-gargantua > .dashboard-gravity-field canvas");
  await expect(canvas).toHaveAttribute("data-draw-count", /[1-9]/);
  const before = await canvas.getAttribute("data-draw-count");
  // This bounded interval checks that no animation frames reach the GPU at rest.
  await page.waitForTimeout(350);
  expect(await canvas.getAttribute("data-draw-count")).toBe(before);
});

test("la materia cambia entre cuadros sin bloquear la selección", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const draw = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      draw.apply(this, args);
      const canvas = this.canvas;
      if (!(canvas instanceof HTMLCanvasElement)) return;
      const count = Number(canvas.dataset.drawCount ?? "0") + 1;
      canvas.dataset.drawCount = String(count);
      // Sample once per second, directly after drawing while the buffer is valid.
      if (performance.now() - Number(canvas.dataset.sampleAt ?? "0") < 1000) return;
      const pixels = new Uint8Array(16 * 16 * 4);
      this.readPixels(
        Math.floor(canvas.width * 0.72),
        Math.floor(canvas.height * 0.46),
        16,
        16,
        this.RGBA,
        this.UNSIGNED_BYTE,
        pixels,
      );
      canvas.dataset.sample = String(
        pixels.reduce((sum, value, index) => sum + value * (index + 1), 0),
      );
      canvas.dataset.sampleAt = String(performance.now());
    };
  });
  await page.goto(url);
  await expect(page.getByTestId("solara-app-boot")).toHaveCount(0, { timeout: 15000 });
  const canvas = page.locator(".dashboard-gargantua > .dashboard-gravity-field canvas");
  await expect(canvas).toHaveAttribute("data-sample", /\d+/);
  const sample = await canvas.getAttribute("data-sample");
  await expect(canvas).not.toHaveAttribute("data-sample", sample ?? "", { timeout: 5000 });
  await page.getByRole("button", { name: "Cerrar detalle", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Predeterminado", exact: true })).toBeHidden();
  const before = Number(await canvas.getAttribute("data-draw-count"));
  const startedAt = Date.now();
  await page.locator(".dashboard-store-card__button").first().click();
  await expect(page.getByRole("heading", { name: "Predeterminado", exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  const frames = Number(await canvas.getAttribute("data-draw-count")) - before;
  const fps = (frames * 1000) / (Date.now() - startedAt);
  const graphics = await canvas.evaluate((element: HTMLCanvasElement) => {
    const gl = element.getContext("webgl2");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      renderer: gl && info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unavailable",
      width: element.width,
      height: element.height,
    };
  });
  await testInfo.attach("observed-render-rate", {
    body: JSON.stringify({
      fps,
      frames,
      graphics,
      note: "Browser test environment; not a hardware certification.",
    }),
    contentType: "application/json",
  });
});
