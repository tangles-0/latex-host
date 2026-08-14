import {
  getAppSettings,
  getGroupLimits,
  getMaxAllowedBytesForKind,
  getUserGroupInfo,
} from "@/lib/metadata-store";
import {
  contentTypeForExt,
  extFromFileName,
  mediaKindFromType,
} from "@/lib/media-types";
import { isAllowedUploadType } from "@/lib/upload-allowlist";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";
import {
  getBlobMultipartClientState,
  initUploadSession,
} from "@/lib/upload-sessions";
import { withApiV1Route } from "@/lib/api-v1/handler";
import {
  apiV1Error,
  apiV1Json,
  rateLimitHeaders,
} from "@/lib/api-v1/errors";
import { createUploadBodySchema } from "@/lib/api-v1/schemas";

export const runtime = "nodejs";

const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;

export const POST = withApiV1Route(async (request, auth) => {
  const settings = await getAppSettings();
  if (!settings.uploadsEnabled) {
    return apiV1Error(403, "uploads_disabled", "Uploads are currently disabled.");
  }

  const rate = await consumeRequestRateLimit({
    namespace: "api-v1-upload-init",
    key: auth.userId,
    limit: Number(process.env.UPLOAD_INIT_RATE_LIMIT_PER_MINUTE ?? 30),
    windowSeconds: 60,
  });
  const rateHeaders = rateLimitHeaders({
    limit: Number(process.env.UPLOAD_INIT_RATE_LIMIT_PER_MINUTE ?? 30),
    remaining:
      Number(process.env.UPLOAD_INIT_RATE_LIMIT_PER_MINUTE ?? 30) - rate.count,
    resetSeconds: rate.retryAfterSeconds,
  });
  if (!rate.allowed) {
    return apiV1Error(
      429,
      "rate_limited",
      "Too many upload session requests. Please retry shortly.",
      undefined,
      { ...rateHeaders, "Retry-After": String(rate.retryAfterSeconds) },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = createUploadBodySchema.safeParse(json);
  if (!parsed.success) {
    return apiV1Error(
      400,
      "invalid_request",
      "Invalid upload init payload.",
      parsed.error.flatten(),
    );
  }

  const fileName = parsed.data.fileName.trim();
  const fileSize = parsed.data.fileSize;
  const mimeType = parsed.data.mimeType?.trim() || "application/octet-stream";
  const chunkSize = parsed.data.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const checksum = parsed.data.checksum;
  const ext = extFromFileName(fileName);
  if (!ext) {
    return apiV1Error(
      400,
      "invalid_request",
      "File name with extension is required.",
    );
  }

  const threshold = settings.resumableThresholdBytes;
  if (fileSize < threshold) {
    return apiV1Error(
      400,
      "use_simple_upload",
      `File is ${fileSize} bytes; multipart uploads require at least ${threshold} bytes. Use POST /api/v1/files.`,
      { resumableThresholdBytes: threshold, fileSize },
    );
  }

  const groupInfo = await getUserGroupInfo(auth.userId);
  const groupLimits = await getGroupLimits(groupInfo.groupId);
  if (
    !isAllowedUploadType({
      allowed: groupLimits.allowedTypes,
      mimeType: mimeType === "application/octet-stream" ? contentTypeForExt(ext) : mimeType,
      ext,
    })
  ) {
    return apiV1Error(415, "unsupported_media_type", "File type is not allowed.");
  }

  const effectiveMime =
    mimeType === "application/octet-stream" ? contentTypeForExt(ext) : mimeType;
  const kind = mediaKindFromType(effectiveMime, ext);
  const maxAllowedBytes = getMaxAllowedBytesForKind(groupLimits, kind);
  if (fileSize > maxAllowedBytes) {
    return apiV1Error(
      413,
      "payload_too_large",
      "File exceeds size limit.",
      { maxAllowedBytes, fileSize },
    );
  }

  const session = await initUploadSession({
    userId: auth.userId,
    fileName,
    fileSize,
    chunkSize,
    mimeType: effectiveMime,
    ext,
    checksum,
    targetType: kind,
  });

  const multipart = await getBlobMultipartClientState(session);
  return apiV1Json(
    {
      upload: {
        id: session.id,
        chunkSize: session.chunkSize,
        totalParts: session.totalParts,
        uploadedParts: session.uploadedParts,
        storageKey: session.storageKey,
        transport: multipart ? "vercel-blob" : "server",
        multipart: multipart ?? null,
      },
    },
    {
      status: 201,
      location: `/api/v1/uploads/${session.id}`,
      headers: rateHeaders,
    },
  );
});

export const OPTIONS = POST;
