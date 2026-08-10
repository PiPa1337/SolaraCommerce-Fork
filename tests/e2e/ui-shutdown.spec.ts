import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

async function findFreePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolveListening, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => resolveListening());
  });
  const address = probe.address();
  await new Promise<void>((resolveClosing, reject) => {
    probe.close((error) => (error ? reject(error) : resolveClosing()));
  });
  if (!address || typeof address === "string") throw new Error("No se pudo reservar un puerto.");
  return address.port;
}

async function waitForServer(url: string): Promise<void> {
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(url)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 8_000, intervals: [100, 250, 500] },
    )
    .toBe(200);
}

test("H7-B1: «Cerrar app» desaparece en estado terminal y el banner persiste", async ({ page }) => {
  const port = await findFreePort();
  const token = randomBytes(24).toString("base64url");
  const url = `http://127.0.0.1:${port}`;
  const serverProcess = spawn(
    process.execPath,
    ["packages/exporter/scripts/serve.mjs", resolve("apps/studio/dist"), String(port), token],
    { cwd: resolve("."), stdio: "ignore" },
  );

  try {
    await waitForServer(url);
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
      timeout: 15_000,
    });
    const closeButton = page.getByRole("button", { name: "Cerrar app" });
    await expect(closeButton).toBeVisible({ timeout: 15_000 });

    // Cierre confirmado: el proceso muere y App marca el estado terminal.
    await closeButton.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Cerrar y detener" }).click();
    await expect(page.locator(".shutdown-status")).toContainText("Servidor local detenido");
    await expect.poll(() => serverProcess.exitCode, { timeout: 5_000 }).toBe(0);

    // Lado App (F3): el control «Cerrar app» desaparece pese a que
    // sessionManaged sigue en true, y el banner persiste.
    await expect(page.getByRole("button", { name: "Cerrar app" })).toHaveCount(0);
    await expect(page.locator(".shutdown-status")).toContainText("Servidor local detenido");

    // Segundo intento de cierre: no-op — no reabre el diálogo ni revive el banner.
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("solara:open-shutdown"));
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cerrar app" })).toHaveCount(0);
    await expect(page.locator(".shutdown-status")).toContainText("Servidor local detenido");
  } finally {
    if (serverProcess.exitCode === null) serverProcess.kill();
  }
});
