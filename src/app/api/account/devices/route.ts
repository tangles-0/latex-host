import { NextResponse } from "next/server";
import { listApiDevices } from "@/lib/device-auth";
import { getSessionUserId } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const devices = await listApiDevices(userId);
  return NextResponse.json({
    devices: devices.map((device) => ({
      id: device.id,
      name: device.name,
      scopes: device.scopes,
      createdAt: device.createdAt.toISOString(),
      lastUsedAt: device.lastUsedAt?.toISOString() ?? null,
      expiresAt: device.expiresAt.toISOString(),
      isRevoked: device.isRevoked,
    })),
  });
}
