import { NextResponse } from "next/server";
import { revokeApiDevice } from "@/lib/device-auth";
import { getSessionUserId } from "@/lib/auth";
import { hasTrustedOrigin } from "@/lib/request-security";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ deviceId: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  const { deviceId } = await context.params;
  if (!deviceId?.trim()) {
    return NextResponse.json({ error: "Device not found." }, { status: 404 });
  }

  try {
    await revokeApiDevice(userId, deviceId.trim());
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to revoke device.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
