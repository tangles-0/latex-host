import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { verifyPgpKeyOwnership } from "@/lib/messaging-store";
import { isValidVerifyCodeFormat } from "@/lib/pgp";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";
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

  const rate = await consumeRequestRateLimit({
    namespace: "pgp-key-verify",
    key: userId,
    limit: 20,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many verification attempts." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const payload = (await request.json()) as { code?: string };
  const code = typeof payload.code === "string" ? payload.code.trim() : "";
  if (!code) {
    return NextResponse.json({ error: "Verification code is required." }, { status: 400 });
  }
  if (!isValidVerifyCodeFormat(code)) {
    return NextResponse.json(
      { error: "Verification code must be a hex string from the decrypted challenge." },
      { status: 400 },
    );
  }

  try {
    const key = await verifyPgpKeyOwnership(userId, code);
    return NextResponse.json({ key });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
