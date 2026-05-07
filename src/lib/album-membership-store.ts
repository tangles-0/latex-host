import { randomUUID } from "crypto";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { documents, files, images, mediaInAlbums, notes, videos } from "@/db/schema";
import type { MediaKind } from "@/lib/media-types";

export type AlbumMembershipItem = {
  id: string;
  userId: string;
  albumId: string;
  mediaType: MediaKind;
  mediaId: string;
  albumCaption?: string;
  albumOrder: number;
  createdAt: string;
};

export type MediaRef = {
  id: string;
  kind: MediaKind;
};

type MediaTable =
  | typeof images
  | typeof videos
  | typeof documents
  | typeof files
  | typeof notes;

function tableForKind(kind: MediaKind): MediaTable {
  if (kind === "image") return images;
  if (kind === "video") return videos;
  if (kind === "document") return documents;
  if (kind === "other") return files;
  return notes;
}

function mediaKey(kind: MediaKind, mediaId: string): string {
  return `${kind}:${mediaId}`;
}

let legacyBackfillPromise: Promise<void> | null = null;

async function ensureLegacyAlbumMembershipBackfill(): Promise<void> {
  if (legacyBackfillPromise) {
    return legacyBackfillPromise;
  }

  legacyBackfillPromise = (async () => {
    const [legacyImages, legacyVideos, legacyDocuments, legacyFiles, legacyNotes] =
      await Promise.all([
        db
          .select({
            userId: images.userId,
            albumId: images.albumId,
            mediaId: images.id,
            albumCaption: images.albumCaption,
            albumOrder: images.albumOrder,
          })
          .from(images)
          .where(isNotNull(images.albumId)),
        db
          .select({
            userId: videos.userId,
            albumId: videos.albumId,
            mediaId: videos.id,
            albumCaption: videos.albumCaption,
            albumOrder: videos.albumOrder,
          })
          .from(videos)
          .where(isNotNull(videos.albumId)),
        db
          .select({
            userId: documents.userId,
            albumId: documents.albumId,
            mediaId: documents.id,
            albumCaption: documents.albumCaption,
            albumOrder: documents.albumOrder,
          })
          .from(documents)
          .where(isNotNull(documents.albumId)),
        db
          .select({
            userId: files.userId,
            albumId: files.albumId,
            mediaId: files.id,
            albumCaption: files.albumCaption,
            albumOrder: files.albumOrder,
          })
          .from(files)
          .where(isNotNull(files.albumId)),
        db
          .select({
            userId: notes.userId,
            albumId: notes.albumId,
            mediaId: notes.id,
            albumCaption: notes.albumCaption,
            albumOrder: notes.albumOrder,
          })
          .from(notes)
          .where(isNotNull(notes.albumId)),
      ]);

    const now = new Date();
    const allRows = [
      ...legacyImages.map((row) => ({ ...row, mediaType: "image" as const })),
      ...legacyVideos.map((row) => ({ ...row, mediaType: "video" as const })),
      ...legacyDocuments.map((row) => ({ ...row, mediaType: "document" as const })),
      ...legacyFiles.map((row) => ({ ...row, mediaType: "other" as const })),
      ...legacyNotes.map((row) => ({ ...row, mediaType: "note" as const })),
    ];

    for (const row of allRows) {
      if (!row.albumId) {
        continue;
      }
      const [existing] = await db
        .select({ id: mediaInAlbums.id })
        .from(mediaInAlbums)
        .where(
          and(
            eq(mediaInAlbums.userId, row.userId),
            eq(mediaInAlbums.albumId, row.albumId),
            eq(mediaInAlbums.mediaType, row.mediaType),
            eq(mediaInAlbums.mediaId, row.mediaId),
          ),
        )
        .limit(1);
      if (existing) {
        continue;
      }
      await db.insert(mediaInAlbums).values({
        id: randomUUID(),
        userId: row.userId,
        albumId: row.albumId,
        mediaType: row.mediaType,
        mediaId: row.mediaId,
        albumCaption: row.albumCaption,
        albumOrder: row.albumOrder,
        createdAt: now,
      });
    }
  })();

  return legacyBackfillPromise;
}

