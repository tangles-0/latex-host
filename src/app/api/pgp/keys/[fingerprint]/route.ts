import { NextResponse } from "next/server";
import { getPublicKeyForFingerprint } from "@/lib/messaging-store";
import { isValidFingerprint, normalizeFingerprint } from "@/lib/pgp";
import { isAuthError, requireRequestAuth } from "@/lib/request-auth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ fingerprint: string }> },
): Promise<NextResponse> {
  const auth = await requireRequestAuth(request, { scope: "pgp:read" });
  if (isAuthError(auth)) {
    return auth;
  }

  const { fingerprint: raw } = await context.params;
  const fingerprint = normalizeFingerprint(decodeURIComponent(raw));
  if (!isValidFingerprint(fingerprint)) {
    return NextResponse.json({ error: "Invalid fingerprint." }, { status: 400 });
  }

  const key = await getPublicKeyForFingerprint(fingerprint);
  if (!key) {
    return NextResponse.json({ error: "Public key not found." }, { status: 404 });
  }

  return NextResponse.json({
    fingerprint: key.fingerprint,
    publicKeyArmored: key.publicKeyArmored,
  });
}
