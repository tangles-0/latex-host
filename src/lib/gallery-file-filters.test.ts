import { describe, expect, it } from "vitest";
import {
  applyGalleryFileFilters,
  galleryFileTypeFor,
} from "@/lib/gallery-file-filters";

describe("galleryFileTypeFor", () => {
  it("maps stored kinds and notes", () => {
    expect(galleryFileTypeFor({ kind: "image", ext: "jpg" })).toBe("image");
    expect(galleryFileTypeFor({ kind: "video", ext: "mp4" })).toBe("video");
    expect(galleryFileTypeFor({ kind: "note", ext: "md" })).toBe("text");
  });

  it("splits documents into text vs office/pdf", () => {
    expect(
      galleryFileTypeFor({ kind: "document", ext: "txt", mimeType: "text/plain" }),
    ).toBe("text");
    expect(
      galleryFileTypeFor({
        kind: "document",
        ext: "md",
        mimeType: "text/markdown",
      }),
    ).toBe("text");
    expect(
      galleryFileTypeFor({
        kind: "document",
        ext: "js",
        mimeType: "application/javascript",
      }),
    ).toBe("text");
    expect(
      galleryFileTypeFor({
        kind: "document",
        ext: "pdf",
        mimeType: "application/pdf",
      }),
    ).toBe("document");
    expect(
      galleryFileTypeFor({
        kind: "document",
        ext: "docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toBe("document");
  });

  it("splits other files into audio, archives, and binaries", () => {
    expect(
      galleryFileTypeFor({ kind: "other", ext: "mp3", mimeType: "audio/mpeg" }),
    ).toBe("audio");
    expect(
      galleryFileTypeFor({ kind: "other", ext: "wav", mimeType: "audio/wav" }),
    ).toBe("audio");
    expect(
      galleryFileTypeFor({ kind: "other", ext: "zip", mimeType: "application/zip" }),
    ).toBe("archive");
    expect(
      galleryFileTypeFor({
        kind: "other",
        ext: "tar.gz",
        mimeType: "application/gzip",
      }),
    ).toBe("archive");
    expect(
      galleryFileTypeFor({
        kind: "other",
        ext: "so",
        mimeType: "application/octet-stream",
      }),
    ).toBe("binary");
    expect(
      galleryFileTypeFor({
        kind: "other",
        ext: "appimage",
        mimeType: "application/octet-stream",
      }),
    ).toBe("binary");
  });
});

describe("applyGalleryFileFilters", () => {
  const items = [
    {
      id: "a",
      kind: "image" as const,
      ext: "jpg",
      originalFileName: "zeta.jpg",
      uploadedAt: "2026-09-15T00:00:00.000Z",
      sizeOriginal: 100,
      shared: true,
    },
    {
      id: "b",
      kind: "other" as const,
      ext: "mp3",
      mimeType: "audio/mpeg",
      originalFileName: "alpha.mp3",
      uploadedAt: "2026-09-12T00:00:00.000Z",
      sizeOriginal: 900,
      shared: false,
    },
    {
      id: "c",
      kind: "note" as const,
      ext: "md",
      originalFileName: "notes.md",
      uploadedAt: "2026-09-14T00:00:00.000Z",
      sizeOriginal: 12,
      shared: false,
    },
  ];

  it("filters by file type, including notes as text", () => {
    expect(
      applyGalleryFileFilters(items, {
        typeFilter: "text",
        shareFilter: "all",
        sort: "newest",
      }).map((item) => item.id),
    ).toEqual(["c"]);
    expect(
      applyGalleryFileFilters(items, {
        typeFilter: "audio",
        shareFilter: "all",
        sort: "newest",
      }).map((item) => item.id),
    ).toEqual(["b"]);
  });

  it("filters by shared status", () => {
    expect(
      applyGalleryFileFilters(items, {
        typeFilter: "all",
        shareFilter: "shared",
        sort: "newest",
      }).map((item) => item.id),
    ).toEqual(["a"]);
    expect(
      applyGalleryFileFilters(items, {
        typeFilter: "all",
        shareFilter: "private",
        sort: "newest",
      }).map((item) => item.id),
    ).toEqual(["c", "b"]);
  });

  it("sorts by newest, name, and size", () => {
    expect(
      applyGalleryFileFilters(items, {
        typeFilter: "all",
        shareFilter: "all",
        sort: "newest",
      }).map((item) => item.id),
    ).toEqual(["a", "c", "b"]);
    expect(
      applyGalleryFileFilters(items, {
        typeFilter: "all",
        shareFilter: "all",
        sort: "name",
      }).map((item) => item.id),
    ).toEqual(["b", "c", "a"]);
    expect(
      applyGalleryFileFilters(items, {
        typeFilter: "all",
        shareFilter: "all",
        sort: "size",
      }).map((item) => item.id),
    ).toEqual(["b", "a", "c"]);
  });
});
