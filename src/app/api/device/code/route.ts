import { NextResponse } from "next/server";
import {
  createDeviceAuthCode,
  getPublicAppOrigin,
} from "@/lib/device-auth";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const rate = await consumeRequestRateLimit({
    namespace: "device-code",
    key: request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "unknown",
    limit: 20,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many device login attempts." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let deviceName: string | undefined;
  try {
    const payload = (await request.json()) as { device_name?: string; deviceName?: string };
    deviceName = payload.device_name ?? payload.deviceName;
  } catch {
    deviceName = undefined;
  }

  try {
    const result = await createDeviceAuthCode({
      origin: getPublicAppOrigin(request),
      deviceName,
    });
    return NextResponse.json({
      device_code: result.deviceCode,
      user_code: result.userCode,
      verification_uri: result.verificationUri,
      verification_uri_complete: result.verificationUriComplete,
      expires_in: result.expiresIn,
      interval: result.interval,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create device code.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
