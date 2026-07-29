import { NextResponse } from "next/server";
import { setThreadMuted } from "@/lib/messaging-store";
import { isAuthError, requireRequestAuth, requireTrustedMutation } from "@/lib/request-auth";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRequestAuth(request, { scope: "messages:read" });
  if (isAuthError(auth)) {
    return auth;
  }
  const originError = requireTrustedMutation(request, auth);
  if (originError) {
    return originError;
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
    await setThreadMuted(auth.userId, senderHash, payload.muted);
    return NextResponse.json({ ok: true, senderHash, isMuted: payload.muted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update mute.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
