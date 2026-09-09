import { mkdirSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { expect, type Locator, test } from "@playwright/test";
import { createCleanStore } from "./project-helpers";
import { startStudioServer, stopStudioServer } from "./studio-server";

let server: Server;
let url: string;
test.beforeAll(async () => {
  const running = await startStudioServer();
  server = running.server;
  url = running.url;
});
test.afterAll(async () => stopStudioServer(server));

test("el panel completo conserva cierre visible y no desborda horizontalmente a 1920x912", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const folder = `.impeccable/review/editor-scroll/${process.env.SOLARA_SCROLL_PASS ?? "current"}`;
  mkdirSync(folder, { recursive: true });
  const records: unknown[] = [];
  const failures: string[] = [];
  await page.setViewportSize({ width: 1920, height: 912 });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({ timeout: 30_000 });
  await createCleanStore(page, "Revisión vertical");
  await expect(page.locator(".preview-stage iframe")).toBeVisible({ timeout: 30000 });

  async function capture(name: string, panel: Locator, scrollTarget?: Locator) {
    await expect(panel).toBeVisible();
    const innerScroll = panel.locator(".editor-detail-scroll");
    const scroll = scrollTarget ?? ((await innerScroll.count()) ? innerScroll : panel);
    for (const summary of await panel.locator("details:not([open]) > summary").all())
      await summary.click();
    for (const toggle of await panel
      .locator('.overview-accordion__toggle[aria-expanded="false"]')
      .all())
      await toggle.click();
    const height = await scroll.evaluate((node) => node.clientHeight);
    const total = await scroll.evaluate((node) => node.scrollHeight);
    const positions = [
      ...new Set([
        ...Array.from({ length: Math.ceil(total / (height * 0.85)) }, (_, index) =>
          Math.min(total - height, Math.round(index * height * 0.85)),
        ),
        total - height,
      ]),
    ];
    for (const [index, top] of positions.entries()) {
      await scroll.evaluate(
        (node, offset) => {
          node.scrollTop = offset;
        },
        Math.max(0, top),
      );
      const metric = await panel.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const close = [
          ...document.querySelectorAll<HTMLElement>(
            '[data-panel-close]:not([hidden]) button, .editor-pane-close button, .editor-detail-close button, dialog[open] button[aria-label="Cerrar editor"]',
          ),
        ].find((button) => button.getBoundingClientRect().width > 0);
        const box = close?.getBoundingClientRect();
        return {
          width: node.clientWidth,
          scrollWidth: node.scrollWidth,
          closeVisible: Boolean(
            box?.width &&
              box.top >= rect.top &&
              box.bottom <= rect.bottom &&
              close?.contains(
                document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
              ),
          ),
          horizontalScrollers: [...node.querySelectorAll<HTMLElement>("*")]
            .filter(
              (child) =>
                !child.matches("input, textarea") &&
                child.clientWidth > 0 &&
                /auto|scroll/.test(getComputedStyle(child).overflowX) &&
                child.scrollWidth > child.clientWidth + 1,
            )
            .map((child) => child.className),
          overflow: [...node.querySelectorAll<HTMLElement>("*")]
            .filter((child) => {
              const bounds = child.getBoundingClientRect();
              return (
                bounds.width > 0 &&
                bounds.right > rect.right + 1 &&
                getComputedStyle(child).position !== "fixed"
              );
            })
            .slice(0, 8)
            .map((child) => ({
              tag: child.tagName,
              className: child.className,
              text: child.textContent?.slice(0, 65),
            })),
        };
      });
      records.push({ name, index, top, total, ...metric });
      if (metric.scrollWidth > metric.width + 1)
        failures.push(`${name}: scroll lateral ${metric.scrollWidth}/${metric.width}`);
      if (metric.horizontalScrollers.length)
        failures.push(`${name}: scroll interno ${metric.horizontalScrollers.join(", ")}`);
      if (!metric.closeVisible) failures.push(`${name}: X fuera de vista en ${top}`);
      await panel.screenshot({
        path: `${folder}/${name}-${String(index).padStart(2, "0")}.png`,
        animations: "disabled",
      });
    }
  }

  for (const [index, name] of [
    "Preparar",
    "Resumen",
    "Catálogo",
    "Constructor",
    "Tema de la tienda",
    "Recursos",
    "SEO",
    "Exportar",
  ].entries()) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.locator(".editor-pane .section-header h2")).toBeVisible();
    await page.screenshot({ path: `${folder}/area-${index}-opening.png`, animations: "disabled" });
    if (process.env.SOLARA_AUDIT_OPENINGS_ONLY === "1") continue;
    await capture(`area-${index}`, page.locator(".editor-pane"));
    if (index === 2) {
      await page.locator(".editor-pane").evaluate((panel) => {
        panel.scrollTop = 0;
      });
      await page.screenshot({ path: `${folder}/catalog-1920x912.png`, animations: "disabled" });
    }
  }
  if (process.env.SOLARA_AUDIT_OPENINGS_ONLY === "1") return;
  await page.getByRole("tab", { name: "Constructor", exact: true }).click();
  const sections = await page.locator(".section-select strong").allTextContents();
  const seen = new Set<string>();
  for (const [index, name] of sections.entries()) {
    if (seen.has(name)) continue;
    seen.add(name);
    await page.locator(".section-select").nth(index).click();
    await capture(`section-${index}`, page.locator(".studio-inspector-dock"));
    await page.getByRole("button", { name: "Volver a Constructor", exact: true }).click();
  }
  await page.getByRole("tab", { name: "Recursos", exact: true }).click();
  await page.getByTestId("ui-asset-detail-open").first().click();
  await capture("asset", page.locator(".studio-inspector-dock"));
  await page.getByRole("button", { name: "Volver a Recursos", exact: true }).click();
  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await page.getByRole("button", { name: "Agregar producto", exact: true }).click();
  for (const [index, step] of ["Datos", "Imágenes", "Organización", "Variantes"].entries()) {
    await page
      .locator(".product-editor-steps")
      .getByRole("button", { name: new RegExp(step) })
      .click();
    await capture(
      `product-${index}`,
      page.locator(".studio-inspector-dock"),
      page.locator(".product-dialog__body"),
    );
  }
  await page.getByRole("button", { name: "Cerrar editor", exact: true }).click();
  writeFileSync(`${folder}/metrics.json`, JSON.stringify(records, null, 2));
  expect([...new Set(failures)]).toEqual([]);
});
