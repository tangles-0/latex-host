import { describe, expect, it } from "vitest";
import { mergePreviewStatus, reconcileGalleryMedia } from "@/lib/gallery-media";

const item = (
  id: string,
  uploadedAt: string,
  previewStatus?: "pending" | "started" | "complete" | "error",
) => ({
  id,
  uploadedAt,
  previewStatus,
});

describe("mergePreviewStatus", () => {
  it("does not regress a completed local preview", () => {
    expect(mergePreviewStatus("complete", "pending")).toBe("complete");
  });

  it("accepts a completed incoming preview", () => {
    expect(mergePreviewStatus("pending", "complete")).toBe("complete");
  });
});

describe("reconcileGalleryMedia", () => {
  it("returns the incoming list when it already contains every local item", () => {
    const local = [item("a", "2026-08-31T01:00:00.000Z")];
    const incoming = [
      item("b", "2026-08-31T02:00:00.000Z"),
      item("a", "2026-08-31T01:00:00.000Z"),
    ];

    expect(reconcileGalleryMedia(local, incoming)).toBe(incoming);
  });

  it("keeps a just-uploaded local item that a stale refresh omitted", () => {
    const uploaded = item("new", "2026-08-31T03:00:00.000Z", "pending");
    const older = item("old", "2026-08-31T01:00:00.000Z", "complete");

    expect(reconcileGalleryMedia([uploaded, older], [older])).toEqual([uploaded, older]);
  });

  it("adds a server item that the client has not seen yet", () => {
    const older = item("old", "2026-08-31T01:00:00.000Z", "complete");
    const generated = item("gen", "2026-08-31T03:00:00.000Z", "pending");

    expect(reconcileGalleryMedia([older], [generated, older])).toEqual([generated, older]);
  });

  it("keeps a more advanced local preview status when the refresh is behind", () => {
    const local = [item("a", "2026-08-31T01:00:00.000Z", "complete")];
    const incoming = [item("a", "2026-08-31T01:00:00.000Z", "pending")];

    expect(reconcileGalleryMedia(local, incoming)).toEqual([
      item("a", "2026-08-31T01:00:00.000Z", "complete"),
    ]);
  });
});
