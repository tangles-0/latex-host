import {
  addMediaForUser,
  createShareForMedia,
  getMediaForUser,
  getShareForUserByMedia,
  updateMediaPreviewForUser,
  type MediaEntry,
} from "@/lib/media-store";
import { ensureConstrainedShareImage } from "@/lib/storage";
import {
  deleteCompletedUploadObject,
  readCompletedUploadBuffer,
  storeGenericMediaFromBuffer,
  storeGenericMediaFromStoredUpload,
  storeImageMediaFromBuffer,
  storeImageOriginalFromBuffer,
  storeImageOriginalFromStoredUpload,
} from "@/lib/media-storage";
import {
  isThumbnailServiceSupported,
  mediaKindFromType,
  type BlobMediaKind,
} from "@/lib/media-types";
import { buildAppUrl, requestPreviewGeneration } from "@/lib/preview-worker";
import type { Visibility } from "@/lib/api-v1/schemas";

export async function registerMediaFromBuffer(input: {
  request: Request;
  userId: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  ext: string;
  albumId?: string;
  keepOriginalFileName?: boolean;
  generationPrompt?: string;
}): Promise<MediaEntry> {
  const kind = mediaKindFromType(input.mimeType, input.ext);
  const uploadedAt = new Date();
  const canUseThumbnailService = isThumbnailServiceSupported({
    kind,
    mimeType: input.mimeType,
    ext: input.ext,
    fileSizeBytes: input.buffer.byteLength,
  });
  const thumbnailKind =
    canUseThumbnailService && kind !== "other" ? (kind as Exclude<BlobMediaKind, "other">) : null;

  const stored =
    kind === "image"
      ? canUseThumbnailService
        ? await storeImageOriginalFromBuffer({
            buffer: input.buffer,
            ext: input.ext,
            mimeType: input.mimeType,
            uploadedAt,
          })
        : await storeImageMediaFromBuffer({
            buffer: input.buffer,
            ext: input.ext,
            mimeType: input.mimeType,
            uploadedAt,
          })
      : await storeGenericMediaFromBuffer({
          kind:
            kind === "video"
              ? "video"
              : kind === "document"
                ? "document"
                : "other",
          buffer: input.buffer,
          ext: input.ext,
          mimeType: input.mimeType,
          uploadedAt,
          deferPreview: canUseThumbnailService,
        });

  const media = await addMediaForUser({
    userId: input.userId,
    kind,
    albumId: input.albumId,
    baseName: stored.baseName,
    originalFileName: input.keepOriginalFileName ? input.fileName : undefined,
    generationPrompt: input.generationPrompt,
    ext: stored.ext,
    mimeType: stored.mimeType,
    width: stored.width,
    height: stored.height,
    sizeOriginal: stored.sizeOriginal,
    sizeSm: stored.sizeSm,
    sizeLg: stored.sizeLg,
    previewStatus: stored.previewStatus,
    uploadedAt: uploadedAt.toISOString(),
  });

  if (thumbnailKind && media.previewStatus === "pending") {
    const queued = await requestPreviewGeneration({
      mediaId: media.id,
      kind: thumbnailKind,
      ext: media.ext,
      mimeType: media.mimeType,
      fileSizeBytes: media.sizeOriginal,
      downloadUrl: buildAppUrl(
        input.request,
        `/api/thumbnails/${media.id}/source`,
      ),
    });
    if (!queued.ok) {
      await updateMediaPreviewForUser({
        userId: input.userId,
        kind,
        mediaId: media.id,
        previewStatus: "error",
        previewError: queued.error,
      });
      return {
        ...media,
        previewStatus: "error",
        previewError: queued.error,
      };
    }
  }

  return media;
}

