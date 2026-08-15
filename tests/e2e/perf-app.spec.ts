import { test } from "@playwright/test";

test.setTimeout(180_000);

const STUDIO_URL = "http://localhost:4173";

test("P1-K1/K2: boot de la app, interacciones y memoria (baseline)", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");

  let start = Date.now();
  await page.goto(STUDIO_URL, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 30000 });
  const dashboardBoot = Date.now() - start;
  await page.waitForTimeout(2000);

  start = Date.now();
  await page
    .locator(".dashboard-store-card")
    .first()
    .locator(".dashboard-store-card__button")
    .dblclick();
  await page.locator(".studio-shell").waitFor({ timeout: 30000 });
  const editorOpen = Date.now() - start;
  await page.waitForTimeout(2000);

  const heap0 = await page.evaluate(
    () =>
      (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize,
  );

  const tabs = ["Catálogo", "Constructor", "Tema", "Recursos", "SEO", "Exportar"];
  const tabTimes: Record<string, number> = {};
  for (const tab of tabs) {
    start = Date.now();
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await page.waitForTimeout(900);
    tabTimes[tab] = Date.now() - start - 900;
  }
  await page.waitForTimeout(2000);
  const heap1 = await page.evaluate(
    () =>
      (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize,
  );

  const samples: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const before = await cdp.send("Performance.getMetrics");
    await page.waitForTimeout(2000);
    const after = await cdp.send("Performance.getMetrics");
    const delta = (name: string): number => {
      const a = before.metrics.find((m) => m.name === name)?.value ?? 0;
      const b = after.metrics.find((m) => m.name === name)?.value ?? 0;
      return b - a;
    };
    samples.push(Math.round(delta("TaskDuration") * 500) / 100);
  }

  const heap0Mb = heap0 ? Math.round((heap0 / 1024 / 1024) * 10) / 10 : null;
  const heap1Mb = heap1 ? Math.round((heap1 / 1024 / 1024) * 10) / 10 : null;
  const idleTaskMsPerSec =
    Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 10) / 10;

  console.log(
    JSON.stringify(
      {
        dashboardBoot,
        editorOpen,
        tabTimes,
        heap0Mb,
        heap1Mb,
        heapDeltaAfterTabsMb:
          heap1Mb !== null && heap0Mb !== null ? Math.round((heap1Mb - heap0Mb) * 10) / 10 : null,
        idleTaskMsPerSec,
      },
      null,
      2,
    ),
  );
  await page.close();
  await context.close();
});
