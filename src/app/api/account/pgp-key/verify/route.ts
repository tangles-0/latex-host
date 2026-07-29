import { NextResponse } from "next/server";
import { verifyPgpKeyOwnership } from "@/lib/messaging-store";
import { isValidVerifyCodeFormat } from "@/lib/pgp";
import { isAuthError, requireRequestAuth, requireTrustedMutation } from "@/lib/request-auth";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRequestAuth(request, { scope: "pgp:write" });
  if (isAuthError(auth)) {
    return auth;
  }
  const originError = requireTrustedMutation(request, auth);
  if (originError) {
    return originError;
  }

  const rate = await consumeRequestRateLimit({
    namespace: "pgp-key-verify",
    key: auth.userId,
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
    const key = await verifyPgpKeyOwnership(auth.userId, code);
    return NextResponse.json({ key });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
