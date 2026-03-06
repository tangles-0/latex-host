import path from "path";
import { promises as fs } from "fs";
import { createHash, randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import {
  completeMultipartUpload,
  createMultipartUpload,
  del as blobDelete,
  get as blobGet,
  head as blobHead,
  uploadPart,
} from "@vercel/blob";
import { db } from "@/db";
import { uploadSessions } from "@/db/schema";
import { contentTypeForExt } from "@/lib/media-types";

type StorageBackend = "local" | "blob";

const DATA_DIR = path.join(process.cwd(), "data");
const SESSION_DIR = path.join(DATA_DIR, "upload-sessions");
const STORAGE_BACKEND =
  ((process.env.STORAGE_BACKEND as StorageBackend | undefined) ??
    (process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local")) as StorageBackend;
const MAX_SESSION_AGE_MS = 1000 * 60 * 60 * 24;
const STALE_UPLOAD_STATE_MS = 1000 * 60 * 15;
const MAX_CHUNK_SIZE = 32 * 1024 * 1024;
const MIN_CHUNK_SIZE = 1024 * 1024;
const BLOB_ACCESS = "private";

export type UploadSessionState = "initiated" | "uploading" | "finalizing" | "complete" | "failed";

export type UploadSessionEntry = {
  id: string;
  userId: string;
  backend: StorageBackend;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalParts: number;
  mimeType: string;
  ext: string;
  checksum?: string;
  state: UploadSessionState;
  storageKey?: string;
  s3UploadId?: string;
  uploadedParts: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export function listMissingUploadPartNumbers(session: Pick<UploadSessionEntry, "totalParts" | "uploadedParts">): number[] {
  const present = new Set(
    Object.keys(session.uploadedParts)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1),
  );
  const missing: number[] = [];
  for (let partNumber = 1; partNumber <= session.totalParts; partNumber += 1) {
    if (!present.has(partNumber)) {
      missing.push(partNumber);
    }
  }
  return missing;
}

function normalizeChunkSize(rawChunkSize: number): number {
  if (!Number.isFinite(rawChunkSize) || rawChunkSize <= 0) {
    return DEFAULT_CHUNK_SIZE;
  }
  return Math.max(MIN_CHUNK_SIZE, Math.min(MAX_CHUNK_SIZE, Math.floor(rawChunkSize)));
}

const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;

export function expectedPartSizeBytes(session: Pick<UploadSessionEntry, "fileSize" | "chunkSize" | "totalParts">, partNumber: number): number {
  const normalizedChunkSize = Math.max(1, Math.floor(session.chunkSize));
  if (partNumber < 1 || partNumber > session.totalParts) {
    throw new Error("Invalid part number.");
  }
  const bytesBefore = (partNumber - 1) * normalizedChunkSize;
  const remaining = Math.max(0, session.fileSize - bytesBefore);
  return Math.min(normalizedChunkSize, remaining);
}

function streamToHash(stream: ReadableStream<Uint8Array>): Promise<string> {
  const hash = createHash("sha256");
  const reader = stream.getReader();
  return (async () => {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      if (result.value) {
        hash.update(Buffer.from(result.value));
      }
    }
    return hash.digest("hex");
  })();
}

type InitInput = {
  userId: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  mimeType: string;
  ext: string;
  checksum?: string;
  targetType?: "image" | "video" | "document" | "other";
};

function mapSession(row: typeof uploadSessions.$inferSelect): UploadSessionEntry {
  let uploadedParts: Record<string, string> = {};
  try {
    uploadedParts = JSON.parse(row.uploadedPartsJson) as Record<string, string>;
  } catch {
    uploadedParts = {};
  }
  return {
    id: row.id,
    userId: row.userId,
    backend: row.backend as StorageBackend,
    fileName: row.fileName,
    fileSize: row.fileSize,
    chunkSize: row.chunkSize,
    totalParts: row.totalParts,
    mimeType: row.mimeType,
    ext: row.ext,
    checksum: row.checksum ?? undefined,
    state: row.state as UploadSessionState,
    storageKey: row.storageKey ?? undefined,
    s3UploadId: row.s3UploadId ?? undefined,
    uploadedParts,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildSessionStorageKey(id: string, ext: string, uploadedAt: Date): string {
  const year = uploadedAt.getUTCFullYear().toString();
  const month = String(uploadedAt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(uploadedAt.getUTCDate()).padStart(2, "0");
  return path.posix.join("uploads", year, month, day, "original", `${id}.${ext}`);
}

function sessionPartsDir(id: string): string {
  return path.join(SESSION_DIR, id, "parts");
}

async function ensureSessionDirs(id: string): Promise<void> {
  await fs.mkdir(sessionPartsDir(id), { recursive: true });
}

export async function initUploadSession(input: InitInput): Promise<UploadSessionEntry> {
  const chunkSize = normalizeChunkSize(input.chunkSize);
  if (input.checksum) {
    const existingRows = await db
      .select()
      .from(uploadSessions)
      .where(and(eq(uploadSessions.userId, input.userId), eq(uploadSessions.checksum, input.checksum)));
    const existing = existingRows
      .filter(
        (row) =>
          row.fileName === input.fileName &&
          row.fileSize === input.fileSize &&
          row.ext === input.ext &&
          row.mimeType === input.mimeType &&
          row.chunkSize === chunkSize &&
          row.state !== "complete",
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    if (existing) {
      if (STORAGE_BACKEND === "local") {
        await ensureSessionDirs(existing.id);
      }
      return mapSession(existing);
    }
  }

  const sessionId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MAX_SESSION_AGE_MS);
  const storageKey = buildSessionStorageKey(sessionId, input.ext, now);
  let s3UploadId: string | null = null;

  if (STORAGE_BACKEND === "local") {
    await ensureSessionDirs(sessionId);
  } else if (STORAGE_BACKEND === "blob") {
    const created = await createMultipartUpload(storageKey, {
      access: BLOB_ACCESS,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: input.mimeType || contentTypeForExt(input.ext),
    });
    s3UploadId = created.uploadId;
  }

  await db.insert(uploadSessions).values({
    id: sessionId,
    userId: input.userId,
    backend: STORAGE_BACKEND,
    targetType: input.targetType ?? "other",
    mimeType: input.mimeType,
    ext: input.ext,
    checksum: input.checksum ?? null,
    fileName: input.fileName,
    fileSize: input.fileSize,
    chunkSize,
    totalParts: Math.ceil(input.fileSize / chunkSize),
    state: "initiated",
    storageKey,
    s3UploadId,
    uploadedPartsJson: "{}",
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  const session = await getUploadSessionForUser(sessionId, input.userId);
  if (!session) {
    throw new Error("Upload session could not be created.");
  }
  return session;
}

export async function listIncompleteUploadSessionsForUser(userId: string): Promise<UploadSessionEntry[]> {
  await sweepStaleUploadSessionsForUser(userId);
  const rows = await db.select().from(uploadSessions).where(eq(uploadSessions.userId, userId));
  return rows
    .filter((row) => row.state !== "complete")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map((row) => mapSession(row));
}

export async function clearUploadSessionsForUser(
  userId: string,
  sessionIds: string[],
): Promise<{ cleared: number }> {
  if (sessionIds.length === 0) {
    return { cleared: 0 };
  }
  const rows = await db
    .select()
    .from(uploadSessions)
    .where(and(eq(uploadSessions.userId, userId), eq(uploadSessions.state, "failed")));
  const targetIds = new Set(sessionIds);
  const targets = rows.filter((row) => targetIds.has(row.id));

  for (const row of targets) {
    const mapped = mapSession(row);
    if (mapped.backend === "local") {
      await fs.rm(path.join(SESSION_DIR, mapped.id), { recursive: true, force: true });
    } else if (mapped.backend === "blob" && mapped.storageKey) {
      try {
        await blobDelete(mapped.storageKey);
      } catch {
        // Ignore if object was never finalized.
      }
    }
    await db.delete(uploadSessions).where(eq(uploadSessions.id, mapped.id));
  }
  return { cleared: targets.length };
}

export async function markUploadSessionFailedForUser(
  sessionId: string,
  userId: string,
  reason: string,
): Promise<void> {
  await db
    .update(uploadSessions)
    .set({
      state: "failed",
      error: reason.slice(0, 500),
      updatedAt: new Date(),
    })
    .where(and(eq(uploadSessions.id, sessionId), eq(uploadSessions.userId, userId)));
}

export async function sweepStaleUploadSessionsForUser(userId: string): Promise<number> {
  const now = Date.now();
  const rows = await db.select().from(uploadSessions).where(eq(uploadSessions.userId, userId));
  const stale = rows.filter((row) => {
    if (row.state !== "initiated" && row.state !== "uploading" && row.state !== "finalizing") {
      return false;
    }
    return now - row.updatedAt.getTime() > STALE_UPLOAD_STATE_MS;
  });

  for (const row of stale) {
    await db
      .update(uploadSessions)
      .set({
        state: "failed",
        error: "stale timeout",
        updatedAt: new Date(),
      })
      .where(and(eq(uploadSessions.id, row.id), eq(uploadSessions.userId, userId)));
  }
  return stale.length;
}

export async function getUploadSessionForUser(
  sessionId: string,
  userId: string,
): Promise<UploadSessionEntry | undefined> {
  const [row] = await db
    .select()
    .from(uploadSessions)
    .where(and(eq(uploadSessions.id, sessionId), eq(uploadSessions.userId, userId)))
    .limit(1);
  if (!row) {
    return undefined;
  }
  return mapSession(row);
}

async function patchUploadedParts(
  session: UploadSessionEntry,
  partNumber: number,
  etag: string,
  state: UploadSessionState = "uploading",
): Promise<void> {
  const nextParts = {
    ...session.uploadedParts,
    [String(partNumber)]: etag,
  };
  await db
    .update(uploadSessions)
    .set({
      uploadedPartsJson: JSON.stringify(nextParts),
      state,
      updatedAt: new Date(),
    })
    .where(eq(uploadSessions.id, session.id));
}

export async function uploadSessionPart(
  session: UploadSessionEntry,
  partNumber: number,
  data: Buffer,
): Promise<{ etag: string }> {
  if (partNumber < 1 || partNumber > session.totalParts) {
    throw new Error("Invalid part number.");
  }
  const expectedSize = expectedPartSizeBytes(session, partNumber);
  if (data.length !== expectedSize) {
    throw new Error(`Invalid part size for part ${partNumber}. Expected ${expectedSize} bytes.`);
  }

  if (session.backend === "local") {
    await ensureSessionDirs(session.id);
    const partPath = path.join(sessionPartsDir(session.id), `${partNumber}.part`);
    await fs.writeFile(partPath, data);
    const etag = `${data.length}-${partNumber}`;
    await patchUploadedParts(session, partNumber, etag);
    return { etag };
  }

  if (session.backend === "blob") {
    if (!session.storageKey || !session.s3UploadId) {
      throw new Error("Blob multipart upload session is not configured.");
    }
    const uploaded = await uploadPart(session.storageKey, data, {
      access: BLOB_ACCESS,
      addRandomSuffix: false,
      allowOverwrite: true,
      uploadId: session.s3UploadId,
      key: session.storageKey,
      partNumber,
      contentType: session.mimeType || contentTypeForExt(session.ext),
    });
    const etag = uploaded.etag ?? "";
    await patchUploadedParts(session, partNumber, etag);
    return { etag };
  }
  throw new Error("Unsupported upload backend.");
}

export async function completeUploadSession(session: UploadSessionEntry): Promise<UploadSessionEntry> {
  await db
    .update(uploadSessions)
    .set({ state: "finalizing", updatedAt: new Date() })
    .where(eq(uploadSessions.id, session.id));

  const refreshed = await getUploadSessionForUser(session.id, session.userId);
  if (!refreshed) {
    throw new Error("Upload session not found.");
  }

  const missingParts = listMissingUploadPartNumbers(refreshed);
  if (missingParts.length > 0) {
    throw new Error(`Upload is incomplete. Missing part(s): ${missingParts.join(", ")}`);
  }

  let computedChecksum: string | null = null;
  let computedSize = 0;

  if (refreshed.backend === "local") {
    const dir = sessionPartsDir(refreshed.id);
    const outPath = path.join(DATA_DIR, refreshed.storageKey ?? "");
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const hash = createHash("sha256");
    const buffers: Buffer[] = [];
    for (let partNumber = 1; partNumber <= refreshed.totalParts; partNumber += 1) {
      const partPath = path.join(dir, `${partNumber}.part`);
      const partBuffer = await fs.readFile(partPath);
      hash.update(partBuffer);
      computedSize += partBuffer.length;
      buffers.push(partBuffer);
    }
    computedChecksum = hash.digest("hex");
    await fs.writeFile(outPath, Buffer.concat(buffers));
    await fs.rm(path.join(SESSION_DIR, refreshed.id), { recursive: true, force: true });
  } else if (refreshed.backend === "blob") {
    if (!refreshed.storageKey || !refreshed.s3UploadId) {
      throw new Error("Blob upload session is not configured.");
    }
    const parts = Object.entries(refreshed.uploadedParts)
      .map(([partNumber, etag]) => ({
        etag,
        partNumber: Number(partNumber),
      }))
      .filter((item) => Number.isFinite(item.partNumber))
      .sort((a, b) => a.partNumber - b.partNumber);
    await completeMultipartUpload(refreshed.storageKey, parts, {
      access: BLOB_ACCESS,
      addRandomSuffix: false,
      allowOverwrite: true,
      uploadId: refreshed.s3UploadId,
      key: refreshed.storageKey,
      contentType: refreshed.mimeType || contentTypeForExt(refreshed.ext),
    });
    const metadata = await blobHead(refreshed.storageKey);
    const blobResponse = await blobGet(refreshed.storageKey, { access: BLOB_ACCESS, useCache: false });
    if (!blobResponse || blobResponse.statusCode !== 200 || !blobResponse.stream) {
      throw new Error("Unable to verify uploaded blob object.");
    }
    computedSize = metadata.size;
    computedChecksum = await streamToHash(blobResponse.stream);
  } else {
    throw new Error("Unsupported upload backend.");
  }

  if (computedSize !== refreshed.fileSize) {
    throw new Error("Uploaded file size does not match the declared file size.");
  }
  if (refreshed.checksum && computedChecksum && refreshed.checksum.toLowerCase() !== computedChecksum.toLowerCase()) {
    throw new Error("Uploaded file checksum did not match.");
  }

  await db
    .update(uploadSessions)
    .set({ state: "complete", updatedAt: new Date() })
    .where(eq(uploadSessions.id, session.id));
  const completed = await getUploadSessionForUser(session.id, session.userId);
  if (!completed) {
    throw new Error("Upload completion failed.");
  }
  return completed;
}

export async function abortUploadSession(session: UploadSessionEntry): Promise<void> {
  if (session.backend === "local") {
    await fs.rm(path.join(SESSION_DIR, session.id), { recursive: true, force: true });
  } else if (session.backend === "blob") {
    if (session.storageKey) {
      try {
        await blobDelete(session.storageKey);
      } catch {
        // No-op for unfinished multipart sessions.
      }
    }
  }
  await db
    .update(uploadSessions)
    .set({ state: "failed", error: "aborted", updatedAt: new Date() })
    .where(eq(uploadSessions.id, session.id));
}

export function getCompletedUploadPath(session: UploadSessionEntry): string {
  if (!session.storageKey) {
    throw new Error("Missing storage key.");
  }
  return path.join(DATA_DIR, session.storageKey);
}

