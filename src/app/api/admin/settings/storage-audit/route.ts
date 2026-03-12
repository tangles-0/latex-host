import { NextResponse } from "next/server";
import { del as blobDelete, head as blobHead, list as blobList } from "@vercel/blob";
import { and, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  documentShares,
  documents,
  fileShares,
  files,
  images,
  shares,
  uploadSessions,
  videoShares,
  videos,
} from "@/db/schema";
import { getSessionUserId } from "@/lib/auth";
import type { BlobMediaKind } from "@/lib/media-types";
import { isAdminUser } from "@/lib/metadata-store";

export const runtime = "nodejs";

type MissingRecord = {
  kind: BlobMediaKind;
  id: string;
  baseName: string;
  ext: string;
  uploadedAt: string;
  missingKeys: string[];
  missingOriginal: boolean;
};

type AuditPayload = {
  action?: "audit" | "cleanupMissingRecords" | "cleanupOrphanedFiles";
};

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await isAdminUser(userId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if ((process.env.STORAGE_BACKEND ?? "blob") !== "blob") {
    return NextResponse.json({ error: "Storage audit is only available for Blob backend." }, { status: 400 });
  }

  const payload = (await request.json().catch(() => ({}))) as AuditPayload;
  const action = payload.action ?? "audit";
  const audit = await runStorageAudit();

  if (action === "cleanupMissingRecords") {
    const deletedRecords = await cleanupMissingRecordEntries(audit.missingRecords);
    return NextResponse.json({ ok: true, deletedRecords, missingRecords: audit.missingRecords.length });
  }
  if (action === "cleanupOrphanedFiles") {
    const deletedBlobs = await cleanupOrphanedBlobFiles(audit.orphanedBlobPathnames);
    return NextResponse.json({ ok: true, deletedBlobs, orphanedBlobFiles: audit.orphanedBlobPathnames.length });
  }
  return NextResponse.json(audit);
}

async function runStorageAudit(): Promise<{
  expectedBlobPathCount: number;
  blobPathCount: number;
  missingRecords: MissingRecord[];
  orphanedBlobPathnames: string[];
}> {
  const [imageRows, videoRows, documentRows, fileRows, uploadSessionRows] = await Promise.all([
    db.select().from(images),
    db.select().from(videos),
    db.select().from(documents),
    db.select().from(files),
    db
      .select({ storageKey: uploadSessions.storageKey })
      .from(uploadSessions)
      .where(and(isNotNull(uploadSessions.storageKey), ne(uploadSessions.state, "failed"))),
  ]);

  const expected = new Set<string>();
  const missingRecords: MissingRecord[] = [];

  const evaluateMedia = async (input: {
    kind: BlobMediaKind;
    id: string;
    baseName: string;
    ext: string;
    uploadedAt: Date;
    requiredSizes: Array<"original" | "sm" | "lg">;
    previewExt: string;
  }) => {
    const missingKeys: string[] = [];
    for (const size of input.requiredSizes) {
      const ext = size === "original" ? input.ext : input.previewExt;
      const pathname = buildStoragePathname(input.kind, input.baseName, ext, size, input.uploadedAt);
      expected.add(pathname);
      if (!(await blobExists(pathname))) {
        missingKeys.push(pathname);
      }
    }
    if (missingKeys.length > 0) {
      missingRecords.push({
        kind: input.kind,
        id: input.id,
        baseName: input.baseName,
        ext: input.ext,
        uploadedAt: input.uploadedAt.toISOString(),
        missingKeys,
        missingOriginal: missingKeys.some((key) => key.includes("/original/")),
      });
    }
  };

  for (const row of imageRows) {
    await evaluateMedia({
      kind: "image",
      id: row.id,
      baseName: row.baseName,
      ext: row.ext,
      uploadedAt: row.uploadedAt,
      requiredSizes: ["original", "sm", "lg"],
      previewExt: row.ext,
    });
  }
  for (const row of videoRows) {
    const sizes: Array<"original" | "sm" | "lg"> = ["original"];
    if (row.sizeSm > 0) sizes.push("sm");
    if (row.sizeLg > 0) sizes.push("lg");
    await evaluateMedia({
      kind: "video",
      id: row.id,
      baseName: row.baseName,
      ext: row.ext,
      uploadedAt: row.uploadedAt,
      requiredSizes: sizes,
      previewExt: "png",
    });
  }
  for (const row of documentRows) {
    const sizes: Array<"original" | "sm" | "lg"> = ["original"];
    if (row.sizeSm > 0) sizes.push("sm");
    if (row.sizeLg > 0) sizes.push("lg");
    await evaluateMedia({
      kind: "document",
      id: row.id,
      baseName: row.baseName,
      ext: row.ext,
      uploadedAt: row.uploadedAt,
      requiredSizes: sizes,
      previewExt: "png",
    });
  }
  for (const row of fileRows) {
    const sizes: Array<"original" | "sm" | "lg"> = ["original"];
    if (row.sizeSm > 0) sizes.push("sm");
    if (row.sizeLg > 0) sizes.push("lg");
    await evaluateMedia({
      kind: "other",
      id: row.id,
      baseName: row.baseName,
      ext: row.ext,
      uploadedAt: row.uploadedAt,
      requiredSizes: sizes,
      previewExt: "png",
    });
  }

  // Keep active upload session keys out of orphaned list.
  for (const row of uploadSessionRows) {
    if (row.storageKey) {
      expected.add(row.storageKey);
    }
  }

  const blobPathnames = await listBlobPathnames("uploads/");
  const orphanedBlobPathnames = blobPathnames.filter((pathname) => !expected.has(pathname));

  return {
    expectedBlobPathCount: expected.size,
    blobPathCount: blobPathnames.length,
    missingRecords,
    orphanedBlobPathnames,
  };
}

