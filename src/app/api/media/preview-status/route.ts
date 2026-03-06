import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getMediaPreviewStatusForUser } from "@/lib/media-store";
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
    return NextResponse.json({ error: "kind and mediaId are required." }, { status: 400 });
  }
  const status = await getMediaPreviewStatusForUser(userId, kind, mediaId);
  if (!status) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }
  return NextResponse.json(status);
}

