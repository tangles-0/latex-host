import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getAlbumForUser } from "@/lib/metadata-store";
import { reorderAlbumMedia } from "@/lib/media-store";
import { isMediaKind, type MediaKind } from "@/lib/media-types";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { albumId } = await params;
  if (!albumId) {
    return NextResponse.json({ error: "Album id is required." }, { status: 400 });
  }

  const album = await getAlbumForUser(albumId, userId);
  if (!album) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }

  const payload = (await request.json()) as {
    imageIds?: string[];
    mediaItems?: Array<{ id?: string; kind?: string }>;
  };
  const mediaItems = Array.isArray(payload?.mediaItems)
    ? payload.mediaItems
        .map((item) => ({
          id: item.id?.trim() ?? "",
          kind: isMediaKind(item.kind) ? (item.kind as MediaKind) : null,
        }))
        .filter((item): item is { id: string; kind: MediaKind } => Boolean(item.id && item.kind))
    : [];
  const fallbackImageItems = (payload?.imageIds ?? [])
    .filter(Boolean)
    .map((id) => ({ id, kind: "image" as const }));
  const orderedMediaItems = mediaItems.length > 0 ? mediaItems : fallbackImageItems;
  if (orderedMediaItems.length === 0) {
    return NextResponse.json({ error: "mediaItems are required." }, { status: 400 });
  }

  const ok = await reorderAlbumMedia(userId, albumId, orderedMediaItems);
  if (!ok) {
    return NextResponse.json(
      { error: "Album order does not match the current album membership." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}


