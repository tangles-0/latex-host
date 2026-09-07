export const imageGenerationJobSafetyMaxAgeMs = 5 * 60_000;

export const isImageGenerationExpired = (
  createdAt: string | Date,
  now = Date.now(),
) => now - new Date(createdAt).getTime() >= imageGenerationJobSafetyMaxAgeMs;
