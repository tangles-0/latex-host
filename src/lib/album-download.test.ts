import { describe, expect, it } from "vitest";
import { albumMediaDownloadHref } from "@/lib/album-download";

describe("albumMediaDownloadHref", () => {
  it("returns a private media download URL", () => {
    expect(
      albumMediaDownloadHref({
        id: "file-1",
        kind: "image",
        baseName: "photo",
        ext: "jpg",
      }),
    ).toBe("/media/image/file-1/photo.jpg?download=true");
  });

  it("returns a shared album media download URL", () => {
    expect(
      albumMediaDownloadHref(
        {
          id: "file-1",
          kind: "document",
          baseName: "notes",
          ext: "pdf",
        },
        "share-1",
      ),
    ).toBe(
      "/share/album/share-1/media/document/file-1/notes.pdf?download=true",
    );
  });

  it("returns null for notes so they can be downloaded as markdown", () => {
    expect(
      albumMediaDownloadHref({
        id: "note-1",
        kind: "note",
        baseName: "idea",
        ext: "md",
      }),
    ).toBeNull();
  });
});
