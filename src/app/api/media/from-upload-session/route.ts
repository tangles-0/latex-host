import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getAlbumForUser } from "@/lib/metadata-store";
import { getUploadSessionForUser } from "@/lib/upload-sessions";
import { registerMediaFromUploadSession } from "@/lib/api-v1/media-register";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const payload = (await request.json()) as {
    sessionId?: string;
    albumId?: string;
    keepOriginalFileName?: boolean;
  };
  const sessionId = payload.sessionId?.trim() ?? "";
  const albumId = payload.albumId?.trim() || undefined;
  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required." },
      { status: 400 },
    );
  }
  if (albumId) {
    const album = await getAlbumForUser(albumId, userId);
    if (!album) {
      return NextResponse.json({ error: "Album not found." }, { status: 404 });
    }
  }

  const session = await getUploadSessionForUser(sessionId, userId);
  if (!session) {
    return NextResponse.json(
      { error: "Upload session not found." },
      { status: 404 },
    );
  }
  if (session.state !== "complete" || !session.storageKey) {
    return NextResponse.json(
      { error: "Upload session is not complete." },
      { status: 409 },
    );
  }

  const media = await registerMediaFromUploadSession({
    request,
    userId,
    session: {
      storageKey: session.storageKey,
      fileName: session.fileName,
      fileSize: session.fileSize,
      mimeType: session.mimeType,
      ext: session.ext,
    },
    albumId,
    keepOriginalFileName: payload.keepOriginalFileName,
  });

  return NextResponse.json({ media });
}
