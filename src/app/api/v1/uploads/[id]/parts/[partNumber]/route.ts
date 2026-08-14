import { withApiV1ParamsRoute } from "@/lib/api-v1/handler";
import { apiV1Error, apiV1Json } from "@/lib/api-v1/errors";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";
import {
  expectedPartSizeBytes,
  getUploadSessionForUser,
  markUploadSessionFailedForUser,
  recordUploadSessionPart,
  uploadSessionPart,
} from "@/lib/upload-sessions";

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

export const PUT = withApiV1ParamsRoute(async (request, auth, context) => {
  const params = await context.params;
  const id = params.id?.trim() ?? "";
  const partNumber = Number(params.partNumber ?? 0);
  if (!id || !Number.isFinite(partNumber) || partNumber <= 0) {
    return apiV1Error(
      400,
      "invalid_request",
      "id and partNumber are required.",
    );
  }

  const partRate = await consumeRequestRateLimit({
    namespace: "api-v1-upload-part-user",
    key: auth.userId,
    limit: Number(process.env.UPLOAD_PART_RATE_LIMIT_PER_MINUTE ?? 360),
    windowSeconds: 60,
  });
  if (!partRate.allowed) {
    return apiV1Error(
      429,
      "rate_limited",
      "Upload rate limit exceeded.",
      undefined,
      { "Retry-After": String(partRate.retryAfterSeconds) },
    );
  }

  try {
    const session = await getUploadSessionForUser(id, auth.userId);
    if (!session) {
      return apiV1Error(404, "not_found", "Upload session not found.");
    }
    if (session.state === "complete" || session.state === "finalizing") {
      return apiV1Error(409, "conflict", "Upload session is not writable.");
    }

    const sessionRate = await consumeRequestRateLimit({
      namespace: "api-v1-upload-part-session",
      key: session.id,
      limit: Number(
        process.env.UPLOAD_PART_PER_SESSION_RATE_LIMIT_PER_MINUTE ?? 480,
      ),
      windowSeconds: 60,
    });
    if (!sessionRate.allowed) {
      return apiV1Error(
        429,
        "rate_limited",
        "This upload session is receiving too many chunk requests.",
        undefined,
        { "Retry-After": String(sessionRate.retryAfterSeconds) },
      );
    }

    const contentType =
      request.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType.startsWith("application/json")) {
      const payload = (await request.json()) as { etag?: string };
      const etag = payload.etag?.trim() ?? "";
      if (!etag) {
        return apiV1Error(400, "invalid_request", "etag is required.");
      }
      await recordUploadSessionPart(session, partNumber, etag);
      return apiV1Json({ etag, partNumber });
    }

    const data = Buffer.from(await request.arrayBuffer());
    const expectedSize = expectedPartSizeBytes(session, partNumber);
    if (data.length !== expectedSize) {
      return apiV1Error(
        400,
        "invalid_request",
        `Invalid chunk size for part ${partNumber}. Expected ${expectedSize} bytes.`,
        { expectedSize, actualSize: data.length },
      );
    }
    const uploaded = await uploadSessionPart(session, partNumber, data);
    return apiV1Json({ etag: uploaded.etag, partNumber });
  } catch (error) {
    if (isConnectionResetError(error)) {
      await markUploadSessionFailedForUser(id, auth.userId, "connection reset");
      return apiV1Error(499, "conflict", "Upload interrupted.");
    }
    throw error;
  }
});

export const OPTIONS = PUT;
