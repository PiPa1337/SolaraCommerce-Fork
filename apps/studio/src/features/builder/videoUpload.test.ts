import { type ImageAsset, StoreProjectV1Schema, type VideoAsset } from "@solara/project-schema";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { describe, expect, it } from "vitest";
import {
  applyVideoPoster,
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
    const built = await buildVideoAsset(fakeFile({ name: "look-verano.mov" }), {
      hash: "abc123",
      readMetadata: okMetadata(),
      readDataUrl: async () => "data:video/mp4;base64,AA==",
      extractPoster: async () => undefined,
    });
    expect(built.video).toMatchObject({
      kind: "video",
      name: "look-verano",
      mimeType: "video/mp4",
      source: "data:video/mp4;base64,AA==",
      hash: "abc123",
      width: 1080,
      height: 1920,
      durationSeconds: 8,
    });
    expect(built.video.id).toMatch(/^video-/);
    expect(built.posterImage).toBeUndefined();
  });

  it("genera el poster a baja resolución y lo asocia al video", async () => {
    const built = await buildVideoAsset(fakeFile(), {
      hash: "abc123",
      readMetadata: okMetadata(),
      readDataUrl: async () => "data:video/mp4;base64,AA==",
      extractPoster: async () => ({
        source: "data:image/webp;base64,UE9TVEVS",
        width: 360,
        height: 640,
      }),
    });
    expect(built.posterImage).toMatchObject({
      kind: "image",
      name: "campana (preload)",
      mimeType: "image/webp",
      source: "data:image/webp;base64,UE9TVEVS",
      width: 360,
      height: 640,
    });
    expect(built.posterImage?.id).toMatch(/^asset-/);
    expect(built.video.posterAssetId).toBe(built.posterImage?.id);
  });

  it("no bloquea la subida si el poster falla", async () => {
    const built = await buildVideoAsset(fakeFile(), {
      hash: "abc123",
      readMetadata: okMetadata(),
      readDataUrl: async () => "data:video/mp4;base64,AA==",
      extractPoster: async () => {
        throw new Error("codec no soportado");
      },
    });
    expect(built.video).toBeDefined();
    expect(built.posterImage).toBeUndefined();
    expect(built.video.posterAssetId).toBeUndefined();
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

  it("incluye el poster automático en los assets del proyecto", () => {
    const project = catalogModernV2Store;
    const section = project.sections.find(
      (candidate) => candidate.moduleId === "catalog-hero" && candidate.enabled !== false,
    );
    if (!section) throw new Error("Fixture sin hero");
    const video: VideoAsset = {
      kind: "video",
      id: "video-poster-test" as VideoAsset["id"],
      name: "look",
      alt: "",
      mimeType: "video/mp4",
      source: "data:video/mp4;base64,AA==",
      width: 1080,
      height: 1920,
      durationSeconds: 8,
      hash: "hash-poster",
      posterAssetId: "asset-poster-test" as VideoAsset["id"],
    };
    const poster: ImageAsset = {
      kind: "image",
      id: "asset-poster-test" as ImageAsset["id"],
      name: "look (preload)",
      alt: "Preload de look",
      mimeType: "image/webp",
      source: "data:image/webp;base64,UE9TVEVS",
      width: 360,
      height: 640,
      hash: "hash-poster-image",
    };
    const next = applyVideoToSection(
      project,
      section.id,
      section.settings,
      "videoAssetId",
      video,
      poster,
    );
    expect(next.assets).toContainEqual(poster);
    expect(next.videos).toContainEqual(video);
    expect(StoreProjectV1Schema.safeParse(next).success).toBe(true);
  });

  it("re-subir el mismo video reemplaza el poster viejo por el nuevo", () => {
    const project = structuredClone(catalogModernV2Store);
    const oldPoster: ImageAsset = {
      kind: "image",
      id: "asset-poster-viejo" as ImageAsset["id"],
      name: "look (preload)",
      alt: "",
      mimeType: "image/jpeg",
      source: "data:image/jpeg;base64,QU5USUdVQQ==",
      width: 360,
      height: 640,
      hash: "poster-viejo",
    };
    const video: VideoAsset = {
      kind: "video",
      id: "video-refresh-test" as VideoAsset["id"],
      name: "look",
      alt: "",
      mimeType: "video/mp4",
      source: "data:video/mp4;base64,AA==",
      width: 1080,
      height: 1920,
      durationSeconds: 8,
      hash: "hash-refresh",
      posterAssetId: oldPoster.id,
    };
    project.assets = [...project.assets, oldPoster];
    project.videos = [video];

    const newPoster: ImageAsset = {
      kind: "image",
      id: "asset-poster-nuevo" as ImageAsset["id"],
      name: "look (preload)",
      alt: "",
      mimeType: "image/webp",
      source: "data:image/webp;base64,UFJJTUVSQV9GUkFNRQ==",
      width: 360,
      height: 640,
      hash: "poster-nuevo",
    };
    const next = applyVideoPoster(project, video.id, newPoster);
    expect(next.videos.find((candidate) => candidate.id === video.id)?.posterAssetId).toBe(
      newPoster.id,
    );
    expect(next.assets).toContainEqual(newPoster);
    expect(next.assets.some((asset) => asset.id === oldPoster.id)).toBe(false);
    expect(StoreProjectV1Schema.safeParse(next).success).toBe(true);
  });
});

describe("sectionSettingsWithVideo", () => {
  it("apunta el campo y pasa el modo a video cuando la sección tiene mode", () => {
    const settings = sectionSettingsWithVideo(
      { mode: "image", videoAssetId: "", autoplay: false, posterAssetId: "asset-hero" },
      "videoAssetId",
      "video-1",
    );
    expect(settings).toEqual({
      mode: "video",
      videoAssetId: "video-1",
      autoplay: true,
      posterAssetId: "",
    });
  });

  it("no inventa un setting mode si la sección no lo tiene", () => {
    const settings = sectionSettingsWithVideo({ videoAssetId: "" }, "videoAssetId", "video-1");
    expect(settings).toEqual({ videoAssetId: "video-1" });
  });
});
