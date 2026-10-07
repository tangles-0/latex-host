import { describe, expect, it } from "vitest";

import {
  formatImageGenerationStatus,
  shouldApplyWorkerImageGenerationStatus,
} from "@/lib/image-generations/status-label";

describe("image generation status labels", () => {
  it("keeps a queue position only while the job is still pending", () => {
    expect(
      formatImageGenerationStatus({
        status: "pending",
        queuePosition: 2,
      }),
    ).toBe("queued - position #2");
  });

  it("names the server once a slot has the job", () => {
    expect(
      formatImageGenerationStatus({ status: "generating", lane: "4k" }),
    ).toBe("Generating - 4K");
    expect(
      formatImageGenerationStatus({ status: "generating", lane: "fast" }),
    ).toBe("Generating - fast");
    expect(formatImageGenerationStatus({ status: "uploading" })).toBe(
      "Uploading",
    );
  });

  it("ignores a stale pending poll after the job has started", () => {
    expect(
      shouldApplyWorkerImageGenerationStatus({
        currentStatus: "generating",
        currentUpdatedAt: "2026-10-08T00:00:02.000Z",
        workerStatus: "pending",
        workerUpdatedAt: "2026-10-08T00:00:01.000Z",
      }),
    ).toBe(false);
    expect(
      shouldApplyWorkerImageGenerationStatus({
        currentStatus: "pending",
        currentUpdatedAt: "2026-10-08T00:00:01.000Z",
        workerStatus: "generating",
        workerUpdatedAt: "2026-10-08T00:00:02.000Z",
      }),
    ).toBe(true);
  });
});
