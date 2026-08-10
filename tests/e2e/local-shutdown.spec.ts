import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

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

test("el dashboard puede detener el servidor iniciado por el lanzador", async ({ page }) => {
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
    // El arranque del dashboard (lista + hash de tiendas + auditorías) tarda
    // más bajo la carga de la suite completa que aislado; tolerancia de 15 s.
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
      timeout: 15_000,
    });
    const closeButton = page.getByRole("button", { name: "Cerrar app" });
    await expect(closeButton).toBeVisible({ timeout: 15_000 });
    await closeButton.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Cerrar y detener" }).click();
    await expect(page.locator(".shutdown-status")).toContainText("Servidor local detenido");
    await expect.poll(() => serverProcess.exitCode, { timeout: 5_000 }).toBe(0);
  } finally {
    if (serverProcess.exitCode === null) serverProcess.kill();
  }
});

test("no ofrece detener servidores que no administra el lanzador", async ({ page }) => {
  const running = await startStudioServer();
  try {
    await page.goto(running.url);
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar app" })).toHaveCount(0);
  } finally {
    await stopStudioServer(running.server);
  }
});
