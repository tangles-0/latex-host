import { describe, expect, it } from "vitest";
import { parsePreviewStatusKind } from "@/app/api/media/preview-status/utils";

describe("parsePreviewStatusKind", () => {
  it("accepts allowed media kinds", () => {
    expect(parsePreviewStatusKind("image")).toBe("image");
    expect(parsePreviewStatusKind("video")).toBe("video");
    expect(parsePreviewStatusKind("document")).toBe("document");
    expect(parsePreviewStatusKind("other")).toBe("other");
  });

  it("rejects unsupported kinds", () => {
    expect(parsePreviewStatusKind("archive")).toBeNull();
    expect(parsePreviewStatusKind("")).toBeNull();
    expect(parsePreviewStatusKind(null)).toBeNull();
  });
});
