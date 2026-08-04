import { describe, expect, it } from "vitest";

import { isAllowedUploadType } from "./upload-allowlist";

describe("isAllowedUploadType", () => {
  it("allows unrestricted uploads when the allowlist is empty", () => {
    expect(isAllowedUploadType({ allowed: [], mimeType: "", ext: "ts" })).toBe(true);
  });

  it("matches exact and wildcard MIME types", () => {
    expect(isAllowedUploadType({ allowed: ["text/*"], mimeType: "text/x-python", ext: "py" })).toBe(true);
    expect(isAllowedUploadType({ allowed: ["application/json"], mimeType: "application/json", ext: "json" })).toBe(true);
    expect(isAllowedUploadType({ allowed: ["image/*"], mimeType: "application/json", ext: "json" })).toBe(false);
  });

  it("matches extension entries when MIME type is generic or missing", () => {
    expect(isAllowedUploadType({ allowed: [".ts"], mimeType: "application/octet-stream", ext: "ts" })).toBe(true);
    expect(isAllowedUploadType({ allowed: ["*.py"], mimeType: "", ext: ".py" })).toBe(true);
    expect(isAllowedUploadType({ allowed: [".rs"], mimeType: "text/plain", ext: "ts" })).toBe(false);
  });
});
