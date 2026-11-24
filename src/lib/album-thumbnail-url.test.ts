import { describe, expect, it } from "vitest";

import { parseAlbumThumbnailUrl } from "@/lib/album-thumbnail-url";

describe("parseAlbumThumbnailUrl", () => {
  it("accepts HTTP image URLs and normalizes them", () => {
    expect(
      parseAlbumThumbnailUrl(" https://cdn.example.com/thumb.png "),
    ).toEqual({
      url: "https://cdn.example.com/thumb.png",
    });
  });

  it("uses an empty value to remove the thumbnail", () => {
    expect(parseAlbumThumbnailUrl("")).toEqual({ url: null });
  });

  it("rejects unsafe URL schemes and credentials", () => {
    expect(parseAlbumThumbnailUrl("javascript:alert(1)").error).toBeTruthy();
    expect(
      parseAlbumThumbnailUrl("https://user:pass@example.com/thumb.png").error,
    ).toBeTruthy();
  });
});
