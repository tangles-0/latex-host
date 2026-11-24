import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getAlbumForUser } from "@/lib/metadata-store";
import {
  getMediaForUser,
  updateAlbumMediaCaption,
  updateAlbumMediaThumbnailUrl,
} from "@/lib/media-store";
import {
  isAudioPreviewFile,
  isMediaKind,
} from "@/lib/media-types";
import { parseAlbumThumbnailUrl } from "@/lib/album-thumbnail-url";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ albumId: string; imageId: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { albumId, imageId } = await params;
  if (!albumId || !imageId) {
    return NextResponse.json(
      { error: "Album id and image id are required." },
      { status: 400 },
    );
  }

  const album = await getAlbumForUser(albumId, userId);
  if (!album) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }

  const payload = (await request.json()) as {
    caption?: string;
    kind?: string;
    thumbnailUrl?: unknown;
  };
  const caption = typeof payload?.caption === "string" ? payload.caption : "";
  const kind = isMediaKind(payload?.kind) ? payload.kind : "image";
  if (Object.prototype.hasOwnProperty.call(payload, "thumbnailUrl")) {
    if (kind !== "other") {
      return NextResponse.json(
        {
          error:
            "Custom thumbnails are only available for files without previews.",
        },
        { status: 400 },
      );
    }
    const sourceMedia = await getMediaForUser(kind, imageId, userId);
    if (!sourceMedia) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 });
    }
    if (isAudioPreviewFile(sourceMedia.mimeType, sourceMedia.ext)) {
      return NextResponse.json(
        { error: "Audio files use generated waveform thumbnails." },
        { status: 400 },
      );
    }
    const parsedUrl = parseAlbumThumbnailUrl(payload.thumbnailUrl);
    if (parsedUrl.error) {
      return NextResponse.json({ error: parsedUrl.error }, { status: 400 });
    }
    const media = await updateAlbumMediaThumbnailUrl(
      userId,
      albumId,
      { id: imageId, kind },
      parsedUrl.url,
    );
    if (!media) {
      return NextResponse.json(
        { error: "Media not found in album." },
        { status: 404 },
      );
    }
    return NextResponse.json({ image: media });
  }
  if (caption.length > 1000) {
    return NextResponse.json(
      { error: "Caption is too long." },
      { status: 400 },
    );
  }

  const media = await updateAlbumMediaCaption(
    userId,
    albumId,
    { id: imageId, kind },
    caption,
  );
  if (!media) {
    return NextResponse.json(
      { error: "Media not found in album." },
      { status: 404 },
    );
  }

  return NextResponse.json({ image: media });
}
