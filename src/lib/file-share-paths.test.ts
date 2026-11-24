import { describe, expect, it } from "vitest";

import {
  buildFileSharePathEntries,
  buildFileShareUrls,
  normalizePublicShareFileName,
} from "@/lib/file-share-paths";

describe("filename share paths", () => {
  it("uses the original filename and reserves all image variants", () => {
    const fileName = normalizePublicShareFileName({
      originalFileName: "A photo.jpg",
      baseName: "generated",
      ext: "jpg",
    });
    expect(buildFileSharePathEntries("image", fileName)).toEqual([
      { path: "A photo.jpg", size: "original" },
      { path: "A photo-sm.jpg", size: "sm" },
      { path: "A photo-lg.jpg", size: "lg" },
      { path: "A photo-640.jpg", size: "x640" },
      { path: "A photo-512.jpg", size: "x512" },
    ]);
  });

  it("uses png previews for non-image files and URL-encodes each path", () => {
    expect(buildFileShareUrls("/file", "other", "some file.zip")).toEqual({
      original: "/file/some%20file.zip",
      sm: "/file/some%20file-sm.png",
      lg: "/file/some%20file-lg.png",
    });
  });

  it("removes path separators and restores a missing extension", () => {
    expect(
      normalizePublicShareFileName({
        originalFileName: "../release",
        baseName: "generated",
        ext: "tar.gz",
      }),
    ).toBe("..-release.tar.gz");
  });
});
