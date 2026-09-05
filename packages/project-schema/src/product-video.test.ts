import { describe, expect, test } from "vitest";
import {
  isProductVideoLightEnough,
  PRODUCT_VIDEO_MAX_BYTES,
  PRODUCT_VIDEO_MAX_COUNT,
  PRODUCT_VIDEO_TARGET_BYTES,
  productVideoIds,
} from "./product-video.js";

describe("product-video", () => {
  test("topes 2MB/1MB y máx 3", () => {
    expect(PRODUCT_VIDEO_MAX_COUNT).toBe(3);
    expect(PRODUCT_VIDEO_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(PRODUCT_VIDEO_TARGET_BYTES).toBe(1 * 1024 * 1024);
  });

  test("limita a 3 y filtra inexistentes", () => {
    const product = { videoIds: ["v-1", "v-2", "v-3", "v-4"] } as never;
    const project = { videos: [{ id: "v-1" }, { id: "v-2" }] } as never;
    expect(productVideoIds(product, project)).toEqual(["v-1", "v-2"]);
  });

  test("liviano sólo si ≤2MB y ≤720p", () => {
    expect(isProductVideoLightEnough({ size: 1_000_000, width: 640, height: 360 })).toBe(
      true,
    );
    expect(isProductVideoLightEnough({ size: 5_000_000, width: 640, height: 360 })).toBe(
      false,
    );
    expect(isProductVideoLightEnough({ size: 1_000_000, width: 1920, height: 1080 })).toBe(
      false,
    );
  });
});
