import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getAlbumForUser, getGroupLimits, getUserGroupInfo } from "@/lib/metadata-store";
import { createNoteForUser } from "@/lib/media-store";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json()) as {
    albumId?: string | null;
    originalFileName?: string;
    content?: string;
  };
  const albumId = payload.albumId?.trim() || undefined;
  const content = typeof payload.content === "string" ? payload.content : "";
  const originalFileName = payload.originalFileName?.trim() || "Untitled note";

  if (albumId) {
    const album = await getAlbumForUser(albumId, userId);
    if (!album) {
      return NextResponse.json({ error: "Album not found." }, { status: 404 });
    }
  }

  const groupInfo = await getUserGroupInfo(userId);
  const groupLimits = await getGroupLimits(groupInfo.groupId);
  if (Buffer.byteLength(content, "utf8") > groupLimits.maxDocumentSize) {
    return NextResponse.json({ error: "Note exceeds size limit." }, { status: 413 });
  }

  const note = await createNoteForUser({
    userId,
    albumId,
    originalFileName: originalFileName.slice(0, 255),
    content,
  });
  return NextResponse.json({ note });
}
