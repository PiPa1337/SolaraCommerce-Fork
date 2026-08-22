/**
 * Optimiza los fixtures PNG a WebP responsive usando canvas de Chromium.
 * Genera variantes por ancho y reemplaza los originales. Correr una sola vez:
 *   npx playwright test tests/e2e/__vision__/optimize-fixtures.spec.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { test } from "@playwright/test";

const WIDTHS = [320, 640, 1024, 1536];
const FILES = [
  "modo-sur-hero",
  "modo-sur-remera",
  "modo-sur-jean",
  "modo-sur-camisa",
  "casa-luma-hero",
  "jarra-delta",
  "manta-bruma",
] as const;

test("optimizar fixtures a webp responsive", async ({ page }) => {
  test.setTimeout(120000);
  mkdirSync("apps/studio/public/fixtures/optimized", { recursive: true });
  for (const name of FILES) {
    const png = readFileSync(`apps/studio/public/fixtures/${name}.png`);
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
    const results = await page.evaluate(
      async ({ dataUrl, widths }) => {
        const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
        const out: Array<{ width: number; base64: string }> = [];
        for (const width of widths) {
          if (width > bitmap.width) continue;
          const canvas = new OffscreenCanvas(
            width,
            Math.round((bitmap.height / bitmap.width) * width),
          );
          const ctx = canvas.getContext("2d");
          ctx!.fillStyle = "#ffffff";
          ctx!.fillRect(0, 0, canvas.width, canvas.height);
          ctx!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.82 });
          const buffer = await blob.arrayBuffer();
          let binary = "";
          const bytes = new Uint8Array(buffer);
          for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
          out.push({ width, base64: btoa(binary) });
        }
        bitmap.close();
        return out;
      },
      { dataUrl, widths: WIDTHS },
    );
    for (const variant of results) {
      writeFileSync(
        `apps/studio/public/fixtures/optimized/${name}-${variant.width}.webp`,
        Buffer.from(variant.base64, "base64"),
      );
    }
  }
});