function mapMembershipRow(row: typeof mediaInAlbums.$inferSelect): AlbumMembershipItem {
  return {
    id: row.id,
    userId: row.userId,
    albumId: row.albumId,
    mediaType: row.mediaType as MediaKind,
    mediaId: row.mediaId,
    albumCaption: row.albumCaption ?? undefined,
    albumOrder: row.albumOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

async function listOwnedMediaKeys(
  userId: string,
  mediaItems: MediaRef[],
): Promise<Set<string>> {
  const grouped: Record<MediaKind, string[]> = {
    image: [],
    video: [],
    document: [],
    other: [],
    note: [],
  };

  for (const item of mediaItems) {
    grouped[item.kind].push(item.id);
  }

  const owned = new Set<string>();
  for (const kind of ["image", "video", "document", "other", "note"] as const) {
    const ids = grouped[kind];
    if (ids.length === 0) {
      continue;
    }
    const table = tableForKind(kind);
    const rows = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.userId, userId), inArray(table.id, ids)));
    for (const row of rows) {
      owned.add(mediaKey(kind, row.id));
    }
  }
  return owned;
}

export async function listAlbumMembershipsForUser(
  userId: string,
  albumId?: string,
): Promise<AlbumMembershipItem[]> {
  await ensureLegacyAlbumMembershipBackfill();
  const rows = await db
    .select()
    .from(mediaInAlbums)
    .where(
      albumId
        ? and(eq(mediaInAlbums.userId, userId), eq(mediaInAlbums.albumId, albumId))
        : eq(mediaInAlbums.userId, userId),
    )
    .orderBy(asc(mediaInAlbums.albumOrder), asc(mediaInAlbums.createdAt));
  return rows.map(mapMembershipRow);
}

export async function listAlbumMembershipsPublic(
  albumId: string,
): Promise<AlbumMembershipItem[]> {
  await ensureLegacyAlbumMembershipBackfill();
  const rows = await db
    .select()
    .from(mediaInAlbums)
    .where(eq(mediaInAlbums.albumId, albumId))
    .orderBy(asc(mediaInAlbums.albumOrder), asc(mediaInAlbums.createdAt));
  return rows.map(mapMembershipRow);
}

export async function listFirstAlbumMembershipByMediaForUser(
  userId: string,
): Promise<Map<string, AlbumMembershipItem>> {
  await ensureLegacyAlbumMembershipBackfill();
  const rows = await listAlbumMembershipsForUser(userId);
  const map = new Map<string, AlbumMembershipItem>();
  for (const row of rows) {
    const key = mediaKey(row.mediaType, row.mediaId);
    if (!map.has(key)) {
      map.set(key, row);
    }
  }
  return map;
}

export async function getFirstAlbumMembershipForMedia(
  kind: MediaKind,
  mediaId: string,
  userId?: string,
): Promise<AlbumMembershipItem | undefined> {
  await ensureLegacyAlbumMembershipBackfill();
  const [row] = await db
    .select()
    .from(mediaInAlbums)
    .where(
      userId
        ? and(
            eq(mediaInAlbums.userId, userId),
            eq(mediaInAlbums.mediaType, kind),
            eq(mediaInAlbums.mediaId, mediaId),
          )
        : and(eq(mediaInAlbums.mediaType, kind), eq(mediaInAlbums.mediaId, mediaId)),
    )
    .orderBy(asc(mediaInAlbums.albumOrder), asc(mediaInAlbums.createdAt))
    .limit(1);
  return row ? mapMembershipRow(row) : undefined;
}

export async function addMediaItemsToAlbum(
  userId: string,
  albumId: string,
  mediaItems: MediaRef[],
): Promise<void> {
  await ensureLegacyAlbumMembershipBackfill();
  if (mediaItems.length === 0) {
    return;
  }

  const owned = await listOwnedMediaKeys(userId, mediaItems);
  const [maxOrderRow] = await db
    .select({ value: sql<number>`coalesce(max(${mediaInAlbums.albumOrder}), 0)` })
    .from(mediaInAlbums)
    .where(and(eq(mediaInAlbums.userId, userId), eq(mediaInAlbums.albumId, albumId)));
  let nextOrder = Number(maxOrderRow?.value ?? 0) + 1;

  for (const item of mediaItems) {
    if (!owned.has(mediaKey(item.kind, item.id))) {
      continue;
    }
    const [existing] = await db
      .select({ id: mediaInAlbums.id })
      .from(mediaInAlbums)
      .where(
        and(
          eq(mediaInAlbums.userId, userId),
          eq(mediaInAlbums.albumId, albumId),
          eq(mediaInAlbums.mediaType, item.kind),
          eq(mediaInAlbums.mediaId, item.id),
        ),
      )
      .limit(1);
    if (existing) {
      continue;
    }
    await db.insert(mediaInAlbums).values({
      id: randomUUID(),
      userId,
      albumId,
      mediaType: item.kind,
      mediaId: item.id,
      albumCaption: null,
      albumOrder: nextOrder,
      createdAt: new Date(),
    });
    nextOrder += 1;
  }
}

