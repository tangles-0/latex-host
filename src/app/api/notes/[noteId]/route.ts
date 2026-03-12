import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getGroupLimits, getUserGroupInfo } from "@/lib/metadata-store";
import { getNoteForUser, updateNoteForUser } from "@/lib/media-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ noteId: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { noteId } = await params;
  const note = await getNoteForUser(noteId, userId);
  if (!note) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }
  return NextResponse.json({ note });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ noteId: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json()) as { content?: string };
  const content = typeof payload.content === "string" ? payload.content : "";
  const groupInfo = await getUserGroupInfo(userId);
  const groupLimits = await getGroupLimits(groupInfo.groupId);
  if (Buffer.byteLength(content, "utf8") > groupLimits.maxDocumentSize) {
    return NextResponse.json({ error: "Note exceeds size limit." }, { status: 413 });
  }

  const { noteId } = await params;
  const note = await updateNoteForUser({
    userId,
    noteId,
    content,
  });
  if (!note) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }
  return NextResponse.json({ note });
}
