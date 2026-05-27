import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  deleteNoteHistoryForUser,
  getNoteForUser,
  getNoteHistoryForUser,
} from "@/lib/media-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ noteId: string; historyId: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { noteId, historyId } = await params;
  const note = await getNoteForUser(noteId, userId);
  if (!note) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  const history = await getNoteHistoryForUser(noteId, historyId, userId);
  if (!history) {
    return NextResponse.json(
      { error: "History entry not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ history });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ noteId: string; historyId: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { noteId, historyId } = await params;
  const note = await getNoteForUser(noteId, userId);
  if (!note) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  const deleted = await deleteNoteHistoryForUser(noteId, historyId, userId);
  if (!deleted) {
    return NextResponse.json(
      { error: "History entry not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ deleted: true });
}
