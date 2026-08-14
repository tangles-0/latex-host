import { and, desc, eq, lt, or } from "drizzle-orm";
import { db } from "@/db";
import {
  documents,
  files,
  images,
  mediaInAlbums,
  notes,
  videos,
} from "@/db/schema";
import {
  getMediaForUser,
  getNoteForUser,
  type MediaEntry,
} from "@/lib/media-store";
import type { BlobMediaKind } from "@/lib/media-types";

export type ListCursor = {
  uploadedAt: string;
  id: string;
};

export function encodeCursor(cursor: ListCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | undefined): ListCursor | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as ListCursor;
    if (
      typeof parsed?.uploadedAt !== "string" ||
      typeof parsed?.id !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function cursorWhere(
  uploadedAtCol: any,
  idCol: any,
  cursor: ListCursor | null,
) {
  if (!cursor) {
    return undefined;
  }
  const uploadedAt = new Date(cursor.uploadedAt);
  return or(
    lt(uploadedAtCol, uploadedAt),
    and(eq(uploadedAtCol, uploadedAt), lt(idCol, cursor.id)),
  );
}

async function listKindForUser(input: {
  userId: string;
  kind: BlobMediaKind;
  limit: number;
  cursor: ListCursor | null;
  albumId?: string;
}): Promise<MediaEntry[]> {
  const { userId, kind, limit, cursor, albumId } = input;

  if (albumId) {
    const membershipRows = await db
      .select({
        mediaId: mediaInAlbums.mediaId,
        createdAt: mediaInAlbums.createdAt,
      })
      .from(mediaInAlbums)
      .where(
        and(
          eq(mediaInAlbums.userId, userId),
          eq(mediaInAlbums.albumId, albumId),
          eq(mediaInAlbums.mediaType, kind),
        ),
      )
      .orderBy(desc(mediaInAlbums.createdAt), desc(mediaInAlbums.mediaId))
      .limit(500);

    const items: MediaEntry[] = [];
    for (const row of membershipRows) {
      const media = await getMediaForUser(kind, row.mediaId, userId);
      if (!media) {
        continue;
      }
      if (cursor) {
        const uploadedAtMs = new Date(media.uploadedAt).getTime();
        const cursorMs = new Date(cursor.uploadedAt).getTime();
        if (
          uploadedAtMs > cursorMs ||
          (uploadedAtMs === cursorMs && media.id >= cursor.id)
        ) {
          continue;
        }
      }
      items.push(media);
      if (items.length >= limit) {
        break;
      }
    }
    return items;
  }

  if (kind === "image") {
    const where = and(
      eq(images.userId, userId),
      cursorWhere(images.uploadedAt, images.id, cursor),
    );
    const rows = await db
      .select({ id: images.id })
      .from(images)
      .where(where)
      .orderBy(desc(images.uploadedAt), desc(images.id))
      .limit(limit);
    const items: MediaEntry[] = [];
    for (const row of rows) {
      const media = await getMediaForUser("image", row.id, userId);
      if (media) {
        items.push(media);
      }
    }
    return items;
  }

  if (kind === "video") {
    const where = and(
      eq(videos.userId, userId),
      cursorWhere(videos.uploadedAt, videos.id, cursor),
    );
    const rows = await db
      .select({ id: videos.id })
      .from(videos)
      .where(where)
      .orderBy(desc(videos.uploadedAt), desc(videos.id))
      .limit(limit);
    const items: MediaEntry[] = [];
    for (const row of rows) {
      const media = await getMediaForUser("video", row.id, userId);
      if (media) {
        items.push(media);
      }
    }
    return items;
  }

  if (kind === "document") {
    const where = and(
      eq(documents.userId, userId),
      cursorWhere(documents.uploadedAt, documents.id, cursor),
    );
    const rows = await db
      .select({ id: documents.id })
      .from(documents)
      .where(where)
      .orderBy(desc(documents.uploadedAt), desc(documents.id))
      .limit(limit);
    const items: MediaEntry[] = [];
    for (const row of rows) {
      const media = await getMediaForUser("document", row.id, userId);
      if (media) {
        items.push(media);
      }
    }
    return items;
  }

  const where = and(
    eq(files.userId, userId),
    cursorWhere(files.uploadedAt, files.id, cursor),
  );
  const rows = await db
    .select({ id: files.id })
    .from(files)
    .where(where)
    .orderBy(desc(files.uploadedAt), desc(files.id))
    .limit(limit);
  const items: MediaEntry[] = [];
  for (const row of rows) {
    const media = await getMediaForUser("other", row.id, userId);
    if (media) {
      items.push(media);
    }
  }
  return items;
}

export async function listFilesPageForUser(input: {
  userId: string;
  limit: number;
  cursor?: string;
  kind?: BlobMediaKind;
  albumId?: string;
}): Promise<{ items: MediaEntry[]; nextCursor: string | null }> {
  const cursor = decodeCursor(input.cursor);
  const limit = input.limit;
  const kinds: BlobMediaKind[] = input.kind
    ? [input.kind]
    : ["image", "video", "document", "other"];

  const perKindLimit = limit + 1;
  const batches = await Promise.all(
    kinds.map((kind) =>
      listKindForUser({
        userId: input.userId,
        kind,
        limit: perKindLimit,
        cursor,
        albumId: input.albumId,
      }),
    ),
  );

  const merged = batches
    .flat()
    .sort((a, b) => {
      const aTime = new Date(a.uploadedAt).getTime();
      const bTime = new Date(b.uploadedAt).getTime();
      if (aTime !== bTime) {
        return bTime - aTime;
      }
      return b.id.localeCompare(a.id);
    });

  const page = merged.slice(0, limit);
  const hasMore = merged.length > limit;
  const last = page[page.length - 1];
  return {
    items: page,
    nextCursor:
      hasMore && last
        ? encodeCursor({ uploadedAt: last.uploadedAt, id: last.id })
        : null,
  };
}

export async function listNotesPageForUser(input: {
  userId: string;
  limit: number;
  cursor?: string;
  albumId?: string;
}): Promise<{ items: MediaEntry[]; nextCursor: string | null }> {
  const cursor = decodeCursor(input.cursor);
  const limit = input.limit;

  if (input.albumId) {
    const membershipRows = await db
      .select({ mediaId: mediaInAlbums.mediaId })
      .from(mediaInAlbums)
      .where(
        and(
          eq(mediaInAlbums.userId, input.userId),
          eq(mediaInAlbums.albumId, input.albumId),
          eq(mediaInAlbums.mediaType, "note"),
        ),
      )
      .orderBy(desc(mediaInAlbums.createdAt), desc(mediaInAlbums.mediaId))
      .limit(500);

    const items: MediaEntry[] = [];
    for (const row of membershipRows) {
      const note = await getNoteForUser(row.mediaId, input.userId);
      if (!note) {
        continue;
      }
      if (cursor) {
        const uploadedAtMs = new Date(note.uploadedAt).getTime();
        const cursorMs = new Date(cursor.uploadedAt).getTime();
        if (
          uploadedAtMs > cursorMs ||
          (uploadedAtMs === cursorMs && note.id >= cursor.id)
        ) {
          continue;
        }
      }
      items.push(note);
      if (items.length >= limit + 1) {
        break;
      }
    }
    const page = items.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page,
      nextCursor:
        items.length > limit && last
          ? encodeCursor({ uploadedAt: last.uploadedAt, id: last.id })
          : null,
    };
  }

  const where = and(
    eq(notes.userId, input.userId),
    cursorWhere(notes.uploadedAt, notes.id, cursor),
  );
  const rows = await db
    .select({ id: notes.id })
    .from(notes)
    .where(where)
    .orderBy(desc(notes.uploadedAt), desc(notes.id))
    .limit(limit + 1);

  const items: MediaEntry[] = [];
  for (const row of rows.slice(0, limit)) {
    const note = await getNoteForUser(row.id, input.userId);
    if (note) {
      items.push(note);
    }
  }
  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      rows.length > limit && last
        ? encodeCursor({ uploadedAt: last.uploadedAt, id: last.id })
        : null,
  };
}

export async function getBlobFileForUser(
  userId: string,
  mediaId: string,
): Promise<MediaEntry | undefined> {
  const kinds: BlobMediaKind[] = ["image", "video", "document", "other"];
  for (const kind of kinds) {
    const media = await getMediaForUser(kind, mediaId, userId);
    if (media) {
      return media;
    }
  }
  return undefined;
}
