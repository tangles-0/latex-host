import { describe, expect, it } from "vitest";
import {
  isAsyncPreviewKind,
  isWorkerIngestAuthorized,
  thumbnailContentTypeForKind,
} from "@/lib/preview-worker";

describe("thumbnailContentTypeForKind", () => {
  it("maps audio files to the audio worker content type", () => {
    expect(thumbnailContentTypeForKind("other", "audio/mpeg", "mp3")).toBe(
      "audio",
    );
    expect(thumbnailContentTypeForKind("other", "audio/wav", "wav")).toBe(
      "audio",
    );
  });

  it("keeps existing mappings for video and text documents", () => {
    expect(thumbnailContentTypeForKind("video", "video/mp4", "mp4")).toBe(
      "video",
    );
    expect(
      thumbnailContentTypeForKind("document", "application/javascript", "js"),
    ).toBe("text");
    expect(thumbnailContentTypeForKind("document", "application/pdf", "pdf")).toBe(
      "doc",
    );
  });
});

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
