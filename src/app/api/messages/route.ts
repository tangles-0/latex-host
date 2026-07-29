import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { listMessageThreads, sendEncryptedMessage } from "@/lib/messaging-store";
import { PGP_MAX_CIPHERTEXT_BYTES, mapPgpError } from "@/lib/pgp";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";
import { hasTrustedOrigin } from "@/lib/request-security";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await listMessageThreads(userId);
  return NextResponse.json(result);
}

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  const rate = await consumeRequestRateLimit({
    namespace: "messages-send",
    key: userId,
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
      senderUserId: userId,
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
