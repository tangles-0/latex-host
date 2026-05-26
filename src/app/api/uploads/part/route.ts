import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  expectedPartSizeBytes,
  getUploadSessionForUser,
  markUploadSessionFailedForUser,
  recordUploadSessionPart,
  uploadSessionPart,
} from "@/lib/upload-sessions";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";
import { isWorkerIngestAuthorized } from "@/lib/preview-worker";

export const runtime = "nodejs";

function isConnectionResetError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as Error & { code?: string }).code ?? "";
  if (
    code === "ECONNRESET" ||
    code === "ERR_STREAM_PREMATURE_CLOSE" ||
    code === "UND_ERR_SOCKET"
  ) {
    return true;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("econnreset") ||
    message.includes("aborted") ||
    message.includes("premature close") ||
    message.includes("socket")
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const isWorkerRequest = isWorkerIngestAuthorized(request);
  const sessionUserId = await getSessionUserId();
  let hintedSessionId =
    request.headers.get("x-upload-session-id")?.trim() ?? "";
  let requestUserId = sessionUserId ?? "";
  try {
    const contentType =
      request.headers.get("content-type")?.toLowerCase() ?? "";
    let sessionId = hintedSessionId;
    let partNumber = Number(request.headers.get("x-upload-part-number") ?? 0);
    let userId = requestUserId;
    let data: Buffer | null = null;
    let etag = "";

    if (contentType.startsWith("application/json")) {
      const payload = (await request.json()) as {
        userId?: string;
        sessionId?: string;
        partNumber?: number;
        etag?: string;
      };
      userId =
        userId || (isWorkerRequest ? (payload.userId?.trim() ?? "") : "");
      sessionId = payload.sessionId?.trim() ?? hintedSessionId;
      partNumber = Number(payload.partNumber ?? 0);
      etag = payload.etag?.trim() ?? "";
    } else if (contentType.startsWith("application/octet-stream")) {
      userId =
        userId ||
        (isWorkerRequest
          ? (request.headers.get("x-upload-user-id")?.trim() ?? "")
          : "");
      data = Buffer.from(await request.arrayBuffer());
    } else {
      const formData = await request.formData();
      const formUserId = formData.get("userId");
      userId =
        userId ||
        (isWorkerRequest && typeof formUserId === "string"
          ? formUserId.trim()
          : "");
      const formSessionId = formData.get("sessionId");
      sessionId =
        typeof formSessionId === "string"
          ? formSessionId.trim()
          : formSessionId instanceof File
            ? formSessionId.name.trim()
            : hintedSessionId;
      partNumber = Number(formData.get("partNumber") ?? 0);
      const filePart = formData.get("chunk");
      if (!(filePart instanceof File)) {
        return NextResponse.json(
          { error: "chunk file is required." },
          { status: 400 },
        );
      }
      data = Buffer.from(await filePart.arrayBuffer());
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    requestUserId = userId;
    if (!isWorkerRequest) {
      const partRate = await consumeRequestRateLimit({
        namespace: "upload-part-user",
        key: userId,
        limit: Number(process.env.UPLOAD_PART_RATE_LIMIT_PER_MINUTE ?? 360),
        windowSeconds: 60,
      });
      if (!partRate.allowed) {
        return NextResponse.json(
          { error: "Upload rate limit exceeded." },
          {
            status: 429,
            headers: { "Retry-After": String(partRate.retryAfterSeconds) },
          },
        );
      }
    }

    hintedSessionId = sessionId || hintedSessionId;
    if (!sessionId || !Number.isFinite(partNumber) || partNumber <= 0) {
      return NextResponse.json(
        { error: "sessionId and partNumber are required." },
        { status: 400 },
      );
    }

    const session = await getUploadSessionForUser(sessionId, userId);
    if (!session) {
      return NextResponse.json(
        { error: "Upload session not found." },
        { status: 404 },
      );
    }
    if (session.state === "complete" || session.state === "finalizing") {
      return NextResponse.json(
        { error: "Upload session is not writable." },
        { status: 409 },
      );
    }
    const sessionRate = await consumeRequestRateLimit({
      namespace: "upload-part-session",
      key: session.id,
      limit: Number(
        process.env.UPLOAD_PART_PER_SESSION_RATE_LIMIT_PER_MINUTE ?? 480,
      ),
      windowSeconds: 60,
    });
    if (!sessionRate.allowed) {
      return NextResponse.json(
        { error: "This upload session is receiving too many chunk requests." },
        {
          status: 429,
          headers: { "Retry-After": String(sessionRate.retryAfterSeconds) },
        },
      );
    }

    if (data) {
      const expectedSize = expectedPartSizeBytes(session, partNumber);
      if (data.length !== expectedSize) {
        return NextResponse.json(
          {
            error: `Invalid chunk size for part ${partNumber}. Expected ${expectedSize} bytes.`,
          },
          { status: 400 },
        );
      }
      const uploaded = await uploadSessionPart(session, partNumber, data);
      return NextResponse.json({ etag: uploaded.etag, partNumber });
    }
    if (!etag) {
      return NextResponse.json({ error: "etag is required." }, { status: 400 });
    }
    await recordUploadSessionPart(session, partNumber, etag);
    return NextResponse.json({ etag, partNumber });
  } catch (error) {
    if (hintedSessionId && isConnectionResetError(error)) {
      await markUploadSessionFailedForUser(
        hintedSessionId,
        requestUserId,
        "connection reset",
      );
      return NextResponse.json(
        { error: "Upload interrupted." },
        { status: 499 },
      );
    }
    throw error;
  }
}
