import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getPublicKeyForFingerprint } from "@/lib/messaging-store";
import { isValidFingerprint, normalizeFingerprint } from "@/lib/pgp";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ fingerprint: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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
