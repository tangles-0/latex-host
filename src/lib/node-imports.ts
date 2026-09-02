import { randomUUID } from "node:crypto";
import path from "node:path";
import { lstat, opendir, realpath, stat } from "node:fs/promises";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { nodeImportItems, nodeImportJobs } from "@/db/schema";
import { addMediaForUser, createShareForMedia } from "@/lib/media-store";
import {
  getMediaLocalPath,
  storeMediaFromLocalFile,
} from "@/lib/media-storage";
import {
  contentTypeForExt,
  isThumbnailServiceSupported,
  mediaKindFromType,
  type BlobMediaKind,
} from "@/lib/media-types";
import { buildAppUrl, requestPreviewGeneration } from "@/lib/preview-worker";
import { isNodeMode } from "@/lib/self-hosted-nodes";

const MAX_SELECTED_PATHS = 1_000;
const MAX_IMPORT_FILES = 100_000;
const MANAGED_DIRECTORY_NAME = ".latex";
const DEFAULT_IGNORED_NAMES = [
  ".latex",
  ".ssh",
  ".gnupg",
  ".aws",
  ".kube",
  ".docker",
  ".env",
];

export type NodeBrowseEntry = {
  name: string;
  path: string;
  kind: "directory" | "file";
  size: number | null;
};

export const getNodeBrowseRoot = (): string =>
  path.resolve(process.env.NODE_BROWSE_ROOT?.trim() || "/storage");

const isIgnoredBrowseName = (name: string): boolean => {
  const configured =
    process.env.NODE_BROWSE_IGNORE_NAMES?.trim() ||
    DEFAULT_IGNORED_NAMES.join(",");
  const ignored = new Set(
    configured
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return ignored.has(name);
};

export const normalizeNodeRelativePath = (value: string): string => {
  if (value.includes("\0") || path.isAbsolute(value)) {
    throw new Error("Invalid storage path.");
  }
  const normalized = path.normalize(value || ".").replaceAll("\\", "/");
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error("Storage path escapes the mounted root.");
  }
  return normalized === "." ? "" : normalized.replace(/^\.\//, "");
};

const assertNoSymlinks = async (
  root: string,
  relativePath: string,
): Promise<void> => {
  const segments = normalizeNodeRelativePath(relativePath)
    .split("/")
    .filter(Boolean);
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    const info = await lstat(current);
    if (info.isSymbolicLink()) {
      throw new Error("Symbolic links cannot be browsed or imported.");
    }
  }
};

export const resolveNodeBrowsePath = async (
  relativePath: string,
): Promise<string> => {
  const root = await realpath(getNodeBrowseRoot());
  const normalized = normalizeNodeRelativePath(relativePath);
  if (normalized.split("/").filter(Boolean).some(isIgnoredBrowseName)) {
    throw new Error("That path is excluded from mounted storage imports.");
  }
  await assertNoSymlinks(root, normalized);
  const resolved = await realpath(path.join(root, normalized));
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Storage path escapes the mounted root.");
  }
  return resolved;
};

export const browseNodeStorage = async (
  relativePath: string,
): Promise<{ path: string; entries: NodeBrowseEntry[] }> => {
  if (!isNodeMode()) {
    throw new Error("Mounted storage browsing is only available in node mode.");
  }
  const normalized = normalizeNodeRelativePath(relativePath);
  const absolute = await resolveNodeBrowsePath(normalized);
  const directory = await opendir(absolute);
  const entries: NodeBrowseEntry[] = [];
  for await (const entry of directory) {
    if (
      entry.isSymbolicLink() ||
      isIgnoredBrowseName(entry.name) ||
      (normalized === "" && entry.name === MANAGED_DIRECTORY_NAME)
    ) {
      continue;
    }
    const childRelative = normalized
      ? `${normalized}/${entry.name}`
      : entry.name;
    if (!entry.isDirectory() && !entry.isFile()) {
      continue;
    }
    const info = entry.isFile()
      ? await stat(path.join(absolute, entry.name))
      : null;
    entries.push({
      name: entry.name,
      path: childRelative,
      kind: entry.isDirectory() ? "directory" : "file",
      size: info?.size ?? null,
    });
  }
  entries.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "directory" ? -1 : 1;
    }
    return left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    });
  });
  return { path: normalized, entries };
};

