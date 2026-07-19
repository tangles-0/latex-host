import { describe, expect, it } from "vitest";
import {
  downloadFileNameForMedia,
  resolveDownloadFileName,
} from "@/lib/download-file-name";

describe("downloadFileNameForMedia", () => {
  it("prefers the set file name over storage base name", () => {
    expect(
      downloadFileNameForMedia({
        originalFileName: "Quarterly Report.pdf",
        baseName: "2026-01-01T00-00-00-000Z-abc123",
        ext: "pdf",
      }),
    ).toBe("Quarterly Report.pdf");
  });

  it("keeps compound archive extensions on preferred names", () => {
    expect(
      downloadFileNameForMedia({
        originalFileName: "backup.tar.gz",
        baseName: "2026-01-01T00-00-00-000Z-abc123",
        ext: "tar.gz",
      }),
    ).toBe("backup.tar.gz");
  });

  it("falls back to baseName.ext when no original name is set", () => {
    expect(
      downloadFileNameForMedia({
        baseName: "2026-01-01T00-00-00-000Z-abc123",
        ext: "zip",
      }),
    ).toBe("2026-01-01T00-00-00-000Z-abc123.zip");
  });
});

describe("resolveDownloadFileName", () => {
  it("appends the response extension when preferred name lacks it", () => {
    expect(
      resolveDownloadFileName({
        requestedFileName: "hash.zip",
        preferredFileName: "archive",
        requestedSize: "original",
        responseExt: "zip",
      }),
    ).toBe("archive.zip");
  });
});
