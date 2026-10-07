import type { ImageGenerationStatus } from "@/lib/image-generations/types";

export type ImageGenerationLane = "fast" | "4k";

const statusRank: Record<ImageGenerationStatus, number> = {
  pending: 0,
  generating: 1,
  uploading: 2,
  complete: 3,
  failed: 3,
  cancelled: 3,
};

export const formatImageGenerationStatus = ({
  status,
  queuePosition,
  lane,
}: {
  status: ImageGenerationStatus;
  queuePosition?: number;
  lane?: ImageGenerationLane | null;
}) => {
  if (status === "pending") {
    return queuePosition ? `queued - position #${queuePosition}` : "queued";
  }
  if (status === "generating") {
    if (lane === "fast") {
      return "Generating - fast";
    }
    if (lane === "4k") {
      return "Generating - 4K";
    }
    return "Generating";
  }
  if (status === "uploading") {
    return "Uploading";
  }
  return status;
};

// A poll that started before a slot was claimed can answer "pending" after
// the worker has already reported "generating". Don't walk the label backwards.
export const shouldApplyWorkerImageGenerationStatus = ({
  currentStatus,
  currentUpdatedAt,
  workerStatus,
  workerUpdatedAt,
}: {
  currentStatus: ImageGenerationStatus;
  currentUpdatedAt: string;
  workerStatus: ImageGenerationStatus;
  workerUpdatedAt: string;
}) => {
  if (statusRank[workerStatus] >= statusRank[currentStatus]) {
    return true;
  }
  return Date.parse(workerUpdatedAt) > Date.parse(currentUpdatedAt);
};