async function blobExists(pathname: string): Promise<boolean> {
  try {
    await blobHead(pathname);
    return true;
  } catch {
    return false;
  }
}

async function listBlobPathnames(prefix: string): Promise<string[]> {
  const pathnames: string[] = [];
  let cursor: string | undefined;
  while (true) {
    const listed = await blobList({ prefix, cursor });
    for (const blob of listed.blobs) {
      pathnames.push(blob.pathname);
    }
    if (!listed.hasMore || !listed.cursor) {
      break;
    }
    cursor = listed.cursor;
  }
  return pathnames;
}

function buildStoragePathname(
  kind: BlobMediaKind,
  baseName: string,
  ext: string,
  size: "original" | "sm" | "lg",
  uploadedAt: Date,
): string {
  const year = uploadedAt.getUTCFullYear().toString();
  const month = String(uploadedAt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(uploadedAt.getUTCDate()).padStart(2, "0");
  return `uploads/${year}/${month}/${day}/${kind}/${size}/${baseName}.${ext}`;
}

async function cleanupMissingRecordEntries(entries: MissingRecord[]): Promise<number> {
  const originalsMissing = entries.filter((entry) => entry.missingOriginal);
  if (originalsMissing.length === 0) {
    return 0;
  }

  const imageIds = originalsMissing.filter((entry) => entry.kind === "image").map((entry) => entry.id);
  const videoIds = originalsMissing.filter((entry) => entry.kind === "video").map((entry) => entry.id);
  const documentIds = originalsMissing.filter((entry) => entry.kind === "document").map((entry) => entry.id);
  const fileIds = originalsMissing.filter((entry) => entry.kind === "other").map((entry) => entry.id);

  let deleted = 0;
  if (imageIds.length > 0) {
    await db.delete(shares).where(inArray(shares.imageId, imageIds));
    const rows = await db.delete(images).where(inArray(images.id, imageIds)).returning({ id: images.id });
    deleted += rows.length;
  }
  if (videoIds.length > 0) {
    await db.delete(videoShares).where(inArray(videoShares.videoId, videoIds));
    const rows = await db.delete(videos).where(inArray(videos.id, videoIds)).returning({ id: videos.id });
    deleted += rows.length;
  }
  if (documentIds.length > 0) {
    await db.delete(documentShares).where(inArray(documentShares.documentId, documentIds));
    const rows = await db.delete(documents).where(inArray(documents.id, documentIds)).returning({ id: documents.id });
    deleted += rows.length;
  }
  if (fileIds.length > 0) {
    await db.delete(fileShares).where(inArray(fileShares.fileId, fileIds));
    const rows = await db.delete(files).where(inArray(files.id, fileIds)).returning({ id: files.id });
    deleted += rows.length;
  }
  return deleted;
}

async function cleanupOrphanedBlobFiles(pathnames: string[]): Promise<number> {
  if (pathnames.length === 0) {
    return 0;
  }
  await blobDelete(pathnames);
  return pathnames.length;
}
