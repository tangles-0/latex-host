import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { contentTypeForExt } from "@/lib/media-types";
import {
  getPublicBlobToken,
  isPublicBlobConfigured,
} from "@/lib/public-blob";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";
import { getUploadSessionForUser } from "@/lib/upload-sessions";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  if (!isPublicBlobConfigured()) {
    return NextResponse.json(
      { error: "Public uploads are not available." },
      { status: 400 },
    );
  }
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const rate = await consumeRequestRateLimit({
    namespace: "upload-init",
    key: `${userId}:public`,
    limit: Number(process.env.UPLOAD_INIT_RATE_LIMIT_PER_MINUTE ?? 30),
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many public upload requests. Please retry shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const body = (await request.json()) as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token: getPublicBlobToken(),
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let sessionId = "";
        if (clientPayload) {
          try {
            const parsed = JSON.parse(clientPayload) as { sessionId?: string };
            sessionId = parsed.sessionId?.trim() ?? "";
          } catch {
            sessionId = "";
          }
        }
        if (!sessionId) {
          throw new Error("Public upload session is required.");
        }
        const session = await getUploadSessionForUser(sessionId, userId);
        if (!session || session.backend !== "public-blob") {
          throw new Error("Public upload session not found.");
        }
        if (session.storageKey !== pathname) {
          throw new Error("Public upload path does not match the session.");
        }
        if (session.state === "complete") {
          throw new Error("Public upload session is already complete.");
        }
        return {
          allowedContentTypes: [
            session.mimeType || contentTypeForExt(session.ext),
          ],
          maximumSizeInBytes: session.fileSize,
          addRandomSuffix: false,
          allowOverwrite: true,
          validUntil: Date.now() + 1000 * 60 * 60,
          tokenPayload: JSON.stringify({ sessionId, userId }),
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start public upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
