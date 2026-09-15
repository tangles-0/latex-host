export const imageGenerationJobSafetyMaxAgeMs = 5 * 60_000;

export const isImageGenerationExpired = (
  lastActivityAt: string | Date,
  now = Date.now(),
) =>
  now - new Date(lastActivityAt).getTime() >= imageGenerationJobSafetyMaxAgeMs;

export const canCancelImageGeneration = (status: string) =>
  status === "pending";

export const isTerminalImageGenerationStatus = (status: string) =>
  status === "complete" || status === "failed" || status === "cancelled";
