import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getReplyPublicKeyForThread } from "@/lib/messaging-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ senderHash: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { senderHash: raw } = await context.params;
  const senderHash = decodeURIComponent(raw).trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(senderHash)) {
    return NextResponse.json({ error: "Invalid sender hash." }, { status: 400 });
  }

  const key = await getReplyPublicKeyForThread(userId, senderHash);
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
