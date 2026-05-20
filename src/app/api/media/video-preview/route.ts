import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getMediaForUser, updateVideoPreviewForUser } from "@/lib/media-store";
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

  const media = await getMediaForUser("video", mediaId, userId);
  if (!media) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }

  try {
    await updateVideoPreviewForUser({
      userId,
      mediaId,
      previewStatus: "pending",
      previewError: null,
    });
    const queued = await requestPreviewGeneration({
      mediaId,
      kind: "video",
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
        : "Unable to generate video preview.";
    await updateVideoPreviewForUser({
      userId,
      mediaId,
      previewStatus: "error",
      previewError: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
