import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { restoreNoteHistoryForUser } from "@/lib/media-store";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ noteId: string; historyId: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { noteId, historyId } = await params;
  const note = await restoreNoteHistoryForUser({
    userId,
    noteId,
    historyId,
  });
  if (!note) {
    return NextResponse.json(
      { error: "History entry not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ note });
}
