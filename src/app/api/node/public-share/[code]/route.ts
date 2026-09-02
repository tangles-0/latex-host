import { NextResponse } from "next/server";
import { z } from "zod";

import { getAlbumPublic, getAlbumShareByCode } from "@/lib/metadata-store";
import {
  getNote,
  getNoteSharePublicMeta,
  listMediaForAlbumPublic,
  verifyNoteSharePassword,
} from "@/lib/media-store";
import { isCloudAccessAuthorized } from "@/lib/self-hosted-nodes";

export const runtime = "nodejs";

const passwordSchema = z.object({ password: z.string().min(1).max(256) });

const getSharePayload = async (code: string, password?: string) => {
  const albumShare = await getAlbumShareByCode(code);
  if (albumShare) {
    const [album, media] = await Promise.all([
      getAlbumPublic(albumShare.albumId),
      listMediaForAlbumPublic(albumShare.albumId),
    ]);
    if (!album) {
      return null;
    }
    return {
      type: "album" as const,
      shareId: albumShare.id,
      album,
      media,
    };
  }

  const noteShare = await getNoteSharePublicMeta(code);
  if (!noteShare) {
    return null;
  }
  const hasAccess =
    !noteShare.hasPassword ||
    (password ? await verifyNoteSharePassword(code, password) : false);
  const note = hasAccess ? await getNote(noteShare.mediaId) : null;
  return {
    type: "note" as const,
    shareCode: code,
    fileName: note?.originalFileName || note?.baseName || noteShare.fileName,
    updatedAt: note?.updatedAt ?? noteShare.updatedAt,
    requiresPassword: noteShare.hasPassword,
    content: note?.content,
  };
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  if (!(await isCloudAccessAuthorized(request.headers.get("authorization")))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { code } = await params;
  const payload = await getSharePayload(code);
  if (!payload) {
    return NextResponse.json({ error: "Share not found." }, { status: 404 });
  }
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  if (!(await isCloudAccessAuthorized(request.headers.get("authorization")))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const parsed = passwordSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Password is required." },
      { status: 400 },
    );
  }
  const { code } = await params;
  const payload = await getSharePayload(code, parsed.data.password);
  if (
    !payload ||
    payload.type !== "note" ||
    typeof payload.content !== "string"
  ) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 403 });
  }
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
