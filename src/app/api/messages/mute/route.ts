import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { setThreadMuted } from "@/lib/messaging-store";
import { hasTrustedOrigin } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  const payload = (await request.json()) as {
    senderHash?: string;
    muted?: boolean;
  };
  const senderHash = payload.senderHash?.trim().toLowerCase() ?? "";
  if (!/^[0-9a-f]{32}$/.test(senderHash)) {
    return NextResponse.json({ error: "Invalid sender hash." }, { status: 400 });
  }
  if (typeof payload.muted !== "boolean") {
    return NextResponse.json({ error: "muted must be a boolean." }, { status: 400 });
  }

  try {
    await setThreadMuted(userId, senderHash, payload.muted);
    return NextResponse.json({ ok: true, senderHash, isMuted: payload.muted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update mute.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
