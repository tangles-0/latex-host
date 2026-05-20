import { NextResponse } from "next/server";
import {
  getBlobMediaWithOwnerById,
  updateMediaPreviewForUser,
  type PreviewStatus,
} from "@/lib/media-store";
import { isWorkerIngestAuthorized } from "@/lib/preview-worker";

export const runtime = "nodejs";

type StatusPayload = {
  mediaId?: string;
  status?: string;
};

function parseStatus(
  value: string | undefined,
): { previewStatus: PreviewStatus; previewError?: string } | null {
  const status = value?.trim() ?? "";
  if (status === "pending" || status === "started" || status === "complete") {
    return { previewStatus: status };
  }
  if (status.toLowerCase().startsWith("error")) {
    const message = status.includes(":")
      ? status.slice(status.indexOf(":") + 1).trim()
      : "Thumbnail generation failed.";
    return {
      previewStatus: "error",
      previewError: message.slice(0, 500),
    };
  }
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
): Promise<NextResponse> {
  if (!isWorkerIngestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { mediaId: mediaIdParam } = await params;
  const payload = (await request.json()) as StatusPayload;
  const mediaId = mediaIdParam.trim();
  if (!mediaId || payload.mediaId?.trim() !== mediaId) {
    return NextResponse.json(
      { error: "mediaId does not match the route." },
      { status: 400 },
    );
  }

  const parsed = parseStatus(payload.status);
  if (!parsed) {
    return NextResponse.json({ error: "status is required." }, { status: 400 });
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

  const updated = await updateMediaPreviewForUser({
    userId: media.userId,
    kind: media.kind,
    mediaId,
    previewStatus: parsed.previewStatus,
    previewError: parsed.previewError ?? null,
  });

  return NextResponse.json({
    ok: true,
    mediaId,
    previewStatus: updated?.previewStatus ?? parsed.previewStatus,
  });
}
