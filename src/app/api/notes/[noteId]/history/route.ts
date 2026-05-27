import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  deleteAllNoteHistoryForUser,
  getNoteForUser,
  listNoteHistoryForUser,
} from "@/lib/media-store";

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

  const history = await listNoteHistoryForUser(noteId, userId);
  return NextResponse.json({ history });
}

export async function DELETE(
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

  const deletedCount = await deleteAllNoteHistoryForUser(noteId, userId);
  return NextResponse.json({ deletedCount });
}