const collectFiles = async (selectedPaths: string[]): Promise<string[]> => {
  const files: string[] = [];
  const seen = new Set<string>();
  const visit = async (relativePath: string): Promise<void> => {
    if (files.length >= MAX_IMPORT_FILES) {
      throw new Error(
        `Import exceeds the ${MAX_IMPORT_FILES.toLocaleString()} file limit.`,
      );
    }
    const normalized = normalizeNodeRelativePath(relativePath);
    if (seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    const absolute = await resolveNodeBrowsePath(normalized);
    const info = await lstat(absolute);
    if (info.isFile()) {
      files.push(normalized);
      return;
    }
    if (!info.isDirectory()) {
      return;
    }
    const directory = await opendir(absolute);
    for await (const entry of directory) {
      if (
        entry.isSymbolicLink() ||
        isIgnoredBrowseName(entry.name) ||
        (normalized === "" && entry.name === MANAGED_DIRECTORY_NAME)
      ) {
        continue;
      }
      await visit(normalized ? `${normalized}/${entry.name}` : entry.name);
    }
  };
  for (const selectedPath of selectedPaths) {
    await visit(selectedPath);
  }
  return files;
};

export const createNodeImportJob = async (input: {
  userId: string;
  selectedPaths: string[];
  albumId?: string;
  isShareAll: boolean;
}) => {
  if (!isNodeMode()) {
    throw new Error("Mounted storage imports are only available in node mode.");
  }
  if (
    input.selectedPaths.length === 0 ||
    input.selectedPaths.length > MAX_SELECTED_PATHS
  ) {
    throw new Error(
      `Select between 1 and ${MAX_SELECTED_PATHS.toLocaleString()} paths.`,
    );
  }
  const selectedPaths = input.selectedPaths.map(normalizeNodeRelativePath);
  const now = new Date();
  const [job] = await db
    .insert(nodeImportJobs)
    .values({
      id: randomUUID(),
      userId: input.userId,
      selectedPaths,
      albumId: input.albumId,
      isShareAll: input.isShareAll,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  void triggerNodeImportQueue();
  return job;
};

export const listNodeImportJobs = async (userId: string) =>
  db
    .select()
    .from(nodeImportJobs)
    .where(eq(nodeImportJobs.userId, userId))
    .orderBy(asc(nodeImportJobs.createdAt));

export const cancelNodeImportJob = async (
  jobId: string,
  userId: string,
): Promise<boolean> => {
  const updated = await db
    .update(nodeImportJobs)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
      completedAt: new Date(),
    })
    .where(
      sql`${nodeImportJobs.id} = ${jobId} and ${nodeImportJobs.userId} = ${userId} and ${nodeImportJobs.status} in ('pending', 'processing')`,
    )
    .returning({ id: nodeImportJobs.id });
  return Boolean(updated[0]);
};

export const retryNodeImportJob = async (
  jobId: string,
  userId: string,
): Promise<boolean> => {
  const [job] = await db
    .select()
    .from(nodeImportJobs)
    .where(and(eq(nodeImportJobs.id, jobId), eq(nodeImportJobs.userId, userId)))
    .limit(1);
  if (
    !job ||
    !["failed", "cancelled", "complete"].includes(job.status) ||
    (job.status === "complete" && job.failedFiles === 0)
  ) {
    return false;
  }
  await db
    .update(nodeImportItems)
    .set({ status: "pending", error: null, updatedAt: new Date() })
    .where(
      and(
        eq(nodeImportItems.jobId, jobId),
        inArray(nodeImportItems.status, ["failed", "pending"]),
      ),
    );
  await db
    .update(nodeImportJobs)
    .set({
      status: "pending",
      failedFiles: 0,
      error: null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(nodeImportJobs.id, jobId));
  void triggerNodeImportQueue();
  return true;
};

const fileDetails = (filePath: string): { ext: string; mimeType: string } => {
  const rawExt = path.extname(filePath).slice(1).toLowerCase();
  const ext = rawExt || "bin";
  return { ext, mimeType: contentTypeForExt(ext) };
};

const importOneFile = async (
  job: typeof nodeImportJobs.$inferSelect,
  relativePath: string,
): Promise<string> => {
  const sourcePath = await resolveNodeBrowsePath(relativePath);
  const info = await stat(sourcePath);
  const { ext, mimeType } = fileDetails(sourcePath);
  const kind = mediaKindFromType(mimeType, ext);
  const uploadedAt = new Date();
  const workerKind = isThumbnailServiceSupported({
    kind,
    mimeType,
    ext,
    fileSizeBytes: info.size,
  })
    ? (kind as Exclude<BlobMediaKind, "other">)
    : null;
  const stored = await storeMediaFromLocalFile({
    sourcePath,
    kind,
    ext,
    mimeType,
    sizeOriginal: info.size,
    uploadedAt,
    deferPreview: Boolean(workerKind),
  });
  const media = await addMediaForUser({
    userId: job.userId,
    kind,
    albumId: job.albumId ?? undefined,
    baseName: stored.baseName,
    originalFileName: path.basename(sourcePath),
    ext: stored.ext,
    mimeType: stored.mimeType,
    width: stored.width,
    height: stored.height,
    sizeOriginal: stored.sizeOriginal,
    sizeSm: stored.sizeSm,
    sizeLg: stored.sizeLg,
    previewStatus: stored.previewStatus,
    uploadedAt: uploadedAt.toISOString(),
  });
  if (job.isShareAll) {
    await createShareForMedia(kind, media.id, job.userId);
  }
  if (workerKind && media.previewStatus === "pending") {
    const localPath = getMediaLocalPath({
      kind,
      baseName: media.baseName,
      ext: media.ext,
      size: "original",
      uploadedAt,
    });
    const previewSource = localPath
      ? { localSourcePath: localPath }
      : {
          downloadUrl: buildAppUrl(
            new Request(process.env.NEXTAUTH_URL || "http://app:3000"),
            `/api/thumbnails/${media.id}/source`,
          ),
        };
    await requestPreviewGeneration({
      mediaId: media.id,
      kind: workerKind,
      ext: media.ext,
      mimeType: media.mimeType,
      fileSizeBytes: media.sizeOriginal,
      ...previewSource,
    });
  }
  return media.id;
};

const processImportJob = async (
  job: typeof nodeImportJobs.$inferSelect,
): Promise<void> => {
  try {
    const [existingItem] = await db
      .select({ id: nodeImportItems.id })
      .from(nodeImportItems)
      .where(eq(nodeImportItems.jobId, job.id))
      .limit(1);
    if (!existingItem) {
      const files = await collectFiles(job.selectedPaths);
      const now = new Date();
      if (files.length > 0) {
        await db.insert(nodeImportItems).values(
          files.map((relativePath) => ({
            id: randomUUID(),
            jobId: job.id,
            relativePath,
            status: "pending",
            createdAt: now,
            updatedAt: now,
          })),
        );
      }
      await db
        .update(nodeImportJobs)
        .set({ totalFiles: files.length, updatedAt: now })
        .where(eq(nodeImportJobs.id, job.id));
    }
    while (true) {
      const [current] = await db
        .select({ status: nodeImportJobs.status })
        .from(nodeImportJobs)
        .where(eq(nodeImportJobs.id, job.id))
        .limit(1);
      if (current?.status === "cancelled") {
        return;
      }
      const [item] = await db
        .select()
        .from(nodeImportItems)
        .where(
          and(
            eq(nodeImportItems.jobId, job.id),
            eq(nodeImportItems.status, "pending"),
          ),
        )
        .orderBy(asc(nodeImportItems.createdAt))
        .limit(1);
      if (!item) {
        break;
      }
      try {
        const mediaId = await importOneFile(job, item.relativePath);
        await db
          .update(nodeImportItems)
          .set({
            status: "complete",
            mediaId,
            error: null,
            updatedAt: new Date(),
          })
          .where(eq(nodeImportItems.id, item.id));
        await db
          .update(nodeImportJobs)
          .set({
            completedFiles: sql`${nodeImportJobs.completedFiles} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(nodeImportJobs.id, job.id));
      } catch (error) {
        await db
          .update(nodeImportItems)
          .set({
            status: "failed",
            error:
              error instanceof Error ? error.message : "File import failed.",
            updatedAt: new Date(),
          })
          .where(eq(nodeImportItems.id, item.id));
        await db
          .update(nodeImportJobs)
          .set({
            failedFiles: sql`${nodeImportJobs.failedFiles} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(nodeImportJobs.id, job.id));
      }
    }
    await db
      .update(nodeImportJobs)
      .set({
        status: "complete",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(nodeImportJobs.id, job.id));
  } catch (error) {
    await db
      .update(nodeImportJobs)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : "Import failed.",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(nodeImportJobs.id, job.id));
  }
};

const globalForImportQueue = globalThis as unknown as {
  nodeImportQueuePromise?: Promise<void>;
};

const drainNodeImportQueue = async (): Promise<void> => {
  while (true) {
    const [job] = await db
      .select()
      .from(nodeImportJobs)
      .where(eq(nodeImportJobs.status, "pending"))
      .orderBy(asc(nodeImportJobs.createdAt))
      .limit(1);
    if (!job) {
      return;
    }
    const claimed = await db
      .update(nodeImportJobs)
      .set({ status: "processing", updatedAt: new Date() })
      .where(
        sql`${nodeImportJobs.id} = ${job.id} and ${nodeImportJobs.status} = 'pending'`,
      )
      .returning({ id: nodeImportJobs.id });
    if (!claimed[0]) {
      continue;
    }
    await processImportJob(job);
  }
};

export const triggerNodeImportQueue = (): Promise<void> => {
  if (globalForImportQueue.nodeImportQueuePromise) {
    return globalForImportQueue.nodeImportQueuePromise;
  }
  globalForImportQueue.nodeImportQueuePromise = drainNodeImportQueue().finally(
    () => {
      globalForImportQueue.nodeImportQueuePromise = undefined;
    },
  );
  return globalForImportQueue.nodeImportQueuePromise;
};

export const recoverNodeImportQueue = async (): Promise<void> => {
  await db
    .update(nodeImportJobs)
    .set({ status: "pending", updatedAt: new Date() })
    .where(inArray(nodeImportJobs.status, ["processing"]));
  void triggerNodeImportQueue();
};
