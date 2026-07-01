import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  createShareForMedia,
  deleteShareForMedia,
  getMediaForUser,
  getShareForUserByMedia,
  updateNoteSharePasswordForUser,
  type MediaKind,
} from "@/lib/media-store";
import { isMediaKind } from "@/lib/media-types";

export const runtime = "nodejs";
const NOTE_SHARE_PASSWORD_MAX_LENGTH = 256;

function parseKind(input: string | null): MediaKind | null {
  return isMediaKind(input) ? input : null;
}

function buildShareUrls(
  kind: MediaKind,
  code: string,
  ext: string,
): { original: string; sm: string; lg: string } {
  const base = kind === "note" ? `/share/${code}` : `/share/${code}.${ext}`;
  return {
    original: base,
    sm:
      kind === "note"
        ? base
        : `/share/${code}-sm.${kind === "image" ? ext : "png"}`,
    lg:
      kind === "note"
        ? base
        : `/share/${code}-lg.${kind === "image" ? ext : "png"}`,
  };
}

function parseNoteSharePassword(input: unknown): string | null | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (input === null) {
    return null;
  }
  if (typeof input !== "string") {
    return undefined;
  }
  const password = input.trim();
  if (!password || password.length > NOTE_SHARE_PASSWORD_MAX_LENGTH) {
    return undefined;
  }
  return password;
}

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const payload = (await request.json()) as {
    kind?: string;
    mediaId?: string;
    password?: unknown;
  };
  const kind = parseKind(payload.kind ?? null);
  const mediaId = payload.mediaId?.trim() ?? "";
  if (!kind || !mediaId) {
    return NextResponse.json(
      { error: "kind and mediaId are required." },
      { status: 400 },
    );
  }
  const media = await getMediaForUser(kind, mediaId, userId);
  if (!media) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }
  const password =
    kind === "note" ? parseNoteSharePassword(payload.password) : undefined;
  if (
    kind === "note" &&
    payload.password !== undefined &&
    password === undefined
  ) {
    return NextResponse.json(
      { error: "Password must be 1-256 characters." },
      { status: 400 },
    );
  }
  const share = await createShareForMedia(
    kind,
    mediaId,
    userId,
    kind === "note" && password !== undefined ? { password } : undefined,
  );
  if (!share) {
    return NextResponse.json(
      { error: "Unable to create share." },
      { status: 500 },
    );
  }
  return NextResponse.json({
    share,
    urls: buildShareUrls(kind, share.code, media.ext),
  });
}

export async function GET(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const url = new URL(request.url);
  const kind = parseKind(url.searchParams.get("kind"));
  const mediaId = url.searchParams.get("mediaId")?.trim() ?? "";
  if (!kind || !mediaId) {
    return NextResponse.json(
      { error: "kind and mediaId are required." },
      { status: 400 },
    );
  }
  const media = await getMediaForUser(kind, mediaId, userId);
  if (!media) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }
  const share = await getShareForUserByMedia(kind, mediaId, userId);
  if (!share?.code) {
    return NextResponse.json({ share: null });
  }
  return NextResponse.json({
    share,
    urls: buildShareUrls(kind, share.code, media.ext),
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const payload = (await request.json()) as {
    kind?: string;
    mediaId?: string;
    password?: unknown;
  };
  const kind = parseKind(payload.kind ?? null);
  const mediaId = payload.mediaId?.trim() ?? "";
  if (!kind || !mediaId) {
    return NextResponse.json(
      { error: "kind and mediaId are required." },
      { status: 400 },
    );
  }
  if (kind !== "note") {
    return NextResponse.json(
      { error: "Password protection is only available for notes." },
      { status: 400 },
    );
  }
  const media = await getMediaForUser(kind, mediaId, userId);
  if (!media) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }
  const password = parseNoteSharePassword(payload.password);
  if (payload.password !== null && password === undefined) {
    return NextResponse.json(
      { error: "Password must be 1-256 characters." },
      { status: 400 },
    );
  }
  const share = await updateNoteSharePasswordForUser(
    mediaId,
    userId,
    password ?? null,
  );
  if (!share) {
    return NextResponse.json(
      { error: "Share link not found." },
      { status: 404 },
    );
  }
  return NextResponse.json({
    share,
    urls: buildShareUrls(kind, share.code, media.ext),
  });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const payload = (await request.json()) as { kind?: string; mediaId?: string };
  const kind = parseKind(payload.kind ?? null);
  const mediaId = payload.mediaId?.trim() ?? "";
  if (!kind || !mediaId) {
    return NextResponse.json(
      { error: "kind and mediaId are required." },
      { status: 400 },
    );
  }
  const deleted = await deleteShareForMedia(kind, mediaId, userId);
  return NextResponse.json({ deleted });
}
