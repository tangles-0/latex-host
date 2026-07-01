import { NextResponse } from "next/server";
import {
  createNoteShareUnlockToken,
  getNoteShareUnlockCookieName,
  NOTE_SHARE_UNLOCK_MAX_AGE_SECONDS,
} from "@/lib/note-share-access";
import {
  getNoteSharePublicMeta,
  verifyNoteSharePassword,
} from "@/lib/media-store";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";

export const runtime = "nodejs";
const NOTE_SHARE_UNLOCK_RATE_LIMIT_PER_MINUTE = 12;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code } = await params;
  const share = await getNoteSharePublicMeta(code);
  if (!share) {
    return NextResponse.json({ error: "Share not found." }, { status: 404 });
  }

  const rate = await consumeRequestRateLimit({
    namespace: "note-share-unlock",
    key: code,
    limit: Number(
      process.env.NOTE_SHARE_UNLOCK_RATE_LIMIT_PER_MINUTE ??
        NOTE_SHARE_UNLOCK_RATE_LIMIT_PER_MINUTE,
    ),
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const payload = (await request.json()) as { password?: unknown };
  const password =
    typeof payload.password === "string" ? payload.password.trim() : "";
  if (!password) {
    return NextResponse.json(
      { error: "Password is required." },
      { status: 400 },
    );
  }

  const isValid = await verifyNoteSharePassword(code, password);
  if (!isValid) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    getNoteShareUnlockCookieName(code),
    createNoteShareUnlockToken(code, share.accessTokenSeed),
    {
      httpOnly: true,
      maxAge: NOTE_SHARE_UNLOCK_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );
  return response;
}
