import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { deleteAlbumForUser, updateAlbumForUser } from "@/lib/metadata-store";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
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

  const deleted = await deleteAlbumForUser(albumId, userId);
  if (!deleted) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

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

  const payload = (await request.json()) as {
    name?: string;
    displayAsDownloadPage?: boolean;
  };
  const name =
    typeof payload.name === "string" ? payload.name.trim() : undefined;
  const hasDisplayFlag = typeof payload.displayAsDownloadPage === "boolean";

  if (name !== undefined && !name) {
    return NextResponse.json(
      { error: "Album name is required." },
      { status: 400 },
    );
  }
  if (name === undefined && !hasDisplayFlag) {
    return NextResponse.json(
      { error: "No album updates provided." },
      { status: 400 },
    );
  }

  const album = await updateAlbumForUser(albumId, userId, {
    name,
    displayAsDownloadPage: hasDisplayFlag
      ? payload.displayAsDownloadPage
      : undefined,
  });
  if (!album) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }

  return NextResponse.json({ album });
}
