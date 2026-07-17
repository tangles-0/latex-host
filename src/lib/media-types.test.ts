import { describe, expect, it } from "vitest";
import {
  contentTypeForExt,
  extFromFileName,
  parseSizedFileName,
  splitFileName,
} from "@/lib/media-types";

describe("extFromFileName", () => {
  it("keeps compound archive extensions", () => {
    expect(extFromFileName("backup.tar.gz")).toBe("tar.gz");
    expect(extFromFileName("BACKUP.TAR.BZ2")).toBe("tar.bz2");
    expect(extFromFileName("logs.tar.xz")).toBe("tar.xz");
    expect(extFromFileName("data.tar.zst")).toBe("tar.zst");
  });

  it("still returns simple extensions", () => {
    expect(extFromFileName("photo.jpg")).toBe("jpg");
    expect(extFromFileName("archive.zip")).toBe("zip");
    expect(extFromFileName("plain.tar")).toBe("tar");
    expect(extFromFileName("alone.gz")).toBe("gz");
  });

  it("returns empty when there is no extension", () => {
    expect(extFromFileName("README")).toBe("");
  });
});

describe("splitFileName", () => {
  it("splits compound archive names without dropping tar", () => {
    expect(splitFileName("backup.tar.gz")).toEqual({
      stem: "backup",
      ext: "tar.gz",
    });
  });
});

describe("parseSizedFileName", () => {
  it("parses compound archive originals", () => {
    expect(parseSizedFileName("2026-01-01T00-00-00-000Z-abc123.tar.gz")).toEqual({
      baseName: "2026-01-01T00-00-00-000Z-abc123",
      size: "original",
      ext: "tar.gz",
    });
  });

  it("parses preview variants with simple extensions", () => {
    expect(parseSizedFileName("uuid-sm.png")).toEqual({
      baseName: "uuid",
      size: "sm",
      ext: "png",
    });
    expect(parseSizedFileName("uuid-lg.png")).toEqual({
      baseName: "uuid",
      size: "lg",
      ext: "png",
    });
  });

  it("parses x640 when allowed", () => {
    expect(parseSizedFileName("uuid-640.png", { allowX640: true })).toEqual({
      baseName: "uuid",
      size: "x640",
      ext: "png",
    });
  });
});

describe("contentTypeForExt", () => {
  it("maps compound archive extensions", () => {
    expect(contentTypeForExt("tar.gz")).toBe("application/gzip");
    expect(contentTypeForExt("tar.bz2")).toBe("application/x-bzip2");
  });
});
