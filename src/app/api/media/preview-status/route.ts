import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  getMediaPreviewStatusForUser,
  getMediaPreviewStatusesForUser,
} from "@/lib/media-store";
import { parsePreviewStatusKind } from "@/app/api/media/preview-status/utils";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const url = new URL(request.url);
  const kind = parsePreviewStatusKind(url.searchParams.get("kind"));
  const mediaId = url.searchParams.get("mediaId")?.trim() ?? "";
  if (!kind || !mediaId) {
    return NextResponse.json(
      { error: "kind and mediaId are required." },
      { status: 400 },
    );
  }
  const status = await getMediaPreviewStatusForUser(userId, kind, mediaId);
  if (!status) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }
  return NextResponse.json(status);
}

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json()) as { mediaIds?: unknown };
  if (!Array.isArray(payload.mediaIds)) {
    return NextResponse.json(
      { error: "mediaIds is required." },
      { status: 400 },
    );
  }
  const mediaIds = payload.mediaIds.filter(
    (value): value is string => typeof value === "string",
  );
  const media = await getMediaPreviewStatusesForUser(userId, mediaIds);
  return NextResponse.json({
    media: media.map((item) => {
      const previewExt = item.kind === "image" ? item.ext : "png";
      return {
        mediaId: item.id,
        kind: item.kind,
        previewStatus: item.previewStatus,
        previewError: item.previewError,
        previewUrl:
          item.previewStatus === "complete"
            ? `/media/${item.kind}/${item.id}/${item.baseName}-sm.${previewExt}`
            : undefined,
      };
    }),
  });
}
