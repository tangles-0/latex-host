import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getMediaForUser, updateMediaPreviewForUser } from "@/lib/media-store";
import { isAudioPreviewFile } from "@/lib/media-types";
import { buildAppUrl, requestPreviewGeneration } from "@/lib/preview-worker";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json()) as { mediaId?: string };
  const mediaId = payload.mediaId?.trim() ?? "";
  if (!mediaId) {
    return NextResponse.json(
      { error: "mediaId is required." },
      { status: 400 },
    );
  }

  const video = await getMediaForUser("video", mediaId, userId);
  const other = video ? null : await getMediaForUser("other", mediaId, userId);
  const media =
    video ??
    (other && isAudioPreviewFile(other.mimeType, other.ext) ? other : null);
  if (!media) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }
  const kind = video ? ("video" as const) : ("other" as const);

  try {
    await updateMediaPreviewForUser({
      userId,
      kind,
      mediaId,
      previewStatus: "pending",
      previewError: null,
      sizeSm: 0,
      sizeLg: 0,
    });
    const queued = await requestPreviewGeneration({
      mediaId,
      kind,
      ext: media.ext,
      mimeType: media.mimeType,
      fileSizeBytes: media.sizeOriginal,
      downloadUrl: buildAppUrl(request, `/api/thumbnails/${mediaId}/source`),
    });
    if (!queued.ok) {
      throw new Error(queued.error);
    }
    return NextResponse.json({
      ok: true,
      previewStatus: "pending",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to generate preview.";
    await updateMediaPreviewForUser({
      userId,
      kind,
      mediaId,
      previewStatus: "error",
      previewError: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