export async function removeMediaItemsFromAlbum(
  userId: string,
  mediaItems: MediaRef[],
  albumId?: string,
): Promise<void> {
  await ensureLegacyAlbumMembershipBackfill();
  if (mediaItems.length === 0) {
    return;
  }

  for (const item of mediaItems) {
    await db
      .delete(mediaInAlbums)
      .where(
        albumId
          ? and(
              eq(mediaInAlbums.userId, userId),
              eq(mediaInAlbums.albumId, albumId),
              eq(mediaInAlbums.mediaType, item.kind),
              eq(mediaInAlbums.mediaId, item.id),
            )
          : and(
              eq(mediaInAlbums.userId, userId),
              eq(mediaInAlbums.mediaType, item.kind),
              eq(mediaInAlbums.mediaId, item.id),
            ),
      );
  }
}

export async function removeAllMediaItemsFromAlbum(
  userId: string,
  albumId: string,
): Promise<void> {
  await ensureLegacyAlbumMembershipBackfill();
  await db
    .delete(mediaInAlbums)
    .where(and(eq(mediaInAlbums.userId, userId), eq(mediaInAlbums.albumId, albumId)));
}

export async function removeAllMediaItemsForUser(userId: string): Promise<void> {
  await ensureLegacyAlbumMembershipBackfill();
  await db.delete(mediaInAlbums).where(eq(mediaInAlbums.userId, userId));
}

export async function updateAlbumMembershipCaptionForUser(
  userId: string,
  albumId: string,
  mediaItem: MediaRef,
  caption: string,
): Promise<AlbumMembershipItem | undefined> {
  await ensureLegacyAlbumMembershipBackfill();
  const normalizedCaption = caption.trim();
  const [row] = await db
    .update(mediaInAlbums)
    .set({ albumCaption: normalizedCaption.length > 0 ? normalizedCaption : null })
    .where(
      and(
        eq(mediaInAlbums.userId, userId),
        eq(mediaInAlbums.albumId, albumId),
        eq(mediaInAlbums.mediaType, mediaItem.kind),
        eq(mediaInAlbums.mediaId, mediaItem.id),
      ),
    )
    .returning();
  return row ? mapMembershipRow(row) : undefined;
}

export async function reorderAlbumMediaForUser(
  userId: string,
  albumId: string,
  orderedMediaItems: MediaRef[],
): Promise<boolean> {
  await ensureLegacyAlbumMembershipBackfill();
  if (orderedMediaItems.length === 0) {
    return true;
  }

  const rows = await db
    .select({
      mediaType: mediaInAlbums.mediaType,
      mediaId: mediaInAlbums.mediaId,
    })
    .from(mediaInAlbums)
    .where(and(eq(mediaInAlbums.userId, userId), eq(mediaInAlbums.albumId, albumId)));

  const existingKeys = new Set(rows.map((row) => mediaKey(row.mediaType as MediaKind, row.mediaId)));
  const orderedKeys = new Set(orderedMediaItems.map((item) => mediaKey(item.kind, item.id)));
  if (existingKeys.size !== orderedKeys.size) {
    return false;
  }
  for (const key of orderedKeys) {
    if (!existingKeys.has(key)) {
      return false;
    }
  }

  for (const [index, item] of orderedMediaItems.entries()) {
    await db
      .update(mediaInAlbums)
      .set({ albumOrder: index + 1 })
      .where(
        and(
          eq(mediaInAlbums.userId, userId),
          eq(mediaInAlbums.albumId, albumId),
          eq(mediaInAlbums.mediaType, item.kind),
          eq(mediaInAlbums.mediaId, item.id),
        ),
      );
  }
  return true;
}

export async function isMediaInAlbum(
  albumId: string,
  mediaItem: MediaRef,
): Promise<boolean> {
  await ensureLegacyAlbumMembershipBackfill();
  const [row] = await db
    .select({ id: mediaInAlbums.id })
    .from(mediaInAlbums)
    .where(
      and(
        eq(mediaInAlbums.albumId, albumId),
        eq(mediaInAlbums.mediaType, mediaItem.kind),
        eq(mediaInAlbums.mediaId, mediaItem.id),
      ),
    )
    .limit(1);
  return Boolean(row);
}
