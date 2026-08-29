import { z } from "zod";

export const imageGenerationInputSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  negativePrompt: z.string().trim().max(2000).optional(),
});

export type ImageGenerationStatus =
  | "pending"
  | "generating"
  | "uploading"
  | "complete"
  | "failed";

export type ImageGenerationInput = z.infer<typeof imageGenerationInputSchema>;

export type ImageGenerationEntry = ImageGenerationInput & {
  id: string;
  status: ImageGenerationStatus;
  error?: string;
  mediaId?: string;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};
