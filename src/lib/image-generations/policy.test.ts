import { describe, expect, it } from "vitest";

import { isImageGenerationExpired } from "@/lib/image-generations/policy";
import { imageGenerationInputSchema } from "@/lib/image-generations/types";

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

  it("expires requests at one minute", () => {
    const createdAt = "2026-08-29T00:00:00.000Z";

    expect(
      isImageGenerationExpired(
        createdAt,
        new Date(createdAt).getTime() + 59_999,
      ),
    ).toBe(false);
    expect(
      isImageGenerationExpired(
        createdAt,
        new Date(createdAt).getTime() + 60_000,
      ),
    ).toBe(true);
  });
});
