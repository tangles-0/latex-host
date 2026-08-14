import {
  getAlbumForUser,
  getAppSettings,
  getGroupLimits,
  getMaxAllowedBytesForKind,
  getUserGroupInfo,
  isAdminUser,
} from "@/lib/metadata-store";
import {
  contentTypeForExt,
  extFromFileName,
  mediaKindFromType,
} from "@/lib/media-types";
import { isAllowedUploadType } from "@/lib/upload-allowlist";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";
import { withApiV1Route } from "@/lib/api-v1/handler";
import {
  apiV1Error,
  apiV1Json,
  rateLimitHeaders,
} from "@/lib/api-v1/errors";
import {
  ensureShareForVisibility,
  registerMediaFromBuffer,
  resolveVisibilityForMedia,
} from "@/lib/api-v1/media-register";
import { listFilesPageForUser } from "@/lib/api-v1/list";
import { originFromRequest, toFileResource } from "@/lib/api-v1/resources";
import { listQuerySchema, visibilitySchema } from "@/lib/api-v1/schemas";

export const runtime = "nodejs";

export const GET = withApiV1Route(async (request, auth) => {
  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    kind: url.searchParams.get("kind") ?? undefined,
    albumId: url.searchParams.get("albumId") ?? undefined,
  });
  if (!parsed.success) {
    return apiV1Error(
      400,
      "invalid_request",
      "Invalid query parameters.",
      parsed.error.flatten(),
    );
  }

  if (parsed.data.albumId) {
    const album = await getAlbumForUser(parsed.data.albumId, auth.userId);
    if (!album) {
      return apiV1Error(404, "not_found", "Album not found.");
    }
  }

  const page = await listFilesPageForUser({
    userId: auth.userId,
    limit: parsed.data.limit,
    cursor: parsed.data.cursor,
    kind: parsed.data.kind,
    albumId: parsed.data.albumId,
  });
  const origin = originFromRequest(request);
  const files = await Promise.all(
    page.items.map(async (media) => {
      const share = await resolveVisibilityForMedia({
        kind: media.kind,
        mediaId: media.id,
        userId: auth.userId,
      });
      return toFileResource({
        media,
        origin,
        visibility: share.visibility,
        shareCode: share.shareCode,
      });
    }),
  );
  return apiV1Json({ files, nextCursor: page.nextCursor });
});

export const POST = withApiV1Route(async (request, auth) => {
  const [groupInfo, isAdmin, settings] = await Promise.all([
    getUserGroupInfo(auth.userId),
    isAdminUser(auth.userId),
    getAppSettings(),
  ]);
  if (!settings.uploadsEnabled) {
    return apiV1Error(403, "uploads_disabled", "Uploads are currently disabled.");
  }
  const groupLimits = await getGroupLimits(groupInfo.groupId);
  const rate = await consumeRequestRateLimit({
    namespace: "api-v1-files",
    key: auth.userId,
    limit: groupLimits.rateLimitPerMinute,
    windowSeconds: 60,
  });
  const rateHeaders = rateLimitHeaders({
    limit: groupLimits.rateLimitPerMinute,
    remaining: groupLimits.rateLimitPerMinute - rate.count,
    resetSeconds: rate.retryAfterSeconds,
  });
  if (!rate.allowed && !isAdmin) {
    return apiV1Error(
      429,
      "rate_limited",
      "Rate limit exceeded.",
      undefined,
      { ...rateHeaders, "Retry-After": String(rate.retryAfterSeconds) },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const albumIdValue = formData.get("albumId");
  const visibilityRaw = formData.get("visibility");
  const keepOriginalFileNameValue = formData.get("keepOriginalFileName");
  const albumId =
    typeof albumIdValue === "string"
      ? albumIdValue.trim() || undefined
      : undefined;
  const keepOriginalFileName =
    typeof keepOriginalFileNameValue === "string" &&
    (keepOriginalFileNameValue === "1" ||
      keepOriginalFileNameValue.toLowerCase() === "true");

  const visibilityParsed = visibilitySchema.safeParse(
    typeof visibilityRaw === "string" && visibilityRaw.trim()
      ? visibilityRaw.trim()
      : "private",
  );
  if (!visibilityParsed.success) {
    return apiV1Error(
      400,
      "invalid_request",
      "visibility must be private or public.",
    );
  }
  const visibility = visibilityParsed.data;

  if (!(file instanceof File)) {
    return apiV1Error(400, "invalid_request", "file is required.");
  }
  const ext = extFromFileName(file.name);
  if (!ext) {
    return apiV1Error(400, "invalid_request", "File extension is required.");
  }
  const mimeType = file.type || contentTypeForExt(ext);
  const kind = mediaKindFromType(mimeType, ext);
  if (
    !isAllowedUploadType({
      allowed: groupLimits.allowedTypes,
      mimeType,
      ext,
    })
  ) {
    return apiV1Error(415, "unsupported_media_type", "File type is not allowed.");
  }

  const threshold = settings.resumableThresholdBytes;
  if (file.size >= threshold) {
    return apiV1Error(
      413,
      "use_multipart",
      `File is ${file.size} bytes; simple uploads must be smaller than ${threshold} bytes. Use POST /api/v1/uploads.`,
      { resumableThresholdBytes: threshold, fileSize: file.size },
      rateHeaders,
    );
  }

  const maxAllowedBytes = getMaxAllowedBytesForKind(groupLimits, kind);
  if (file.size > maxAllowedBytes) {
    return apiV1Error(
      413,
      "payload_too_large",
      "File exceeds size limit.",
      { maxAllowedBytes, fileSize: file.size },
      rateHeaders,
    );
  }

  if (albumId) {
    const album = await getAlbumForUser(albumId, auth.userId);
    if (!album) {
      return apiV1Error(404, "not_found", "Album not found.");
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const media = await registerMediaFromBuffer({
    request,
    userId: auth.userId,
    buffer,
    fileName: file.name,
    mimeType,
    ext,
    albumId,
    keepOriginalFileName,
  });

  const share = await ensureShareForVisibility({
    kind: media.kind,
    mediaId: media.id,
    userId: auth.userId,
    visibility,
  });

  const origin = originFromRequest(request);
  const resource = toFileResource({
    media,
    origin,
    visibility: share.visibility,
    shareCode: share.code,
  });

  return apiV1Json(
    { file: resource },
    {
      status: 201,
      location: resource.links.self,
      headers: rateHeaders,
    },
  );
});

export const OPTIONS = GET;
