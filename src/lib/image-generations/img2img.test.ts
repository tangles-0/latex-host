import { describe, expect, it } from "vitest";

import {
  decodeImageGenerationMask,
  defaultDenoisingStrength,
  denoisingStrengthLabel,
  imageGenerationRetryInput,
  isImg2ImgSourceExtension,
  stripBase64Payload,
} from "@/lib/image-generations/img2img";
import { imageGenerationInputSchema } from "@/lib/image-generations/types";

describe("image-to-image requests", () => {
  it("accepts raster gallery images and rejects svg", () => {
    expect(isImg2ImgSourceExtension("png")).toBe(true);
    expect(isImg2ImgSourceExtension("JPG")).toBe(true);
    expect(isImg2ImgSourceExtension("svg")).toBe(false);
  });

  it("labels denoising strength for the UI", () => {
    expect(denoisingStrengthLabel(0.25)).toBe("subtle cleanup");
    expect(denoisingStrengthLabel(0.5)).toBe("substantial restyle");
    expect(denoisingStrengthLabel(0.8)).toBe("mostly replace");
  });

  it("strips data URL prefixes from mask payloads", () => {
    expect(stripBase64Payload("data:image/png;base64,abc")).toBe("abc");
    expect(stripBase64Payload("  ABC=  ")).toBe("ABC=");
  });

  it("defaults denoising strength for img2img", () => {
    expect(
      imageGenerationInputSchema.parse({
        prompt: "make it dusk",
        sourceMediaId: "img-1",
      }),
    ).toMatchObject({
      prompt: "make it dusk",
      sourceMediaId: "img-1",
      denoisingStrength: defaultDenoisingStrength,
      expandPrompt: false,
    });
  });

  it("rejects a mask without a source image", () => {
    expect(
      imageGenerationInputSchema.safeParse({
        prompt: "edit the sky",
        maskPngBase64: "AAAA",
      }).success,
    ).toBe(false);
  });

  it("rejects denoising strength outside the supported range", () => {
    expect(
      imageGenerationInputSchema.safeParse({
        prompt: "restyle",
        sourceMediaId: "img-1",
        denoisingStrength: 0.1,
      }).success,
    ).toBe(false);
    expect(
      imageGenerationInputSchema.safeParse({
        prompt: "restyle",
        sourceMediaId: "img-1",
        denoisingStrength: 1,
      }).success,
    ).toBe(false);
  });

  it("decodes a compact PNG mask", () => {
    const encoded = Buffer.from("mask").toString("base64");
    expect(decodeImageGenerationMask(`data:image/png;base64,${encoded}`)).toEqual(
      {
        encoded,
        bytes: Buffer.from("mask"),
      },
    );
  });

  it("rebuilds a retry payload from a failed job", () => {
    expect(
      imageGenerationRetryInput({
        prompt: "make my hand black",
        negativePrompt: "blurry",
        expandPrompt: false,
        sourceMediaId: "img-1",
        denoisingStrength: 0.5,
        hasMask: true,
        maskPngBase64: "mask-bytes",
      }),
    ).toEqual({
      prompt: "make my hand black",
      expandPrompt: false,
      negativePrompt: "blurry",
      sourceMediaId: "img-1",
      denoisingStrength: 0.5,
      maskPngBase64: "mask-bytes",
    });
    expect(
      imageGenerationRetryInput({
        prompt: "a city",
        expandPrompt: true,
        hasMask: false,
      }),
    ).toEqual({
      prompt: "a city",
      expandPrompt: true,
    });
    expect(
      imageGenerationRetryInput({
        prompt: "restyle",
        expandPrompt: false,
        sourceMediaId: "img-1",
        denoisingStrength: 0.45,
        hasMask: true,
      }),
    ).toEqual({
      prompt: "restyle",
      expandPrompt: false,
      sourceMediaId: "img-1",
      denoisingStrength: 0.45,
    });
  });
});
