import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getAlbumForUser } from "@/lib/metadata-store";
import { addMediaForUser, updateMediaPreviewForUser } from "@/lib/media-store";
import {
  isLocalTextPreviewDocument,
  isThumbnailServiceSupported,
  mediaKindFromType,
} from "@/lib/media-types";
import {
  deleteCompletedUploadObject,
  readCompletedUploadBuffer,
  storeGenericMediaFromStoredUpload,
  storeImageOriginalFromStoredUpload,
  storeImageMediaFromBuffer,
} from "@/lib/media-storage";
import { buildAppUrl, requestPreviewGeneration } from "@/lib/preview-worker";
import { getUploadSessionForUser } from "@/lib/upload-sessions";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const payload = (await request.json()) as {
    sessionId?: string;
    albumId?: string;
    keepOriginalFileName?: boolean;
  };
  const sessionId = payload.sessionId?.trim() ?? "";
  const albumId = payload.albumId?.trim() || undefined;
  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required." },
      { status: 400 },
    );
  }
  if (albumId) {
    const album = await getAlbumForUser(albumId, userId);
    if (!album) {
      return NextResponse.json({ error: "Album not found." }, { status: 404 });
    }
  }

  const session = await getUploadSessionForUser(sessionId, userId);
  if (!session) {
    return NextResponse.json(
      { error: "Upload session not found." },
      { status: 404 },
    );
  }
  if (session.state !== "complete" || !session.storageKey) {
    return NextResponse.json(
      { error: "Upload session is not complete." },
      { status: 409 },
    );
  }

  const kind = mediaKindFromType(session.mimeType, session.ext);
  const uploadedAt = new Date();
  const canUseThumbnailService = isThumbnailServiceSupported({
    kind,
    mimeType: session.mimeType,
    ext: session.ext,
    fileSizeBytes: session.fileSize,
  });
  const thumbnailKind =
    canUseThumbnailService && kind !== "other" ? kind : null;
  let stored;
  if (kind === "image") {
    if (canUseThumbnailService) {
      stored = await storeImageOriginalFromStoredUpload({
        sourceKey: session.storageKey,
        sizeOriginal: session.fileSize,
        ext: session.ext,
        mimeType: session.mimeType,
        uploadedAt,
      });
    } else {
      const buffer = await readCompletedUploadBuffer(session.storageKey);
      stored = await storeImageMediaFromBuffer({
        buffer,
        ext: session.ext,
        mimeType: session.mimeType,
        uploadedAt,
      });
      try {
        await deleteCompletedUploadObject(session.storageKey);
      } catch {
        // Keep registration successful even if staged upload cleanup fails.
      }
    }
  } else {
    stored = await storeGenericMediaFromStoredUpload({
      kind:
        kind === "video" ? "video" : kind === "document" ? "document" : "other",
      sourceKey: session.storageKey,
      sizeOriginal: session.fileSize,
      ext: session.ext,
      mimeType: session.mimeType,
      uploadedAt,
      deferPreview:
        canUseThumbnailService &&
        !isLocalTextPreviewDocument(session.mimeType, session.ext),
    });
  }
  const media = await addMediaForUser({
    userId,
    kind,
    albumId,
    baseName: stored.baseName,
    originalFileName: payload.keepOriginalFileName
      ? session.fileName
      : undefined,
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
      downloadUrl: buildAppUrl(request, `/api/thumbnails/${media.id}/source`),
    });
    if (!queued.ok) {
      await updateMediaPreviewForUser({
        userId,
        kind,
        mediaId: media.id,
        previewStatus: "error",
        previewError: queued.error,
      });
    }
  }

  return NextResponse.json({ media });
}
