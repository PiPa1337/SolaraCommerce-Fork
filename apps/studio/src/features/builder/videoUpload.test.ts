import { StoreProjectV1Schema, type VideoAsset } from "@solara/project-schema";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { describe, expect, it } from "vitest";
import {
  applyVideoToSection,
  buildVideoAsset,
  sectionSettingsWithVideo,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_DURATION_SECONDS,
} from "./videoUpload";

function fakeFile(overrides: Partial<File> = {}): File {
  return {
    name: "campana.mp4",
    type: "video/mp4",
    size: 1_024,
    arrayBuffer: async () => new ArrayBuffer(0),
    ...overrides,
  } as File;
}

const okMetadata = () => async () => ({
  width: 1080,
  height: 1920,
  duration: 8,
});

describe("buildVideoAsset", () => {
  it("rechaza formatos que no son MP4/WebM", async () => {
    await expect(
      buildVideoAsset(fakeFile({ type: "video/quicktime" }), {
        readMetadata: okMetadata(),
        readDataUrl: async () => "data:video/mp4;base64,AA==",
      }),
    ).rejects.toThrow("Sólo se aceptan videos MP4 o WebM.");
  });

  it("rechaza videos mayores a 30 MB", async () => {
    await expect(
      buildVideoAsset(fakeFile({ size: VIDEO_MAX_BYTES + 1 }), {
        readMetadata: okMetadata(),
        readDataUrl: async () => "data:video/mp4;base64,AA==",
      }),
    ).rejects.toThrow("supera los 30 MB");
  });

  it("rechaza duraciones fuera del rango 0-60 s", async () => {
    for (const duration of [0, -2, 61, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(
        buildVideoAsset(fakeFile(), {
          readMetadata: async () => ({ width: 1080, height: 1920, duration }),
          readDataUrl: async () => "data:video/mp4;base64,AA==",
        }),
      ).rejects.toThrow("0 y 60 segundos");
    }
    expect(VIDEO_MAX_DURATION_SECONDS).toBe(60);
  });

  it("construye el asset con hash, metadata y source", async () => {
    const asset = await buildVideoAsset(fakeFile({ name: "look-verano.mov" }), {
      hash: "abc123",
      readMetadata: okMetadata(),
      readDataUrl: async () => "data:video/mp4;base64,AA==",
    });
    expect(asset).toMatchObject({
      kind: "video",
      name: "look-verano",
      mimeType: "video/mp4",
      source: "data:video/mp4;base64,AA==",
      hash: "abc123",
      width: 1080,
      height: 1920,
      durationSeconds: 8,
    });
    expect(asset.id).toMatch(/^video-/);
  });
});

describe("applyVideoToSection", () => {
  it("agrega el video y apunta el setting en una sola actualización válida", () => {
    const project = catalogModernV2Store;
    const section = project.sections.find(
      (candidate) => candidate.moduleId === "catalog-hero" && candidate.enabled !== false,
    );
    expect(section).toBeDefined();
    const video: VideoAsset = {
      kind: "video",
      id: "video-atomic-test" as VideoAsset["id"],
      name: "look verano",
      alt: "",
      mimeType: "video/mp4",
      source: "data:video/mp4;base64,AA==",
      width: 1080,
      height: 1920,
      durationSeconds: 8,
      hash: "hash-atomic",
    };
    if (!section) throw new Error("Fixture sin hero");
    const next = applyVideoToSection(project, section.id, section.settings, "videoAssetId", video);
    expect(next.videos).toContainEqual(video);
    const nextSection = next.sections.find((candidate) => candidate.id === section.id);
    expect(nextSection?.settings.videoAssetId).toBe("video-atomic-test");
    expect(StoreProjectV1Schema.safeParse(next).success).toBe(true);
  });
});

describe("sectionSettingsWithVideo", () => {
  it("apunta el campo y pasa el modo a video cuando la sección tiene mode", () => {
    const settings = sectionSettingsWithVideo(
      { mode: "image", videoAssetId: "" },
      "videoAssetId",
      "video-1",
    );
    expect(settings).toEqual({ mode: "video", videoAssetId: "video-1" });
  });

  it("no inventa un setting mode si la sección no lo tiene", () => {
    const settings = sectionSettingsWithVideo({ videoAssetId: "" }, "videoAssetId", "video-1");
    expect(settings).toEqual({ videoAssetId: "video-1" });
  });
});
