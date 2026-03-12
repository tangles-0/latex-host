import { describe, expect, it } from "vitest";
import { isAsyncPreviewKind, isWorkerIngestAuthorized } from "@/lib/preview-worker";

describe("isAsyncPreviewKind", () => {
  it("accepts supported kinds", () => {
    expect(isAsyncPreviewKind("video")).toBe(true);
    expect(isAsyncPreviewKind("document")).toBe(true);
    expect(isAsyncPreviewKind("other")).toBe(true);
  });

  it("rejects unsupported kinds", () => {
    expect(isAsyncPreviewKind("image")).toBe(false);
    expect(isAsyncPreviewKind("note")).toBe(false);
    expect(isAsyncPreviewKind("archive")).toBe(false);
  });
});

describe("isWorkerIngestAuthorized", () => {
  it("rejects requests when secret is missing", () => {
    delete process.env.PREVIEW_WORKER_INGEST_SECRET;
    const request = new Request("http://localhost");
    expect(isWorkerIngestAuthorized(request)).toBe(false);
  });

  it("accepts bearer token", () => {
    process.env.PREVIEW_WORKER_INGEST_SECRET = "secret";
    const request = new Request("http://localhost", {
      headers: { Authorization: "Bearer secret" },
    });
    expect(isWorkerIngestAuthorized(request)).toBe(true);
  });

  it("accepts x-worker-ingest-token header", () => {
    process.env.PREVIEW_WORKER_INGEST_SECRET = "secret";
    const request = new Request("http://localhost", {
      headers: { "x-worker-ingest-token": "secret" },
    });
    expect(isWorkerIngestAuthorized(request)).toBe(true);
  });
});