export async function registerMediaFromUploadSession(input: {
  request: Request;
  userId: string;
  session: {
    storageKey: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    ext: string;
  };
  albumId?: string;
  keepOriginalFileName?: boolean;
  generationPrompt?: string;
}): Promise<MediaEntry> {
  const kind = mediaKindFromType(input.session.mimeType, input.session.ext);
  const uploadedAt = new Date();
  const canUseThumbnailService = isThumbnailServiceSupported({
    kind,
    mimeType: input.session.mimeType,
    ext: input.session.ext,
    fileSizeBytes: input.session.fileSize,
  });
  const thumbnailKind =
    canUseThumbnailService && kind !== "other" ? (kind as Exclude<BlobMediaKind, "other">) : null;

  let stored;
  if (kind === "image") {
    if (canUseThumbnailService) {
      stored = await storeImageOriginalFromStoredUpload({
        sourceKey: input.session.storageKey,
        sizeOriginal: input.session.fileSize,
        ext: input.session.ext,
        mimeType: input.session.mimeType,
        uploadedAt,
      });
    } else {
      const buffer = await readCompletedUploadBuffer(input.session.storageKey);
      stored = await storeImageMediaFromBuffer({
        buffer,
        ext: input.session.ext,
        mimeType: input.session.mimeType,
        uploadedAt,
      });
      try {
        await deleteCompletedUploadObject(input.session.storageKey);
      } catch {
        // Keep registration successful even if staged upload cleanup fails.
      }
    }
  } else {
    stored = await storeGenericMediaFromStoredUpload({
      kind:
        kind === "video" ? "video" : kind === "document" ? "document" : "other",
      sourceKey: input.session.storageKey,
      sizeOriginal: input.session.fileSize,
      ext: input.session.ext,
      mimeType: input.session.mimeType,
      uploadedAt,
      deferPreview: canUseThumbnailService,
    });
  }

  const media = await addMediaForUser({
    userId: input.userId,
    kind,
    albumId: input.albumId,
    baseName: stored.baseName,
    originalFileName: input.keepOriginalFileName
      ? input.session.fileName
      : undefined,
    generationPrompt: input.generationPrompt,
    ext: stored.ext,
    mimeType: stored.mimeType,
    width: stored.width,
    height: stored.height,
    sizeOriginal: stored.sizeOriginal,
    sizeSm: stored.sizeSm,
    sizeLg: stored.sizeLg,
    previewStatus: stored.previewStatus,
    uploadedAt: uploadedAt.toISOString(),
  });

  if (thumbnailKind && media.previewStatus === "pending") {
    const queued = await requestPreviewGeneration({
      mediaId: media.id,
      kind: thumbnailKind,
      ext: media.ext,
      mimeType: media.mimeType,
      fileSizeBytes: media.sizeOriginal,
      downloadUrl: buildAppUrl(
        input.request,
        `/api/thumbnails/${media.id}/source`,
      ),
    });
    if (!queued.ok) {
      await updateMediaPreviewForUser({
        userId: input.userId,
        kind,
        mediaId: media.id,
        previewStatus: "error",
        previewError: queued.error,
      });
      return {
        ...media,
        previewStatus: "error",
        previewError: queued.error,
      };
    }
  }

  return media;
}

export async function ensureShareForVisibility(input: {
  kind: MediaEntry["kind"];
  mediaId: string;
  userId: string;
  visibility: Visibility;
  password?: string | null;
}): Promise<{ code: string | null; visibility: Visibility }> {
  if (input.visibility !== "public") {
    const existing = await getShareForUserByMedia(
      input.kind,
      input.mediaId,
      input.userId,
    );
    return {
      code: existing?.code ?? null,
      visibility: existing?.code ? "public" : "private",
    };
  }
  const share = await createShareForMedia(
    input.kind,
    input.mediaId,
    input.userId,
    input.kind === "note" && input.password !== undefined
      ? { password: input.password }
      : undefined,
  );
  if (share?.code && input.kind === "image") {
    await ensureImageShareConstrainedVariant(input.mediaId, input.userId);
  }
  return {
    code: share?.code ?? null,
    visibility: share?.code ? "public" : "private",
  };
}

async function ensureImageShareConstrainedVariant(
  mediaId: string,
  userId: string,
): Promise<void> {
  const media = await getMediaForUser("image", mediaId, userId);
  if (!media || media.ext.toLowerCase() === "svg") {
    return;
  }
  try {
    await ensureConstrainedShareImage(
      media.baseName,
      media.ext,
      new Date(media.uploadedAt),
    );
  } catch {
    // Share creation still succeeds; the public URL can generate on first request.
  }
}

export async function resolveVisibilityForMedia(input: {
  kind: MediaEntry["kind"];
  mediaId: string;
  userId: string;
}): Promise<{ visibility: Visibility; shareCode: string | null }> {
  const existing = await getShareForUserByMedia(
    input.kind,
    input.mediaId,
    input.userId,
  );
  if (existing?.code) {
    return { visibility: "public", shareCode: existing.code };
  }
  return { visibility: "private", shareCode: null };
}
