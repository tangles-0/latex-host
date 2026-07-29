import { NextResponse } from "next/server";
import { refreshDeviceTokens } from "@/lib/device-auth";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const rate = await consumeRequestRateLimit({
    namespace: "device-token",
    key: request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "unknown",
    limit: 60,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many token requests." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const payload = (await request.json()) as {
    grant_type?: string;
    refresh_token?: string;
  };
  if (payload.grant_type !== "refresh_token") {
    return NextResponse.json(
      { error: "unsupported_grant_type" },
      { status: 400 },
    );
  }
  const refreshToken = payload.refresh_token?.trim() ?? "";
  if (!refreshToken) {
    return NextResponse.json({ error: "refresh_token is required." }, { status: 400 });
  }

  try {
    const result = await refreshDeviceTokens(refreshToken);
    return NextResponse.json({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      token_type: result.tokenType,
      expires_in: result.expiresIn,
      scope: result.scope,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid refresh token.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
