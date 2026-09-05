import { describe, expect, test } from "vitest";

describe("optimizeProductVideoSource", () => {
  test("conserva original si ya es liviano", async () => {
    const { optimizeProductVideoSource } = await import("./productVideoOptimize.js");
    const file = { size: 900_000 } as File;
    const out = await optimizeProductVideoSource(file, { width: 640, height: 360, duration: 7 });
    expect(out).toBeUndefined();
  });

  test("fallback a original si MediaRecorder no disponible", async () => {
    const { optimizeProductVideoSource } = await import("./productVideoOptimize.js");
    const file = { size: 20_000_000 } as File;
    const out = await optimizeProductVideoSource(
      file,
      { width: 1920, height: 1080, duration: 12 },
      { mediaRecorderAvailable: false },
    );
    expect(out).toBeUndefined();
  });

  test("recomprime un video pesado con el target adaptativo", async () => {
    const { optimizeProductVideoSource } = await import("./productVideoOptimize.js");
    const file = { size: 20_000_000 } as File;
    const out = await optimizeProductVideoSource(
      file,
      { width: 1920, height: 1080, duration: 12 },
      {
        pickMimeType: () => "video/webm",
        transcode: async (_input, _metadata, target) => {
          expect(target).toEqual({ maxSide: 540, bitsPerSecond: 600_000 });
          return new Blob([new Uint8Array(900_000)], { type: "video/webm" });
        },
      },
    );
    expect(out).toMatchObject({ mimeType: "video/webm", width: 540, height: 304 });
    expect(out?.blob.size).toBe(900_000);
  });
});
