export type GalleryPreviewStatus = "pending" | "started" | "complete" | "error";

export type ReconcileableGalleryItem = {
  id: string;
  uploadedAt: string;
  previewStatus?: GalleryPreviewStatus;
};

const PREVIEW_STATUS_RANK: Record<GalleryPreviewStatus, number> = {
  pending: 0,
  started: 1,
  error: 2,
  complete: 3,
};

export const mergePreviewStatus = (
  local: GalleryPreviewStatus | undefined,
  incoming: GalleryPreviewStatus | undefined,
): GalleryPreviewStatus | undefined => {
  if (!local) {
    return incoming;
  }
  if (!incoming) {
    return local;
  }
  return PREVIEW_STATUS_RANK[incoming] >= PREVIEW_STATUS_RANK[local] ? incoming : local;
};

const byNewestUpload = (left: ReconcileableGalleryItem, right: ReconcileableGalleryItem) =>
  new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime();

export const reconcileGalleryMedia = <T extends ReconcileableGalleryItem>(
  local: T[],
  incoming: T[],
): T[] => {
  if (local === incoming) {
    return local;
  }

  const incomingIds = new Set(incoming.map((item) => item.id));
  const localById = new Map(local.map((item) => [item.id, item]));
  const localOnly = local.filter((item) => !incomingIds.has(item.id));

  let didUpgradePreview = false;
  const mergedIncoming = incoming.map((item) => {
    const existing = localById.get(item.id);
    if (!existing) {
      return item;
    }
    const previewStatus = mergePreviewStatus(existing.previewStatus, item.previewStatus);
    if (previewStatus !== item.previewStatus) {
      didUpgradePreview = true;
      return { ...item, previewStatus };
    }
    return item;
  });

  if (localOnly.length === 0 && !didUpgradePreview) {
    return incoming;
  }

  if (localOnly.length === 0) {
    return mergedIncoming;
  }

  return [...localOnly, ...mergedIncoming].sort(byNewestUpload);
};
