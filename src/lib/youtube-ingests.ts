import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { youtubeIngests } from "@/db/schema";

export type YoutubeIngestStatus =
  | "pending"
  | "started"
  | "downloading"
  | "uploading"
  | "complete"
  | "error";

export type YoutubeQualityOption = {
  id: string;
  label: string;
  height?: number;
  fps?: number;
  ext?: string;
  filesizeBytes?: number;
};

export type YoutubeIngestEntry = {
  id: string;
  userId: string;
  youtubeId: string;
  youtubeUrl: string;
  title: string;
  channelName?: string;
  durationSeconds?: number;
  qualityLabel?: string;
  status: YoutubeIngestStatus;
  progress: number;
  error?: string;
  mediaId?: string;
  createdAt: string;
  updatedAt: string;
};

function mapYoutubeIngest(
  row: typeof youtubeIngests.$inferSelect,
): YoutubeIngestEntry {
  return {
    id: row.id,
    userId: row.userId,
    youtubeId: row.youtubeId,
    youtubeUrl: row.youtubeUrl,
    title: row.title,
    channelName: row.channelName ?? undefined,
    durationSeconds: row.durationSeconds ?? undefined,
    qualityLabel: row.qualityLabel ?? undefined,
    status: row.status as YoutubeIngestStatus,
    progress: row.progress,
    error: row.error ?? undefined,
    mediaId: row.mediaId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createYoutubeIngestForUser(input: {
  userId: string;
  youtubeId: string;
  youtubeUrl: string;
  title: string;
  channelName?: string;
  durationSeconds?: number;
  qualityLabel?: string;
}): Promise<YoutubeIngestEntry> {
  const now = new Date();
  const id = randomUUID();
  await db.insert(youtubeIngests).values({
    id,
    userId: input.userId,
    youtubeId: input.youtubeId,
    youtubeUrl: input.youtubeUrl,
    title: input.title,
    channelName: input.channelName ?? null,
    durationSeconds: input.durationSeconds ?? null,
    qualityLabel: input.qualityLabel ?? null,
    status: "pending",
    progress: 0,
    error: null,
    mediaId: null,
    createdAt: now,
    updatedAt: now,
  });
  const created = await getYoutubeIngestForUser(input.userId, id);
  if (!created) {
    throw new Error("YouTube ingest could not be created.");
  }
  return created;
}

export async function listYoutubeIngestsForUser(
  userId: string,
): Promise<YoutubeIngestEntry[]> {
  const rows = await db
    .select()
    .from(youtubeIngests)
    .where(eq(youtubeIngests.userId, userId));
  return rows
    .map(mapYoutubeIngest)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}

export async function getYoutubeIngestForUser(
  userId: string,
  ingestId: string,
): Promise<YoutubeIngestEntry | undefined> {
  const [row] = await db
    .select()
    .from(youtubeIngests)
    .where(
      and(eq(youtubeIngests.userId, userId), eq(youtubeIngests.id, ingestId)),
    )
    .limit(1);
  return row ? mapYoutubeIngest(row) : undefined;
}

export async function getYoutubeIngest(
  ingestId: string,
): Promise<YoutubeIngestEntry | undefined> {
  const [row] = await db
    .select()
    .from(youtubeIngests)
    .where(eq(youtubeIngests.id, ingestId))
    .limit(1);
  return row ? mapYoutubeIngest(row) : undefined;
}

export async function updateYoutubeIngest(input: {
  ingestId: string;
  status: YoutubeIngestStatus;
  progress?: number;
  error?: string | null;
  mediaId?: string | null;
}): Promise<YoutubeIngestEntry | undefined> {
  const progress = Math.max(0, Math.min(100, Math.round(input.progress ?? 0)));
  const [row] = await db
    .update(youtubeIngests)
    .set({
      status: input.status,
      progress,
      error: input.error ?? null,
      mediaId: input.mediaId,
      updatedAt: new Date(),
    })
    .where(eq(youtubeIngests.id, input.ingestId))
    .returning();
  return row ? mapYoutubeIngest(row) : undefined;
}

export async function deleteYoutubeIngestForUser(
  userId: string,
  ingestId: string,
): Promise<boolean> {
  const rows = await db
    .delete(youtubeIngests)
    .where(
      and(eq(youtubeIngests.userId, userId), eq(youtubeIngests.id, ingestId)),
    )
    .returning({ id: youtubeIngests.id });
  return rows.length > 0;
}
