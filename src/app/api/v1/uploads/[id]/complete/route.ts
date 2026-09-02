import { getAlbumForUser, getAppSettings } from "@/lib/metadata-store";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";
import {
  completeUploadSession,
  getUploadSessionForUser,
  listMissingUploadPartNumbers,
  markUploadSessionFailedForUser,
} from "@/lib/upload-sessions";
import { withApiV1ParamsRoute } from "@/lib/api-v1/handler";
import { apiV1Error, apiV1Json } from "@/lib/api-v1/errors";
import {
  ensureShareForVisibility,
  registerMediaFromUploadSession,
} from "@/lib/api-v1/media-register";
import { sharePrefixFromRequest, toFileResource } from "@/lib/api-v1/resources";
import { completeUploadBodySchema } from "@/lib/api-v1/schemas";

export const runtime = "nodejs";

export const POST = withApiV1ParamsRoute(async (request, auth, context) => {
  const params = await context.params;
  const id = params.id?.trim() ?? "";
  if (!id) {
    return apiV1Error(400, "invalid_request", "id is required.");
  }

  const settings = await getAppSettings();
  if (!settings.uploadsEnabled) {
    return apiV1Error(
      403,
      "uploads_disabled",
      "Uploads are currently disabled.",
    );
  }

  const rate = await consumeRequestRateLimit({
    namespace: "api-v1-upload-complete",
    key: auth.userId,
    limit: Number(process.env.UPLOAD_COMPLETE_RATE_LIMIT_PER_MINUTE ?? 30),
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return apiV1Error(
      429,
      "rate_limited",
      "Too many upload completion attempts. Please retry shortly.",
      undefined,
      { "Retry-After": String(rate.retryAfterSeconds) },
    );
  }

  const json: unknown = await request.json().catch(() => ({}));
  const parsed = completeUploadBodySchema.safeParse(json);
  if (!parsed.success) {
    return apiV1Error(
      400,
      "invalid_request",
      "Invalid complete payload.",
      parsed.error.flatten(),
    );
  }

  const albumId = parsed.data.albumId?.trim() || undefined;
  if (albumId) {
    const album = await getAlbumForUser(albumId, auth.userId);
    if (!album) {
      return apiV1Error(404, "not_found", "Album not found.");
    }
  }

  const session = await getUploadSessionForUser(id, auth.userId);
  if (!session) {
    return apiV1Error(404, "not_found", "Upload session not found.");
  }

  if (
    parsed.data.expectedTotalParts &&
    parsed.data.expectedTotalParts !== session.totalParts
  ) {
    return apiV1Error(
      400,
      "invalid_request",
      "Upload manifest does not match session metadata.",
    );
  }

  const missing = listMissingUploadPartNumbers(session);
  if (missing.length > 0) {
    return apiV1Error(409, "conflict", "Upload is missing parts.", {
      missingParts: missing,
    });
  }

  let completed;
  try {
    completed = await completeUploadSession(session);
  } catch (error) {
    await markUploadSessionFailedForUser(
      session.id,
      auth.userId,
      error instanceof Error ? error.message : "complete failed",
    );
    return apiV1Error(
      500,
      "internal_error",
      error instanceof Error ? error.message : "Failed to complete upload.",
    );
  }

  if (!completed.storageKey) {
    return apiV1Error(
      500,
      "internal_error",
      "Upload completed without storage key.",
    );
  }

  const media = await registerMediaFromUploadSession({
    request,
    userId: auth.userId,
    session: {
      storageKey: completed.storageKey,
      fileName: completed.fileName,
      fileSize: completed.fileSize,
      mimeType: completed.mimeType,
      ext: completed.ext,
    },
    albumId,
    keepOriginalFileName: parsed.data.keepOriginalFileName,
  });

  const share = await ensureShareForVisibility({
    kind: media.kind,
    mediaId: media.id,
    userId: auth.userId,
    visibility: parsed.data.visibility,
  });

  const resource = toFileResource({
    media,
    sharePrefix: await sharePrefixFromRequest(request),
    visibility: share.visibility,
    shareCode: share.code,
  });

  return apiV1Json(
    { file: resource },
    { status: 201, location: resource.links.self },
  );
});

export const OPTIONS = POST;
