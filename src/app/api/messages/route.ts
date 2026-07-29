import { NextResponse } from "next/server";
import { listMessageThreads, sendEncryptedMessage } from "@/lib/messaging-store";
import { PGP_MAX_CIPHERTEXT_BYTES, mapPgpError } from "@/lib/pgp";
import { isAuthError, requireRequestAuth, requireTrustedMutation } from "@/lib/request-auth";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRequestAuth(request, { scope: "messages:read" });
  if (isAuthError(auth)) {
    return auth;
  }

  const result = await listMessageThreads(auth.userId);
  return NextResponse.json(result);
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRequestAuth(request, { scope: "messages:send" });
  if (isAuthError(auth)) {
    return auth;
  }
  const originError = requireTrustedMutation(request, auth);
  if (originError) {
    return originError;
  }

  const rate = await consumeRequestRateLimit({
    namespace: "messages-send",
    key: auth.userId,
    limit: 30,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many messages sent." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const payload = (await request.json()) as {
    recipientFingerprint?: string;
    ciphertext?: string;
  };
  const recipientFingerprint =
    typeof payload.recipientFingerprint === "string"
      ? payload.recipientFingerprint.trim()
      : "";
  const ciphertext =
    typeof payload.ciphertext === "string" ? payload.ciphertext.trim() : "";
  if (!recipientFingerprint || !ciphertext) {
    return NextResponse.json(
      { error: "Recipient fingerprint and ciphertext are required." },
      { status: 400 },
    );
  }
  if (Buffer.byteLength(ciphertext, "utf8") > PGP_MAX_CIPHERTEXT_BYTES) {
    return NextResponse.json(
      { error: "Encrypted message exceeds size limit." },
      { status: 413 },
    );
  }

  try {
    const message = await sendEncryptedMessage({
      senderUserId: auth.userId,
      recipientFingerprint,
      ciphertext,
    });
    return NextResponse.json({ message });
  } catch (error) {
    const message = mapPgpError(error, "Failed to send message.");
    const status = message.includes("size limit") ? 413 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
