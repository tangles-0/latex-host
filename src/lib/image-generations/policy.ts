export const imageGenerationMaxAgeMs = 60_000;

export const isImageGenerationExpired = (
  createdAt: string | Date,
  now = Date.now(),
) => now - new Date(createdAt).getTime() >= imageGenerationMaxAgeMs;
