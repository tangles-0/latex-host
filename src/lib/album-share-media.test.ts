import { describe, expect, it } from "vitest";
import {
  albumShareMediaUrls,
  isAlbumShareLightboxTextItem,
  type AlbumShareMediaItem,
} from "@/lib/album-share-media";

const item = (
  overrides: Partial<AlbumShareMediaItem> &
    Pick<AlbumShareMediaItem, "kind" | "ext" | "mimeType">,
): AlbumShareMediaItem => ({
  id: "file-1",
  baseName: "sample",
  ...overrides,
});

describe("albumShareMediaUrls", () => {
  it("uses the original extension for image previews", () => {
    expect(
      albumShareMediaUrls(
        "share-1",
        item({
          kind: "image",
          ext: "jpg",
          mimeType: "image/jpeg",
        }),
      ),
    ).toEqual({
      fullUrl: "/share/album/share-1/media/image/file-1/sample.jpg",
      previewUrl: "/share/album/share-1/media/image/file-1/sample-lg.jpg",
    });
  });

  it("uses png previews for non-image files", () => {
    expect(
      albumShareMediaUrls(
        "share-1",
        item({
          kind: "document",
          ext: "pdf",
          mimeType: "application/pdf",
        }),
      ),
    ).toEqual({
      fullUrl: "/share/album/share-1/media/document/file-1/sample.pdf",
      previewUrl: "/share/album/share-1/media/document/file-1/sample-lg.png",
    });
  });
});

describe("isAlbumShareLightboxTextItem", () => {
  it("treats notes and editable text documents as text", () => {
    expect(
      isAlbumShareLightboxTextItem(
        item({
          kind: "note",
          ext: "md",
          mimeType: "text/markdown",
        }),
      ),
    ).toBe(true);
    expect(
      isAlbumShareLightboxTextItem(
        item({
          kind: "document",
          ext: "ts",
          mimeType: "text/plain",
        }),
      ),
    ).toBe(true);
  });

  it("does not treat PDFs or binaries as text", () => {
    expect(
      isAlbumShareLightboxTextItem(
        item({
          kind: "document",
          ext: "pdf",
          mimeType: "application/pdf",
        }),
      ),
    ).toBe(false);
    expect(
      isAlbumShareLightboxTextItem(
        item({
          kind: "other",
          ext: "zip",
          mimeType: "application/zip",
        }),
      ),
    ).toBe(false);
  });
});
