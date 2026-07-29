import { NextResponse } from "next/server";
import { getMessageAndMarkRead } from "@/lib/messaging-store";
import { isAuthError, requireRequestAuth } from "@/lib/request-auth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ messageId: string }> },
): Promise<NextResponse> {
  const auth = await requireRequestAuth(request, { scope: "messages:read" });
  if (isAuthError(auth)) {
    return auth;
  }

  const { messageId } = await context.params;
  if (!messageId?.trim()) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  const message = await getMessageAndMarkRead(auth.userId, messageId.trim());
  if (!message) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  return NextResponse.json({ message });
}
