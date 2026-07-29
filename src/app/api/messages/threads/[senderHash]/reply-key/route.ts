import { NextResponse } from "next/server";
import { getReplyPublicKeyForThread } from "@/lib/messaging-store";
import { isAuthError, requireRequestAuth } from "@/lib/request-auth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ senderHash: string }> },
): Promise<NextResponse> {
  const auth = await requireRequestAuth(request, { scope: "pgp:read" });
  if (isAuthError(auth)) {
    return auth;
  }

  const { senderHash: raw } = await context.params;
  const senderHash = decodeURIComponent(raw).trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(senderHash)) {
    return NextResponse.json({ error: "Invalid sender hash." }, { status: 400 });
  }

  const key = await getReplyPublicKeyForThread(auth.userId, senderHash);
  if (!key) {
    return NextResponse.json(
      {
        error:
          "This sender has no public key registered on their account, so you cannot encrypt a reply yet.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    fingerprint: key.fingerprint,
    publicKeyArmored: key.publicKeyArmored,
  });
}
