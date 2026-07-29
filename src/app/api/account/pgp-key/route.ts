import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  deleteUserPgpKey,
  getUserPgpKey,
  savePendingPgpKey,
} from "@/lib/messaging-store";
import { PGP_MAX_PUBLIC_KEY_BYTES, mapPgpError } from "@/lib/pgp";
import { isAuthError, requireRequestAuth } from "@/lib/request-auth";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";
import { hasTrustedOrigin } from "@/lib/request-security";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRequestAuth(request, { scope: "pgp:read" });
  if (isAuthError(auth)) {
    return auth;
  }

  const key = await getUserPgpKey(auth.userId);
  return NextResponse.json({ key });
}

export async function PUT(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  const rate = await consumeRequestRateLimit({
    namespace: "pgp-key-save",
    key: userId,
    limit: 10,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many key save attempts." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const payload = (await request.json()) as { publicKeyArmored?: string };
  const publicKeyArmored =
    typeof payload.publicKeyArmored === "string" ? payload.publicKeyArmored.trim() : "";
  if (!publicKeyArmored) {
    return NextResponse.json({ error: "Public key is required." }, { status: 400 });
  }
  if (Buffer.byteLength(publicKeyArmored, "utf8") > PGP_MAX_PUBLIC_KEY_BYTES) {
    return NextResponse.json(
      { error: "Public key exceeds the maximum allowed size (64 KB)." },
      { status: 413 },
    );
  }

  try {
    const key = await savePendingPgpKey(userId, publicKeyArmored);
    return NextResponse.json({ key });
  } catch (error) {
    return NextResponse.json(
      { error: mapPgpError(error, "Failed to save key.") },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  try {
    await deleteUserPgpKey(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete key.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
