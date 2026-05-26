import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  completeUploadSession,
  getUploadSessionForUser,
  listMissingUploadPartNumbers,
  markUploadSessionFailedForUser,
} from "@/lib/upload-sessions";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";
import { addMediaForUser, updateMediaPreviewForUser } from "@/lib/media-store";
import { storeGenericMediaFromStoredUpload } from "@/lib/media-storage";
import {
  buildAppUrl,
  isWorkerIngestAuthorized,
  requestPreviewGeneration,
} from "@/lib/preview-worker";
import {
  getYoutubeIngestForUser,
  updateYoutubeIngest,
} from "@/lib/youtube-ingests";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const isWorkerRequest = isWorkerIngestAuthorized(request);
  let userId = await getSessionUserId();
  const payload = (await request.json()) as {
    userId?: string;
    sessionId?: string;
    expectedTotalParts?: number;
    checksum?: string;
    youtubeIngestId?: string;
    youtubeId?: string;
    title?: string;
  };
  if (!userId && isWorkerRequest) {
    userId = payload.userId?.trim() ?? "";
  }
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isWorkerRequest) {
    const rate = await consumeRequestRateLimit({
      namespace: "upload-complete",
      key: userId,
      limit: Number(process.env.UPLOAD_COMPLETE_RATE_LIMIT_PER_MINUTE ?? 30),
      windowSeconds: 60,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many upload completion attempts. Please retry shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        },
      );
    }
  }
  const sessionId = payload.sessionId?.trim() ?? "";
  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required." },
      { status: 400 },
    );
  }

  const session = await getUploadSessionForUser(sessionId, userId);
  if (!session) {
    return NextResponse.json(
      { error: "Upload session not found." },
      { status: 404 },
    );
  }
  if (
    Number.isFinite(payload.expectedTotalParts) &&
    Number(payload.expectedTotalParts) > 0 &&
    Number(payload.expectedTotalParts) !== session.totalParts
  ) {
    return NextResponse.json(
      { error: "Upload manifest does not match session metadata." },
      { status: 409 },
    );
  }
  if (
    payload.checksum?.trim() &&
    session.checksum &&
    payload.checksum.trim() !== session.checksum
  ) {
    return NextResponse.json(
      { error: "Upload checksum manifest does not match session metadata." },
      { status: 409 },
    );
  }
  const missingParts = listMissingUploadPartNumbers(session);
  if (missingParts.length > 0) {
    return NextResponse.json(
      {
        error: `Upload is incomplete. Missing part(s): ${missingParts.join(", ")}`,
      },
      { status: 409 },
    );
  }

  try {
    const completed = await completeUploadSession(session);
    if (isWorkerRequest) {
      const youtubeIngestId = payload.youtubeIngestId?.trim() ?? "";
      const youtubeId = payload.youtubeId?.trim() ?? "";
      const title = payload.title?.trim() || completed.fileName;
      if (!youtubeIngestId || !youtubeId) {
        return NextResponse.json(
          { error: "youtubeIngestId and youtubeId are required." },
          { status: 400 },
        );
      }
      const ingest = await getYoutubeIngestForUser(userId, youtubeIngestId);
      if (!ingest) {
        return NextResponse.json(
          { error: "YouTube ingest not found." },
          { status: 404 },
        );
      }
      const uploadedAt = new Date();
      const stored = await storeGenericMediaFromStoredUpload({
        kind: "video",
        sourceKey: completed.storageKey ?? "",
        sizeOriginal: completed.fileSize,
        ext: completed.ext,
        mimeType: completed.mimeType,
        uploadedAt,
        deferPreview: true,
      });
      const media = await addMediaForUser({
        userId,
        kind: "video",
        baseName: stored.baseName,
        originalFileName: title,
        ext: stored.ext,
        mimeType: stored.mimeType,
        youtubeId,
        sizeOriginal: stored.sizeOriginal,
        sizeSm: stored.sizeSm,
        sizeLg: stored.sizeLg,
        previewStatus: stored.previewStatus,
        uploadedAt: uploadedAt.toISOString(),
      });
      await updateYoutubeIngest({
        ingestId: youtubeIngestId,
        status: "complete",
        progress: 100,
        error: null,
        mediaId: media.id,
      });
      const queued = await requestPreviewGeneration({
        mediaId: media.id,
        kind: "video",
        ext: media.ext,
        mimeType: media.mimeType,
        fileSizeBytes: media.sizeOriginal,
        downloadUrl: buildAppUrl(request, `/api/thumbnails/${media.id}/source`),
        youtubeId,
      });
      if (!queued.ok) {
        await updateMediaPreviewForUser({
          userId,
          kind: "video",
          mediaId: media.id,
          previewStatus: "error",
          previewError: queued.error,
        });
      }
      return NextResponse.json({
        sessionId: completed.id,
        state: completed.state,
        media,
      });
    }
    return NextResponse.json({
      sessionId: completed.id,
      state: completed.state,
      storageKey: completed.storageKey,
      fileName: completed.fileName,
      mimeType: completed.mimeType,
      ext: completed.ext,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to complete upload.";
    const status =
      message.includes("incomplete") ||
      message.includes("checksum") ||
      message.includes("size does not match")
        ? 409
        : 500;
    await markUploadSessionFailedForUser(sessionId, userId, message);
    return NextResponse.json({ error: message }, { status });
  }
}
