import { describe, expect, it } from "vitest";

import { isImageGenerationExpired, canCancelImageGeneration, isTerminalImageGenerationStatus } from "@/lib/image-generations/policy";
import {
  imageGenerationInputSchema,
  queuedImageGenerationBatchSchema,
} from "@/lib/image-generations/types";

describe("image generation requests", () => {
  it("accepts prompts with an optional negative prompt", () => {
    expect(
      imageGenerationInputSchema.parse({
        prompt: "  a futuristic city  ",
        negativePrompt: "  blurry  ",
      }),
    ).toEqual({
      prompt: "a futuristic city",
      negativePrompt: "blurry",
      expandPrompt: false,
      sourceMediaId: undefined,
      denoisingStrength: undefined,
      maskPngBase64: undefined,
    });
  });

  it("accepts expandPrompt", () => {
    expect(
      imageGenerationInputSchema.parse({
        prompt: "a city",
        expandPrompt: true,
      }),
    ).toEqual({
      prompt: "a city",
      expandPrompt: true,
      sourceMediaId: undefined,
      denoisingStrength: undefined,
      maskPngBase64: undefined,
    });
  });

  it("rejects empty and oversized prompts", () => {
    expect(imageGenerationInputSchema.safeParse({ prompt: "" }).success).toBe(
      false,
    );
    expect(
      imageGenerationInputSchema.safeParse({ prompt: "x".repeat(2001) })
        .success,
    ).toBe(false);
  });

  it("uses a longer host safety timeout than the one-minute image generation phase", () => {
    const lastActivityAt = "2026-08-29T00:00:00.000Z";

    expect(
      isImageGenerationExpired(
        lastActivityAt,
        new Date(lastActivityAt).getTime() + 60_000,
      ),
    ).toBe(false);
    expect(
      isImageGenerationExpired(
        lastActivityAt,
        new Date(lastActivityAt).getTime() + 5 * 60_000,
      ),
    ).toBe(true);
  });

  it("accepts a batched queued status payload", () => {
    expect(
      queuedImageGenerationBatchSchema.parse([
        {
          id: "11111111-1111-4111-8111-111111111111",
          status: "queued",
          position: 1,
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          status: "queued",
          position: 4,
        },
      ]),
    ).toHaveLength(2);
    expect(
      queuedImageGenerationBatchSchema.safeParse([
        {
          id: "11111111-1111-4111-8111-111111111111",
          status: "generating",
          position: 1,
        },
      ]).success,
    ).toBe(false);
  });

  it("only lets pending jobs be cancelled", () => {
    expect(canCancelImageGeneration("pending")).toBe(true);
    expect(canCancelImageGeneration("generating")).toBe(false);
    expect(isTerminalImageGenerationStatus("cancelled")).toBe(true);
    expect(isTerminalImageGenerationStatus("pending")).toBe(false);
  });
});
