import { describe, expect, it } from "vitest";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";

describe("consumeRequestRateLimit", () => {
  it("allows requests below limit", async () => {
    const first = await consumeRequestRateLimit({
      namespace: "test",
      key: "user-a",
      limit: 2,
      windowSeconds: 60,
    });
    const second = await consumeRequestRateLimit({
      namespace: "test",
      key: "user-a",
      limit: 2,
      windowSeconds: 60,
    });
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
  });

  it("blocks requests over limit", async () => {
    await consumeRequestRateLimit({
      namespace: "test",
      key: "user-b",
      limit: 1,
      windowSeconds: 60,
    });
    const blocked = await consumeRequestRateLimit({
      namespace: "test",
      key: "user-b",
      limit: 1,
      windowSeconds: 60,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});
