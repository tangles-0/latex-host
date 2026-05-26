import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { deleteYoutubeIngestForUser } from "@/lib/youtube-ingests";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ ingestId: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { ingestId } = await params;
  const deleted = await deleteYoutubeIngestForUser(userId, ingestId);
  if (!deleted) {
    return NextResponse.json(
      { error: "YouTube ingest not found." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
