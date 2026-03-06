import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getAppSettings, getGroupLimits, getMaxAllowedBytesForKind, getUserGroupInfo } from "@/lib/metadata-store";
import { extFromFileName, mediaKindFromType } from "@/lib/media-types";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";
import { initUploadSession } from "@/lib/upload-sessions";

export const runtime = "nodejs";

const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;
const MIN_CHUNK_SIZE = 1024 * 1024;
const MAX_CHUNK_SIZE = 32 * 1024 * 1024;

function isAllowedType(allowed: string[], mime: string): boolean {
  if (allowed.length === 0) {
    return true;
  }
  return allowed.some((type) => {
    if (type.endsWith("/*")) {
      return mime.startsWith(type.replace("/*", "/"));
    }
    return mime === type;
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const rate = await consumeRequestRateLimit({
    namespace: "upload-init",
    key: userId,
    limit: Number(process.env.UPLOAD_INIT_RATE_LIMIT_PER_MINUTE ?? 30),
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many upload session requests. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const payload = (await request.json()) as {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    chunkSize?: number;
    checksum?: string;
    targetType?: "image" | "video" | "document" | "other";
  };

  const fileName = payload.fileName?.trim() ?? "";
  const fileSize = Number(payload.fileSize ?? 0);
  const mimeType = payload.mimeType?.trim() ?? "application/octet-stream";
  const chunkSizeRaw = Number(payload.chunkSize ?? DEFAULT_CHUNK_SIZE);
  const chunkSize = Math.max(MIN_CHUNK_SIZE, Math.min(MAX_CHUNK_SIZE, Math.floor(chunkSizeRaw)));
  const ext = extFromFileName(fileName);
  const checksum = payload.checksum?.trim() || undefined;

  if (!fileName || !ext) {
    return NextResponse.json({ error: "File name with extension is required." }, { status: 400 });
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return NextResponse.json({ error: "File size must be greater than 0." }, { status: 400 });
  }
  if (!Number.isFinite(chunkSizeRaw) || chunkSizeRaw <= 0) {
    return NextResponse.json({ error: "chunkSize must be greater than 0." }, { status: 400 });
  }
  if (checksum && !/^[a-fA-F0-9]{64}$/.test(checksum)) {
    return NextResponse.json({ error: "checksum must be a SHA-256 hex string." }, { status: 400 });
  }
  const [groupInfo, settings] = await Promise.all([getUserGroupInfo(userId), getAppSettings()]);
  if (!settings.uploadsEnabled) {
    return NextResponse.json({ error: "Uploads are currently disabled." }, { status: 403 });
  }
  const groupLimits = await getGroupLimits(groupInfo.groupId);
  if (!isAllowedType(groupLimits.allowedTypes, mimeType)) {
    return NextResponse.json({ error: "File type is not allowed." }, { status: 415 });
  }
  const kind = mediaKindFromType(mimeType, ext);
  if (fileSize > getMaxAllowedBytesForKind(groupLimits, kind)) {
    return NextResponse.json({ error: "File exceeds size limit." }, { status: 413 });
  }

  const session = await initUploadSession({
    userId,
    fileName,
    fileSize,
    chunkSize,
    mimeType,
    ext,
    checksum,
    targetType: payload.targetType ?? kind,
  });

  return NextResponse.json({
    sessionId: session.id,
    chunkSize: session.chunkSize,
    totalParts: session.totalParts,
    uploadedParts: session.uploadedParts,
  });
}

