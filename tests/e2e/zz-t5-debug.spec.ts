import { expect, test } from "@playwright/test";
import { startStudioServer, stopStudioServer } from "./studio-server";

test("debug boot error", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  const running = await startStudioServer();
  try {
    await page.goto(running.url);
    await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
      timeout: 30_000,
    });
  } catch {
    await page.waitForTimeout(1000);
    console.log("DEBUG-ERRORS:", JSON.stringify(problems, null, 2));
    console.log("DEBUG-BODY:", (await page.textContent("body")).slice(0, 400));
    throw new Error("boot failed; see DEBUG-ERRORS");
  }
  console.log("DEBUG-ERRORS:", JSON.stringify(problems, null, 2));
  await stopStudioServer(running.server);
});
