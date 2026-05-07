import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getAlbumForUser } from "@/lib/metadata-store";
import { updateAlbumMediaCaption } from "@/lib/media-store";
import { isMediaKind, type MediaKind } from "@/lib/media-types";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ albumId: string; imageId: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { albumId, imageId } = await params;
  if (!albumId || !imageId) {
    return NextResponse.json({ error: "Album id and image id are required." }, { status: 400 });
  }

  const album = await getAlbumForUser(albumId, userId);
  if (!album) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }

  const payload = (await request.json()) as { caption?: string; kind?: string };
  const caption = typeof payload?.caption === "string" ? payload.caption : "";
  const kind = isMediaKind(payload?.kind) ? (payload.kind as MediaKind) : "image";
  if (caption.length > 1000) {
    return NextResponse.json({ error: "Caption is too long." }, { status: 400 });
  }

  const media = await updateAlbumMediaCaption(
    userId,
    albumId,
    { id: imageId, kind },
    caption,
  );
  if (!media) {
    return NextResponse.json({ error: "Media not found in album." }, { status: 404 });
  }

  return NextResponse.json({ image: media });
}


