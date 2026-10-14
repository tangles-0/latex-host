import { describe, expect, it } from "vitest";
import { privacyVisualFor } from "@/lib/gallery-privacy";

describe("privacyVisualFor", () => {
  it("uses coloured shapes for images and movies", () => {
    expect(privacyVisualFor({ kind: "image", ext: "jpg" })).toBe("shapes");
    expect(privacyVisualFor({ kind: "video", ext: "mp4" })).toBe("shapes");
  });

  it("uses blurred text for notes, text files, and code", () => {
    expect(privacyVisualFor({ kind: "note", ext: "md" })).toBe("text");
    expect(
      privacyVisualFor({
        kind: "document",
        ext: "txt",
        mimeType: "text/plain",
      }),
    ).toBe("text");
    expect(
      privacyVisualFor({
        kind: "document",
        ext: "ts",
        mimeType: "text/plain",
      }),
    ).toBe("text");
    expect(
      privacyVisualFor({
        kind: "document",
        ext: "js",
        mimeType: "application/javascript",
      }),
    ).toBe("text");
  });

  it("uses a bare icon for archives and other binaries", () => {
    expect(
      privacyVisualFor({
        kind: "other",
        ext: "zip",
        mimeType: "application/zip",
      }),
    ).toBe("icon");
    expect(
      privacyVisualFor({
        kind: "document",
        ext: "pdf",
        mimeType: "application/pdf",
      }),
    ).toBe("icon");
    expect(
      privacyVisualFor({
        kind: "other",
        ext: "mp3",
        mimeType: "audio/mpeg",
      }),
    ).toBe("icon");
  });
});
