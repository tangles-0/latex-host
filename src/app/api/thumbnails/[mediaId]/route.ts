import { NextResponse } from "next/server";
import {
  getBlobMediaWithOwnerById,
  updateMediaPreviewForUser,
} from "@/lib/media-store";
import { storeGeneratedPreviewForMedia } from "@/lib/media-storage";
import { isWorkerIngestAuthorized } from "@/lib/preview-worker";

export const runtime = "nodejs";

type ThumbnailUploadPayload = {
  mediaId?: string;
  thumbnailBase64?: string;
  contentType?: string;
  generationDurationMs?: number;
};

function decodeBase64Image(input: string): Buffer {
  const value = input.trim();
  const withoutDataPrefix = value.startsWith("data:")
    ? value.slice(value.indexOf(",") + 1)
    : value;
  return Buffer.from(withoutDataPrefix, "base64");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
): Promise<NextResponse> {
  if (!isWorkerIngestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { mediaId: mediaIdParam } = await params;
  const payload = (await request.json()) as ThumbnailUploadPayload;
  const mediaId = mediaIdParam.trim();
  if (!mediaId || payload.mediaId?.trim() !== mediaId) {
    return NextResponse.json(
      { error: "mediaId does not match the route." },
      { status: 400 },
    );
  }
  if (!payload.thumbnailBase64?.trim()) {
    return NextResponse.json(
      { error: "thumbnailBase64 is required." },
      { status: 400 },
    );
  }
  if (!payload.contentType?.toLowerCase().startsWith("image/")) {
    return NextResponse.json(
      { error: "contentType must be an image type." },
      { status: 415 },
    );
  }

  const media = await getBlobMediaWithOwnerById(mediaId);
  if (!media) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }
  if (media.previewStatus === "complete") {
    return NextResponse.json(
      { error: "Thumbnail is already complete." },
      { status: 409 },
    );
  }

  try {
    const generated = await storeGeneratedPreviewForMedia({
      kind: media.kind,
      baseName: media.baseName,
      ext: media.ext,
      uploadedAt: new Date(media.uploadedAt),
      previewImageBuffer: decodeBase64Image(payload.thumbnailBase64),
    });
    const updated = await updateMediaPreviewForUser({
      userId: media.userId,
      kind: media.kind,
      mediaId,
      previewStatus: "complete",
      previewError: null,
      sizeSm: generated.sizeSm,
      sizeLg: generated.sizeLg,
      width: generated.width,
      height: generated.height,
    });

    return NextResponse.json({
      ok: true,
      mediaId,
      previewStatus: updated?.previewStatus ?? "complete",
      generationDurationMs: payload.generationDurationMs,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save thumbnail.";
    await updateMediaPreviewForUser({
      userId: media.userId,
      kind: media.kind,
      mediaId,
      previewStatus: "error",
      previewError: message.slice(0, 500),
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
