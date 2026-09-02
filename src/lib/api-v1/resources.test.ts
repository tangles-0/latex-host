import { describe, expect, it } from "vitest";
import {
  buildAbsoluteShareUrls,
  buildSharePaths,
  buildShareUrlsFromPrefix,
  toFileResource,
} from "@/lib/api-v1/resources";
import type { MediaEntry } from "@/lib/media-store";

function imageEntry(overrides?: Partial<MediaEntry>): MediaEntry {
  return {
    id: "img-1",
    kind: "image",
    baseName: "2026-01-01T00-00-00-000Z-abc123",
    ext: "jpg",
    mimeType: "image/jpeg",
    albumOrder: 0,
    width: 2000,
    height: 1500,
    sizeOriginal: 1000,
    sizeSm: 200,
    sizeLg: 400,
    previewStatus: "complete",
    uploadedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildSharePaths", () => {
  it("adds a 512 constrained path for raster images", () => {
    expect(buildSharePaths("image", "AbC123", "jpg")).toEqual({
      original: "/share/AbC123.jpg",
      sm: "/share/AbC123-sm.jpg",
      lg: "/share/AbC123-lg.jpg",
      x512: "/share/AbC123-512.jpg",
    });
  });

  it("omits the 512 path for SVG images", () => {
    expect(buildSharePaths("image", "AbC123", "svg")).toEqual({
      original: "/share/AbC123.svg",
      sm: "/share/AbC123-sm.svg",
      lg: "/share/AbC123-lg.svg",
    });
  });

  it("omits the 512 path for non-images", () => {
    expect(buildSharePaths("video", "AbC123", "mp4").x512).toBeUndefined();
  });
});

describe("toFileResource", () => {
  it("includes constrained share URL when public", () => {
    const resource = toFileResource({
      media: imageEntry(),
      sharePrefix: "https://example.test/share",
      visibility: "public",
      shareCode: "AbC123",
    });
    expect(resource.shareUrl).toBe("https://example.test/share/AbC123.jpg");
    expect(resource.shareUrls).toEqual({
      original: "https://example.test/share/AbC123.jpg",
      sm: "https://example.test/share/AbC123-sm.jpg",
      lg: "https://example.test/share/AbC123-lg.jpg",
      x512: "https://example.test/share/AbC123-512.jpg",
    });
  });

  it("removes all share URLs when private", () => {
    const resource = toFileResource({
      media: imageEntry(),
      sharePrefix: "https://example.test/share",
      visibility: "private",
      shareCode: null,
    });
    expect(resource.shareUrl).toBeNull();
    expect(resource.shareUrls).toBeNull();
  });
});

describe("buildAbsoluteShareUrls", () => {
  it("makes constrained URLs absolute", () => {
    const urls = buildAbsoluteShareUrls(
      "https://example.test",
      "image",
      "AbC123",
      "png",
    );
    expect(urls.x512).toBe("https://example.test/share/AbC123-512.png");
  });

  it("supports a node-prefixed latex.gg share path", () => {
    expect(
      buildShareUrlsFromPrefix(
        "https://latex.gg/share/n1",
        "video",
        "AbC123",
        "mp4",
      ),
    ).toEqual({
      original: "https://latex.gg/share/n1/AbC123.mp4",
      sm: "https://latex.gg/share/n1/AbC123-sm.png",
      lg: "https://latex.gg/share/n1/AbC123-lg.png",
    });
  });
});
