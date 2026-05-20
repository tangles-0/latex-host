import { describe, expect, it } from "vitest";
import {
  isAsyncPreviewKind,
  isWorkerIngestAuthorized,
} from "@/lib/preview-worker";

describe("isAsyncPreviewKind", () => {
  it("accepts supported kinds", () => {
    expect(isAsyncPreviewKind("image")).toBe(true);
    expect(isAsyncPreviewKind("video")).toBe(true);
    expect(isAsyncPreviewKind("document")).toBe(true);
  });

  it("rejects unsupported kinds", () => {
    expect(isAsyncPreviewKind("other")).toBe(false);
    expect(isAsyncPreviewKind("note")).toBe(false);
    expect(isAsyncPreviewKind("archive")).toBe(false);
  });
});

describe("isWorkerIngestAuthorized", () => {
  it("rejects requests when secret is missing", () => {
    delete process.env.PREVIEW_WORKER_INGEST_SECRET;
    delete process.env.LATEX_INCOMING_API_SECRET_KEY;
    const request = new Request("http://localhost");
    expect(isWorkerIngestAuthorized(request)).toBe(false);
  });

  it("accepts bearer token", () => {
    process.env.LATEX_INCOMING_API_SECRET_KEY = "secret";
    const request = new Request("http://localhost", {
      headers: { Authorization: "Bearer secret" },
    });
    expect(isWorkerIngestAuthorized(request)).toBe(true);
  });

  it("accepts x-worker-ingest-token header", () => {
    process.env.LATEX_INCOMING_API_SECRET_KEY = "secret";
    const request = new Request("http://localhost", {
      headers: { "x-worker-ingest-token": "secret" },
    });
    expect(isWorkerIngestAuthorized(request)).toBe(true);
  });

  it("accepts raw authorization token", () => {
    process.env.LATEX_INCOMING_API_SECRET_KEY = "secret";
    const request = new Request("http://localhost", {
      headers: { Authorization: "secret" },
    });
    expect(isWorkerIngestAuthorized(request)).toBe(true);
  });
});
