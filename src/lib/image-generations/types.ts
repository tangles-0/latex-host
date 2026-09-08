import { z } from "zod";

import {
  defaultDenoisingStrength,
  maxDenoisingStrength,
  maxImageGenerationMaskChars,
  minDenoisingStrength,
} from "@/lib/image-generations/img2img";

export const imageGenerationInputSchema = z
  .object({
    prompt: z.string().trim().min(1).max(2000),
    negativePrompt: z.string().trim().max(2000).optional(),
    expandPrompt: z.boolean().optional().default(false),
    sourceMediaId: z.string().trim().min(1).max(128).optional(),
    denoisingStrength: z
      .number()
      .min(minDenoisingStrength)
      .max(maxDenoisingStrength)
      .optional(),
    maskPngBase64: z
      .string()
      .trim()
      .min(1)
      .max(maxImageGenerationMaskChars)
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.maskPngBase64 && !value.sourceMediaId) {
      ctx.addIssue({
        code: "custom",
        path: ["maskPngBase64"],
        message: "A source image is required when a mask is provided.",
      });
    }
    if (value.denoisingStrength !== undefined && !value.sourceMediaId) {
      ctx.addIssue({
        code: "custom",
        path: ["denoisingStrength"],
        message: "denoisingStrength is only valid for image-to-image.",
      });
    }
  })
  .transform((value) => ({
    prompt: value.prompt,
    negativePrompt: value.negativePrompt,
    expandPrompt: value.expandPrompt,
    sourceMediaId: value.sourceMediaId,
    denoisingStrength: value.sourceMediaId
      ? (value.denoisingStrength ?? defaultDenoisingStrength)
      : undefined,
    maskPngBase64: value.maskPngBase64,
  }));

export type ImageGenerationStatus =
  | "pending"
  | "generating"
  | "uploading"
  | "complete"
  | "failed";

export type ImageGenerationInput = z.infer<typeof imageGenerationInputSchema>;

export type ImageGenerationEntry = Omit<
  ImageGenerationInput,
  "maskPngBase64"
> & {
  id: string;
  status: ImageGenerationStatus;
  error?: string;
  mediaId?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  sourceThumbnailUrl?: string;
  hasMask: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};
