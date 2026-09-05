import { describe, expect, test } from "vitest";
import { selectGalleryMedia } from "./gallery-media.js";

interface FakeVideo {
  paused: boolean;
  pause(): void;
}

interface FakeFigure {
  dataset: Record<string, string | undefined>;
  videos: FakeVideo[];
  querySelectorAll(selector: string): FakeVideo[];
}

interface FakeThumb {
  dataset: Record<string, string | undefined>;
  attributes: Record<string, string>;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | undefined;
}

interface FakeRoot {
  figures: FakeFigure[];
  thumbs: FakeThumb[];
  querySelectorAll(selector: string): FakeFigure[] | FakeThumb[];
}

function fakeVideo(): FakeVideo {
  return {
    paused: false,
    pause() {
      this.paused = true;
    },
  };
}

function fakeFigure(mediaId: string, kind: "image" | "video", active: boolean): FakeFigure {
  return {
    dataset: {
      galleryMediaId: mediaId,
      ...(kind === "image" ? { galleryImageId: mediaId } : {}),
      galleryActive: String(active),
    },
    videos: kind === "video" ? [fakeVideo()] : [],
    querySelectorAll(selector: string) {
      return selector === "video" ? this.videos : [];
    },
  };
}

function fakeThumb(mediaId: string, current: boolean): FakeThumb {
  return {
    dataset: { galleryThumb: mediaId },
    attributes: { "aria-current": String(current) },
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    },
    getAttribute(name: string) {
      return this.attributes[name];
    },
  };
}

function fakeRoot(): { root: FakeRoot; figures: FakeFigure[]; thumbs: FakeThumb[] } {
  const figures = [fakeFigure("img-1", "image", true), fakeFigure("vid-1", "video", false)];
  const thumbs = [fakeThumb("img-1", true), fakeThumb("vid-1", false)];
  const root: FakeRoot = {
    figures,
    thumbs,
    querySelectorAll(selector: string) {
      if (selector.includes("gallery-media-id")) return this.figures;
      return this.thumbs;
    },
  };
  return { root, figures, thumbs };
}

describe("galería con video", () => {
  test("cambia a video, pausa ocultos y actualiza aria-current", () => {
    const { root, figures, thumbs } = fakeRoot();
    selectGalleryMedia(root as unknown as HTMLElement, "vid-1");
    expect(figures[1]?.dataset.galleryActive).toBe("true");
    expect(figures[0]?.dataset.galleryActive).toBe("false");
    expect(thumbs[1]?.getAttribute("aria-current")).toBe("true");
    expect(thumbs[0]?.getAttribute("aria-current")).toBe("false");
  });

  test("id desconocido cae al primero sin romper", () => {
    const { root, figures } = fakeRoot();
    selectGalleryMedia(root as unknown as HTMLElement, "nope");
    expect(figures[0]?.dataset.galleryActive).toBe("true");
  });

  test("sin figuras no hace nada", () => {
    const root: FakeRoot = {
      figures: [],
      thumbs: [],
      querySelectorAll() {
        return [];
      },
    };
    expect(() =>
      selectGalleryMedia(root as unknown as HTMLElement, "vid-1"),
    ).not.toThrow();
  });
});
