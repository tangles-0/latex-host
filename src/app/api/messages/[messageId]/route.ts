import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getMessageAndMarkRead } from "@/lib/messaging-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ messageId: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { messageId } = await context.params;
  if (!messageId?.trim()) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  const message = await getMessageAndMarkRead(userId, messageId.trim());
  if (!message) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  return NextResponse.json({ message });
}
