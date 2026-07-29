import { NextResponse } from "next/server";
import { listThreadMessages } from "@/lib/messaging-store";
import { isAuthError, requireRequestAuth } from "@/lib/request-auth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ senderHash: string }> },
): Promise<NextResponse> {
  const auth = await requireRequestAuth(request, { scope: "messages:read" });
  if (isAuthError(auth)) {
    return auth;
  }

  const { senderHash: raw } = await context.params;
  const senderHash = decodeURIComponent(raw).trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(senderHash)) {
    return NextResponse.json({ error: "Invalid sender hash." }, { status: 400 });
  }

  const result = await listThreadMessages(auth.userId, senderHash);
  if (!result.hasClaimedKey) {
    return NextResponse.json({ hasClaimedKey: false, messages: [], isMuted: false });
  }
  return NextResponse.json(result);
}
