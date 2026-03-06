import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  completeUploadSession,
  getUploadSessionForUser,
  listMissingUploadPartNumbers,
  markUploadSessionFailedForUser,
} from "@/lib/upload-sessions";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const rate = await consumeRequestRateLimit({
    namespace: "upload-complete",
    key: userId,
    limit: Number(process.env.UPLOAD_COMPLETE_RATE_LIMIT_PER_MINUTE ?? 30),
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many upload completion attempts. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const payload = (await request.json()) as {
    sessionId?: string;
    expectedTotalParts?: number;
    checksum?: string;
  };
  const sessionId = payload.sessionId?.trim() ?? "";
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }

  const session = await getUploadSessionForUser(sessionId, userId);
  if (!session) {
    return NextResponse.json({ error: "Upload session not found." }, { status: 404 });
  }
  if (
    Number.isFinite(payload.expectedTotalParts) &&
    Number(payload.expectedTotalParts) > 0 &&
    Number(payload.expectedTotalParts) !== session.totalParts
  ) {
    return NextResponse.json({ error: "Upload manifest does not match session metadata." }, { status: 409 });
  }
  if (payload.checksum?.trim() && session.checksum && payload.checksum.trim() !== session.checksum) {
    return NextResponse.json({ error: "Upload checksum manifest does not match session metadata." }, { status: 409 });
  }
  const missingParts = listMissingUploadPartNumbers(session);
  if (missingParts.length > 0) {
    return NextResponse.json(
      { error: `Upload is incomplete. Missing part(s): ${missingParts.join(", ")}` },
      { status: 409 },
    );
  }

  try {
    const completed = await completeUploadSession(session);
    return NextResponse.json({
      sessionId: completed.id,
      state: completed.state,
      storageKey: completed.storageKey,
      fileName: completed.fileName,
      mimeType: completed.mimeType,
      ext: completed.ext,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete upload.";
    const status =
      message.includes("incomplete") || message.includes("checksum") || message.includes("size does not match")
        ? 409
        : 500;
    await markUploadSessionFailedForUser(
      sessionId,
      userId,
      message,
    );
    return NextResponse.json({ error: message }, { status });
  }
}

