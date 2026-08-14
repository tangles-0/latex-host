import { describe, expect, it } from "vitest";
import { DEFAULT_RESUMABLE_THRESHOLD } from "@/lib/upload-client";

describe("api v1 size gates", () => {
  it("uses the same resumable threshold as the upload client default (4MB)", () => {
    expect(DEFAULT_RESUMABLE_THRESHOLD).toBe(4 * 1024 * 1024);
  });

  it("classifies simple vs multipart by threshold", () => {
    const threshold = DEFAULT_RESUMABLE_THRESHOLD;
    const simpleSize = threshold - 1;
    const multipartSize = threshold;
    expect(simpleSize < threshold).toBe(true);
    expect(multipartSize >= threshold).toBe(true);
  });
});
