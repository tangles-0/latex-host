import { NextResponse } from "next/server";
import { pollDeviceAuthCode } from "@/lib/device-auth";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const rate = await consumeRequestRateLimit({
    namespace: "device-poll",
    key: request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "unknown",
    limit: 120,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "slow_down", interval: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const payload = (await request.json()) as { device_code?: string; deviceCode?: string };
  const deviceCode = (payload.device_code ?? payload.deviceCode)?.trim() ?? "";
  if (!deviceCode) {
    return NextResponse.json({ error: "device_code is required." }, { status: 400 });
  }

  try {
    const result = await pollDeviceAuthCode(deviceCode);
    if (result.status === "pending") {
      return NextResponse.json(
        { error: "authorization_pending", interval: result.interval },
        { status: 400 },
      );
    }
    if (result.status === "slow_down") {
      return NextResponse.json(
        { error: "slow_down", interval: result.interval },
        { status: 400 },
      );
    }
    if (result.status === "expired") {
      return NextResponse.json({ error: "expired_token" }, { status: 400 });
    }
    return NextResponse.json({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      token_type: result.tokenType,
      expires_in: result.expiresIn,
      scope: result.scope,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid device code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
