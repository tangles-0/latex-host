import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { listThreadMessages } from "@/lib/messaging-store";

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

  const result = await listThreadMessages(userId, senderHash);
  if (!result.hasClaimedKey) {
    return NextResponse.json({ hasClaimedKey: false, messages: [], isMuted: false });
  }
  return NextResponse.json(result);
}
