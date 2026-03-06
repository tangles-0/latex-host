import { describe, expect, it } from "vitest";
import { parseByteRange, parseShareFileName } from "@/app/share/share-route-utils";

describe("parseShareFileName", () => {
  it("parses original file links", () => {
    expect(parseShareFileName("AbC123.jpg")).toEqual({
      code: "AbC123",
      size: "original",
      ext: "jpg",
    });
  });

  it("parses suffix variants", () => {
    expect(parseShareFileName("hash-sm.png")?.size).toBe("sm");
    expect(parseShareFileName("hash-lg.png")?.size).toBe("lg");
    expect(parseShareFileName("hash-640.png")?.size).toBe("x640");
  });

  it("rejects album style links", () => {
    expect(parseShareFileName("albumCodeOnly")).toBeNull();
  });

  it("rejects malformed names", () => {
    expect(parseShareFileName("bad name.png")).toBeNull();
    expect(parseShareFileName("no-ext")).toBeNull();
  });
});

describe("parseByteRange", () => {
  it("parses explicit start/end", () => {
    expect(parseByteRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
  });

  it("parses open-ended ranges", () => {
    expect(parseByteRange("bytes=100-", 1000)).toEqual({ start: 100, end: 999 });
  });

  it("parses suffix ranges", () => {
    expect(parseByteRange("bytes=-200", 1000)).toEqual({ start: 800, end: 999 });
  });

  it("clamps end past file length", () => {
    expect(parseByteRange("bytes=800-5000", 1000)).toEqual({ start: 800, end: 999 });
  });

  it("rejects invalid ranges", () => {
    expect(parseByteRange("bytes=-0", 1000)).toBeNull();
    expect(parseByteRange("bytes=500-100", 1000)).toBeNull();
    expect(parseByteRange("bytes=1000-1001", 1000)).toBeNull();
    expect(parseByteRange("items=1-2", 1000)).toBeNull();
  });
});
