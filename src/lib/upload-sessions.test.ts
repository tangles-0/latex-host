import { describe, expect, it } from "vitest";
import { expectedPartSizeBytes, listMissingUploadPartNumbers, type UploadSessionEntry } from "@/lib/upload-sessions";

function buildSession(partNumbers: number[], totalParts = 5): Pick<UploadSessionEntry, "totalParts" | "uploadedParts"> {
  const uploadedParts = Object.fromEntries(partNumbers.map((partNumber) => [String(partNumber), `etag-${partNumber}`]));
  return {
    totalParts,
    uploadedParts,
  };
}

describe("listMissingUploadPartNumbers", () => {
  it("returns empty array when all parts are present", () => {
    expect(listMissingUploadPartNumbers(buildSession([1, 2, 3], 3))).toEqual([]);
  });

  it("returns gaps in upload parts", () => {
    expect(listMissingUploadPartNumbers(buildSession([1, 3, 5], 5))).toEqual([2, 4]);
  });

  it("ignores invalid part keys", () => {
    const session = buildSession([1, 3], 3);
    session.uploadedParts.NaN = "bad";
    session.uploadedParts["-1"] = "bad";
    expect(listMissingUploadPartNumbers(session)).toEqual([2]);
  });
});

describe("expectedPartSizeBytes", () => {
  it("uses chunk size for non-final parts", () => {
    const session = {
      totalParts: 3,
      chunkSize: 5,
      fileSize: 12,
      uploadedParts: {},
    };
    expect(expectedPartSizeBytes(session, 1)).toBe(5);
  });

  it("uses remaining bytes for final part", () => {
    const session = {
      totalParts: 3,
      chunkSize: 5,
      fileSize: 12,
      uploadedParts: {},
    };
    expect(expectedPartSizeBytes(session, 3)).toBe(2);
  });

  it("throws for out-of-range part numbers", () => {
    const session = {
      totalParts: 2,
      chunkSize: 5,
      fileSize: 10,
      uploadedParts: {},
    };
    expect(() => expectedPartSizeBytes(session, 0)).toThrow();
    expect(() => expectedPartSizeBytes(session, 3)).toThrow();
  });
});
