import { describe, expect, it } from "vitest";
import { listedOpenApiPaths } from "@/lib/api-v1/openapi";

describe("api v1 openapi", () => {
  it("documents the expected v1 paths", () => {
    const paths = listedOpenApiPaths();
    for (const required of [
      "/api/v1",
      "/api/v1/files",
      "/api/v1/files/{id}",
      "/api/v1/files/{id}/content",
      "/api/v1/files/{id}/share",
      "/api/v1/uploads",
      "/api/v1/uploads/{id}",
      "/api/v1/uploads/{id}/parts/{partNumber}",
      "/api/v1/uploads/{id}/complete",
      "/api/v1/uploads/{id}/abort",
      "/api/v1/notes",
      "/api/v1/notes/{id}",
      "/api/v1/notes/{id}/share",
      "/api/v1/albums",
      "/api/v1/docs",
      "/api/v1/openapi.json",
    ]) {
      expect(paths).toContain(required);
    }
  });
});
