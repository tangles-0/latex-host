import { randomBytes, randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { remark } from "remark";
import stripMarkdown from "strip-markdown";
import { db } from "@/db";
import type { BlobMediaKind, MediaKind } from "@/lib/media-types";
import {
  albumShares,
  documentShares,
  documents,
  fileShares,
  files,
  images,
  notes,
  noteShares,
  shares,
  videoShares,
  videos,
} from "@/db/schema";
import {
  addMediaItemsToAlbum,
  getFirstAlbumMembershipForMedia,
  isMediaInAlbum,
  listAlbumMembershipsForUser,
  listAlbumMembershipsPublic,
  removeMediaItemsFromAlbum,
  reorderAlbumMediaForUser,
  type AlbumMembershipItem,
  type MediaRef,
  updateAlbumMembershipCaptionForUser,
} from "@/lib/album-membership-store";
import { deleteImageFiles } from "@/lib/storage";
export type { MediaKind } from "@/lib/media-types";
export type PreviewStatus = "pending" | "processing" | "ready" | "failed";

export type MediaEntry = {
  id: string;
  kind: MediaKind;
  baseName: string;
  originalFileName?: string;
  ext: string;
  mimeType: string;
  albumId?: string;
  albumCaption?: string;
  albumOrder: number;
  albumIds?: string[];
  uploadedAt: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  pageCount?: number;
  sizeOriginal: number;
  sizeSm: number;
  sizeLg: number;
  previewStatus: PreviewStatus;
  previewError?: string;
  previewText?: string;
  content?: string;
  updatedAt?: string;
  shared?: boolean;
};

const SHARE_CODE_LENGTH = 8;

function mapImageRow(row: typeof images.$inferSelect): MediaEntry {
  return {
    id: row.id,
    kind: "image",
    baseName: row.baseName,
    originalFileName: row.originalFileName ?? undefined,
    ext: row.ext,
    mimeType: `image/${row.ext === "jpg" ? "jpeg" : row.ext}`,
    albumOrder: 0,
    uploadedAt: row.uploadedAt.toISOString(),
    width: row.width,
    height: row.height,
    sizeOriginal: row.sizeOriginal,
    sizeSm: row.sizeSm,
    sizeLg: row.sizeLg,
    previewStatus: "ready",
  };
}

function mapVideoRow(row: typeof videos.$inferSelect): MediaEntry {
  return {
    id: row.id,
    kind: "video",
    baseName: row.baseName,
    originalFileName: row.originalFileName ?? undefined,
    ext: row.ext,
    mimeType: row.mimeType,
    albumOrder: 0,
    uploadedAt: row.uploadedAt.toISOString(),
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    durationSeconds: row.durationSeconds ?? undefined,
    sizeOriginal: row.sizeOriginal,
    sizeSm: row.sizeSm,
    sizeLg: row.sizeLg,
    previewStatus: (row.previewStatus as PreviewStatus) ?? "pending",
    previewError: row.previewError ?? undefined,
  };
}

function mapDocumentRow(row: typeof documents.$inferSelect): MediaEntry {
  return {
    id: row.id,
    kind: "document",
    baseName: row.baseName,
    originalFileName: row.originalFileName ?? undefined,
    ext: row.ext,
    mimeType: row.mimeType,
    albumOrder: 0,
    uploadedAt: row.uploadedAt.toISOString(),
    pageCount: row.pageCount ?? undefined,
    sizeOriginal: row.sizeOriginal,
    sizeSm: row.sizeSm,
    sizeLg: row.sizeLg,
    previewStatus: (row.previewStatus as PreviewStatus) ?? "pending",
    previewError: row.previewError ?? undefined,
  };
}

function mapFileRow(row: typeof files.$inferSelect): MediaEntry {
  return {
    id: row.id,
    kind: "other",
    baseName: row.baseName,
    originalFileName: row.originalFileName ?? undefined,
    ext: row.ext,
    mimeType: row.mimeType,
    albumOrder: 0,
    uploadedAt: row.uploadedAt.toISOString(),
    sizeOriginal: row.sizeOriginal,
    sizeSm: row.sizeSm,
    sizeLg: row.sizeLg,
    previewStatus: (row.previewStatus as PreviewStatus) ?? "pending",
    previewError: row.previewError ?? undefined,
  };
}

function stripMarkdownToText(input: string): string {
  try {
    return String(remark().use(stripMarkdown).processSync(input))
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return input.replace(/[*_`#[\]()>!-]/g, "").replace(/\s+/g, " ").trim();
  }
}

function notePreviewText(content: string): string {
  const flattened = stripMarkdownToText(content);
  if (!flattened) {
    return "";
  }
  return flattened.slice(0, 240);
}

function noteSizeBytes(content: string): number {
  return Buffer.byteLength(content, "utf8");
}

function mapNoteRow(row: typeof notes.$inferSelect): MediaEntry {
  return {
    id: row.id,
    kind: "note",
    baseName: row.baseName,
    originalFileName: row.originalFileName ?? undefined,
    ext: "md",
    mimeType: "text/markdown",
    albumOrder: 0,
    uploadedAt: row.uploadedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    sizeOriginal: row.sizeOriginal,
    sizeSm: 0,
    sizeLg: 0,
    previewStatus: "ready",
    previewText: notePreviewText(row.content),
  };
}

function withMembership(
  entry: MediaEntry,
  membership?: Pick<AlbumMembershipItem, "albumId" | "albumCaption" | "albumOrder">,
): MediaEntry {
  if (!membership) {
    return entry;
  }
  return {
    ...entry,
    albumId: membership.albumId,
    albumIds: [membership.albumId],
    albumCaption: membership.albumCaption,
    albumOrder: membership.albumOrder,
  };
}

function noteEntryFromRow(
  row: typeof notes.$inferSelect,
  membership?: Pick<AlbumMembershipItem, "albumId" | "albumCaption" | "albumOrder">,
): NoteEntry {
  return {
    ...withMembership(mapNoteRow(row), membership),
    kind: "note",
    content: row.content,
  };
}

async function generateShareCode(kind: MediaKind): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const raw = randomBytes(6);
    const code = raw
      .toString("base64url")
      .replace(/[-_]/g, "0")
      .slice(0, SHARE_CODE_LENGTH);
    const existing =
      kind === "image"
        ? await db.select({ id: shares.id }).from(shares).where(eq(shares.code, code)).limit(1)
        : kind === "video"
          ? await db
              .select({ id: videoShares.id })
              .from(videoShares)
              .where(eq(videoShares.code, code))
              .limit(1)
          : kind === "document"
            ? await db
                .select({ id: documentShares.id })
                .from(documentShares)
                .where(eq(documentShares.code, code))
                .limit(1)
            : kind === "other"
              ? await db
                  .select({ id: fileShares.id })
                  .from(fileShares)
                  .where(eq(fileShares.code, code))
                  .limit(1)
              : await db
                  .select({ id: noteShares.id })
                  .from(noteShares)
                  .where(eq(noteShares.code, code))
                  .limit(1);
    const [albumCollision] =
      kind === "note"
        ? await db.select({ id: albumShares.id }).from(albumShares).where(eq(albumShares.code, code)).limit(1)
        : [undefined];
    if (!existing[0] && !albumCollision) {
      return code;
    }
  }
  return randomUUID().replace(/-/g, "").slice(0, SHARE_CODE_LENGTH);
}

export async function addMediaForUser(input: {
  userId: string;
  kind: MediaKind;
  baseName: string;
  originalFileName?: string;
  ext: string;
  mimeType: string;
  albumId?: string;
  albumCaption?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  pageCount?: number;
  sizeOriginal: number;
  sizeSm: number;
  sizeLg: number;
  previewStatus: PreviewStatus;
  previewError?: string;
  uploadedAt: string;
}): Promise<MediaEntry> {
  const id = randomUUID();
  const uploadedAt = new Date(input.uploadedAt);

  if (input.kind === "image") {
    await db.insert(images).values({
      id,
      userId: input.userId,
      baseName: input.baseName,
      originalFileName: input.originalFileName ?? null,
      ext: input.ext,
      width: input.width ?? 0,
      height: input.height ?? 0,
      sizeOriginal: input.sizeOriginal,
      sizeSm: input.sizeSm,
      sizeLg: input.sizeLg,
      uploadedAt,
    });
    if (input.albumId) {
      await addMediaItemsToAlbum(input.userId, input.albumId, [{ id, kind: "image" }]);
      if (input.albumCaption?.trim()) {
        await updateAlbumMembershipCaptionForUser(
          input.userId,
          input.albumId,
          { id, kind: "image" },
          input.albumCaption,
        );
      }
    }
    const membership = input.albumId
      ? await getFirstAlbumMembershipForMedia("image", id, input.userId)
      : undefined;
    return {
      id,
      kind: "image",
      baseName: input.baseName,
      originalFileName: input.originalFileName,
      ext: input.ext,
      mimeType: input.mimeType,
      albumId: membership?.albumId,
      albumCaption: membership?.albumCaption,
      albumOrder: membership?.albumOrder ?? 0,
      uploadedAt: uploadedAt.toISOString(),
      width: input.width,
      height: input.height,
      sizeOriginal: input.sizeOriginal,
      sizeSm: input.sizeSm,
      sizeLg: input.sizeLg,
      previewStatus: "ready",
    };
  }

  if (input.kind === "video") {
    await db.insert(videos).values({
      id,
      userId: input.userId,
      baseName: input.baseName,
      originalFileName: input.originalFileName ?? null,
      ext: input.ext,
      mimeType: input.mimeType,
      durationSeconds: input.durationSeconds ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      sizeOriginal: input.sizeOriginal,
      sizeSm: input.sizeSm,
      sizeLg: input.sizeLg,
      previewStatus: input.previewStatus,
      previewError: input.previewError ?? null,
      uploadedAt,
    });
  } else if (input.kind === "document") {
    await db.insert(documents).values({
      id,
      userId: input.userId,
      baseName: input.baseName,
      originalFileName: input.originalFileName ?? null,
      ext: input.ext,
      mimeType: input.mimeType,
      pageCount: input.pageCount ?? null,
      sizeOriginal: input.sizeOriginal,
      sizeSm: input.sizeSm,
      sizeLg: input.sizeLg,
      previewStatus: input.previewStatus,
      previewError: input.previewError ?? null,
      uploadedAt,
    });
  } else if (input.kind === "other") {
    await db.insert(files).values({
      id,
      userId: input.userId,
      baseName: input.baseName,
      originalFileName: input.originalFileName ?? null,
      ext: input.ext,
      mimeType: input.mimeType,
      sizeOriginal: input.sizeOriginal,
      sizeSm: input.sizeSm,
      sizeLg: input.sizeLg,
      previewStatus: input.previewStatus,
      previewError: input.previewError ?? null,
      uploadedAt,
    });
  } else {
    await db.insert(notes).values({
      id,
      userId: input.userId,
      baseName: input.baseName,
      originalFileName: input.originalFileName ?? null,
      content: "",
      sizeOriginal: 0,
      uploadedAt,
      updatedAt: uploadedAt,
    });
  }

  if (input.albumId) {
    await addMediaItemsToAlbum(input.userId, input.albumId, [{ id, kind: input.kind }]);
    if (input.albumCaption?.trim()) {
      await updateAlbumMembershipCaptionForUser(
        input.userId,
        input.albumId,
        { id, kind: input.kind },
        input.albumCaption,
      );
    }
  }
  const membership = input.albumId
    ? await getFirstAlbumMembershipForMedia(input.kind, id, input.userId)
    : undefined;

  return {
    id,
    kind: input.kind,
    baseName: input.baseName,
    originalFileName: input.originalFileName,
    ext: input.ext,
    mimeType: input.mimeType,
    albumId: membership?.albumId,
    albumCaption: membership?.albumCaption,
    albumOrder: membership?.albumOrder ?? 0,
    uploadedAt: uploadedAt.toISOString(),
    width: input.width,
    height: input.height,
    durationSeconds: input.durationSeconds,
    pageCount: input.pageCount,
    sizeOriginal: input.sizeOriginal,
    sizeSm: input.sizeSm,
    sizeLg: input.sizeLg,
    previewStatus: input.previewStatus,
    previewError: input.previewError,
  };
}

export async function updateOriginalFileNameForUser(input: {
  userId: string;
  kind: MediaKind;
  mediaId: string;
  originalFileName: string | null;
}): Promise<MediaEntry | undefined> {
  if (input.kind === "image") {
    const [row] = await db
      .update(images)
      .set({ originalFileName: input.originalFileName })
      .where(and(eq(images.userId, input.userId), eq(images.id, input.mediaId)))
      .returning();
    return row ? mapImageRow(row) : undefined;
  }
  if (input.kind === "video") {
    const [row] = await db
      .update(videos)
      .set({ originalFileName: input.originalFileName })
      .where(and(eq(videos.userId, input.userId), eq(videos.id, input.mediaId)))
      .returning();
    return row ? mapVideoRow(row) : undefined;
  }
  if (input.kind === "document") {
    const [row] = await db
      .update(documents)
      .set({ originalFileName: input.originalFileName })
      .where(and(eq(documents.userId, input.userId), eq(documents.id, input.mediaId)))
      .returning();
    return row ? mapDocumentRow(row) : undefined;
  }
  if (input.kind === "other") {
    const [row] = await db
      .update(files)
      .set({ originalFileName: input.originalFileName })
      .where(and(eq(files.userId, input.userId), eq(files.id, input.mediaId)))
      .returning();
    return row ? mapFileRow(row) : undefined;
  }
  const [row] = await db
    .update(notes)
    .set({ originalFileName: input.originalFileName })
    .where(and(eq(notes.userId, input.userId), eq(notes.id, input.mediaId)))
    .returning();
  return row ? mapNoteRow(row) : undefined;
}

export type NoteEntry = MediaEntry & {
  kind: "note";
  content: string;
};

export async function createNoteForUser(input: {
  userId: string;
  albumId?: string;
  originalFileName?: string;
  content?: string;
}): Promise<NoteEntry> {
  const id = randomUUID();
  const now = new Date();
  const content = input.content ?? "";
  await db.insert(notes).values({
    id,
    userId: input.userId,
    baseName: `note-${id.slice(0, 8)}`,
    originalFileName: input.originalFileName ?? "Untitled note",
    content,
    sizeOriginal: noteSizeBytes(content),
    uploadedAt: now,
    updatedAt: now,
  });
  if (input.albumId) {
    await addMediaItemsToAlbum(input.userId, input.albumId, [{ id, kind: "note" }]);
  }
  const membership = input.albumId
    ? await getFirstAlbumMembershipForMedia("note", id, input.userId)
    : undefined;
  return noteEntryFromRow({
    id,
    userId: input.userId,
    albumId: membership?.albumId ?? null,
    albumCaption: membership?.albumCaption ?? null,
    albumOrder: membership?.albumOrder ?? 0,
    baseName: `note-${id.slice(0, 8)}`,
    originalFileName: input.originalFileName ?? "Untitled note",
    content,
    sizeOriginal: noteSizeBytes(content),
    uploadedAt: now,
    updatedAt: now,
  }, membership);
}

export async function getNoteForUser(noteId: string, userId: string): Promise<NoteEntry | undefined> {
  const [row] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
    .limit(1);
  return row ? noteEntryFromRow(row) : undefined;
}

export async function getNote(noteId: string): Promise<NoteEntry | undefined> {
  const [row] = await db.select().from(notes).where(eq(notes.id, noteId)).limit(1);
  return row ? noteEntryFromRow(row) : undefined;
}

export async function updateNoteForUser(input: {
  userId: string;
  noteId: string;
  content: string;
}): Promise<NoteEntry | undefined> {
  const updatedAt = new Date();
  const [row] = await db
    .update(notes)
    .set({
      content: input.content,
      sizeOriginal: noteSizeBytes(input.content),
      updatedAt,
    })
    .where(and(eq(notes.userId, input.userId), eq(notes.id, input.noteId)))
    .returning();
  return row ? noteEntryFromRow(row) : undefined;
}

export async function listMediaForUser(userId: string): Promise<MediaEntry[]> {
  const [imageRows, videoRows, documentRows, fileRows, noteRows, memberships] =
    await Promise.all([
    db
      .select({ image: images, shareId: shares.id })
      .from(images)
      .leftJoin(shares, and(eq(shares.imageId, images.id), eq(shares.userId, userId)))
      .where(eq(images.userId, userId)),
    db
      .select({ video: videos, shareId: videoShares.id })
      .from(videos)
      .leftJoin(videoShares, and(eq(videoShares.videoId, videos.id), eq(videoShares.userId, userId)))
      .where(eq(videos.userId, userId)),
    db
      .select({ document: documents, shareId: documentShares.id })
      .from(documents)
      .leftJoin(
        documentShares,
        and(eq(documentShares.documentId, documents.id), eq(documentShares.userId, userId)),
      )
      .where(eq(documents.userId, userId)),
    db
      .select({ file: files, shareId: fileShares.id })
      .from(files)
      .leftJoin(fileShares, and(eq(fileShares.fileId, files.id), eq(fileShares.userId, userId)))
      .where(eq(files.userId, userId)),
    db
      .select({ note: notes, shareId: noteShares.id })
      .from(notes)
      .leftJoin(noteShares, and(eq(noteShares.noteId, notes.id), eq(noteShares.userId, userId)))
      .where(eq(notes.userId, userId)),
    listAlbumMembershipsForUser(userId),
  ]);
  const membershipByMedia = new Map<string, AlbumMembershipItem>();
  const albumIdsByMedia = new Map<string, string[]>();
  for (const membership of memberships) {
    const key = `${membership.mediaType}:${membership.mediaId}`;
    if (!membershipByMedia.has(key)) {
      membershipByMedia.set(key, membership);
    }
    const existing = albumIdsByMedia.get(key) ?? [];
    existing.push(membership.albumId);
    albumIdsByMedia.set(key, existing);
  }

  const flattened = [
    ...imageRows.map((row) => ({
      ...withMembership(mapImageRow(row.image), membershipByMedia.get(`image:${row.image.id}`)),
      albumIds: albumIdsByMedia.get(`image:${row.image.id}`) ?? [],
      shared: Boolean(row.shareId),
    })),
    ...videoRows.map((row) => ({
      ...withMembership(mapVideoRow(row.video), membershipByMedia.get(`video:${row.video.id}`)),
      albumIds: albumIdsByMedia.get(`video:${row.video.id}`) ?? [],
      shared: Boolean(row.shareId),
    })),
    ...documentRows.map((row) => ({
      ...withMembership(mapDocumentRow(row.document), membershipByMedia.get(`document:${row.document.id}`)),
      albumIds: albumIdsByMedia.get(`document:${row.document.id}`) ?? [],
      shared: Boolean(row.shareId),
    })),
    ...fileRows.map((row) => ({
      ...withMembership(mapFileRow(row.file), membershipByMedia.get(`other:${row.file.id}`)),
      albumIds: albumIdsByMedia.get(`other:${row.file.id}`) ?? [],
      shared: Boolean(row.shareId),
    })),
    ...noteRows.map((row) => ({
      ...withMembership(mapNoteRow(row.note), membershipByMedia.get(`note:${row.note.id}`)),
      albumIds: albumIdsByMedia.get(`note:${row.note.id}`) ?? [],
      shared: Boolean(row.shareId),
    })),
  ];
  return flattened.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

export async function listMediaForAlbum(userId: string, albumId: string): Promise<MediaEntry[]> {
  const memberships = await listAlbumMembershipsForUser(userId, albumId);
  if (memberships.length === 0) {
    return [];
  }
  const grouped = {
    image: memberships.filter((item) => item.mediaType === "image").map((item) => item.mediaId),
    video: memberships.filter((item) => item.mediaType === "video").map((item) => item.mediaId),
    document: memberships.filter((item) => item.mediaType === "document").map((item) => item.mediaId),
    other: memberships.filter((item) => item.mediaType === "other").map((item) => item.mediaId),
    note: memberships.filter((item) => item.mediaType === "note").map((item) => item.mediaId),
  };
  const [imageRows, videoRows, documentRows, fileRows, noteRows] = await Promise.all([
    grouped.image.length > 0
      ? db
          .select({ media: images, shareId: shares.id })
          .from(images)
          .leftJoin(shares, and(eq(shares.imageId, images.id), eq(shares.userId, userId)))
          .where(and(eq(images.userId, userId), inArray(images.id, grouped.image)))
      : Promise.resolve([]),
    grouped.video.length > 0
      ? db
          .select({ media: videos, shareId: videoShares.id })
          .from(videos)
          .leftJoin(videoShares, and(eq(videoShares.videoId, videos.id), eq(videoShares.userId, userId)))
          .where(and(eq(videos.userId, userId), inArray(videos.id, grouped.video)))
      : Promise.resolve([]),
    grouped.document.length > 0
      ? db
          .select({ media: documents, shareId: documentShares.id })
          .from(documents)
          .leftJoin(
            documentShares,
            and(eq(documentShares.documentId, documents.id), eq(documentShares.userId, userId)),
          )
          .where(and(eq(documents.userId, userId), inArray(documents.id, grouped.document)))
      : Promise.resolve([]),
    grouped.other.length > 0
      ? db
          .select({ media: files, shareId: fileShares.id })
          .from(files)
          .leftJoin(fileShares, and(eq(fileShares.fileId, files.id), eq(fileShares.userId, userId)))
          .where(and(eq(files.userId, userId), inArray(files.id, grouped.other)))
      : Promise.resolve([]),
    grouped.note.length > 0
      ? db
          .select({ media: notes, shareId: noteShares.id })
          .from(notes)
          .leftJoin(noteShares, and(eq(noteShares.noteId, notes.id), eq(noteShares.userId, userId)))
          .where(and(eq(notes.userId, userId), inArray(notes.id, grouped.note)))
      : Promise.resolve([]),
  ]);

  const mediaByKey = new Map<string, MediaEntry>();
  for (const row of imageRows) {
    mediaByKey.set(`image:${row.media.id}`, { ...mapImageRow(row.media), shared: Boolean(row.shareId) });
  }
  for (const row of videoRows) {
    mediaByKey.set(`video:${row.media.id}`, { ...mapVideoRow(row.media), shared: Boolean(row.shareId) });
  }
  for (const row of documentRows) {
    mediaByKey.set(`document:${row.media.id}`, {
      ...mapDocumentRow(row.media),
      shared: Boolean(row.shareId),
    });
  }
  for (const row of fileRows) {
    mediaByKey.set(`other:${row.media.id}`, { ...mapFileRow(row.media), shared: Boolean(row.shareId) });
  }
  for (const row of noteRows) {
    mediaByKey.set(`note:${row.media.id}`, { ...mapNoteRow(row.media), shared: Boolean(row.shareId) });
  }

  return memberships
    .map((membership) => {
      const key = `${membership.mediaType}:${membership.mediaId}`;
      const media = mediaByKey.get(key);
      if (!media) {
        return undefined;
      }
      return withMembership(media, membership);
    })
    .filter(Boolean) as MediaEntry[];
}

export async function listMediaForAlbumPublic(albumId: string): Promise<MediaEntry[]> {
  const memberships = await listAlbumMembershipsPublic(albumId);
  if (memberships.length === 0) {
    return [];
  }
  const grouped = {
    image: memberships.filter((item) => item.mediaType === "image").map((item) => item.mediaId),
    video: memberships.filter((item) => item.mediaType === "video").map((item) => item.mediaId),
    document: memberships.filter((item) => item.mediaType === "document").map((item) => item.mediaId),
    other: memberships.filter((item) => item.mediaType === "other").map((item) => item.mediaId),
    note: memberships.filter((item) => item.mediaType === "note").map((item) => item.mediaId),
  };
  const [imageRows, videoRows, documentRows, fileRows, noteRows] = await Promise.all([
    grouped.image.length > 0
      ? db.select().from(images).where(inArray(images.id, grouped.image))
      : Promise.resolve([]),
    grouped.video.length > 0
      ? db.select().from(videos).where(inArray(videos.id, grouped.video))
      : Promise.resolve([]),
    grouped.document.length > 0
      ? db.select().from(documents).where(inArray(documents.id, grouped.document))
      : Promise.resolve([]),
    grouped.other.length > 0
      ? db.select().from(files).where(inArray(files.id, grouped.other))
      : Promise.resolve([]),
    grouped.note.length > 0
      ? db.select().from(notes).where(inArray(notes.id, grouped.note))
      : Promise.resolve([]),
  ]);

  const mediaByKey = new Map<string, MediaEntry>();
  for (const row of imageRows) {
    mediaByKey.set(`image:${row.id}`, mapImageRow(row));
  }
  for (const row of videoRows) {
    mediaByKey.set(`video:${row.id}`, mapVideoRow(row));
  }
  for (const row of documentRows) {
    mediaByKey.set(`document:${row.id}`, mapDocumentRow(row));
  }
  for (const row of fileRows) {
    mediaByKey.set(`other:${row.id}`, mapFileRow(row));
  }
  for (const row of noteRows) {
    mediaByKey.set(`note:${row.id}`, { ...mapNoteRow(row), content: row.content });
  }

  return memberships
    .map((membership) => {
      const key = `${membership.mediaType}:${membership.mediaId}`;
      const media = mediaByKey.get(key);
      if (!media) {
        return undefined;
      }
      return withMembership(media, membership);
    })
    .filter(Boolean) as MediaEntry[];
}

export async function getMediaForUser(
  kind: MediaKind,
  id: string,
  userId: string,
): Promise<MediaEntry | undefined> {
  if (kind === "image") {
    const [row] = await db
      .select()
      .from(images)
      .where(and(eq(images.id, id), eq(images.userId, userId)))
      .limit(1);
    if (!row) {
      return undefined;
    }
    const membership = await getFirstAlbumMembershipForMedia("image", row.id, userId);
    return withMembership(mapImageRow(row), membership);
  }
  if (kind === "video") {
    const [row] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.id, id), eq(videos.userId, userId)))
      .limit(1);
    if (!row) {
      return undefined;
    }
    const membership = await getFirstAlbumMembershipForMedia("video", row.id, userId);
    return withMembership(mapVideoRow(row), membership);
  }
  if (kind === "document") {
    const [row] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)))
      .limit(1);
    if (!row) {
      return undefined;
    }
    const membership = await getFirstAlbumMembershipForMedia("document", row.id, userId);
    return withMembership(mapDocumentRow(row), membership);
  }
  if (kind === "other") {
    const [row] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.userId, userId)))
      .limit(1);
    if (!row) {
      return undefined;
    }
    const membership = await getFirstAlbumMembershipForMedia("other", row.id, userId);
    return withMembership(mapFileRow(row), membership);
  }
  const [row] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .limit(1);
  if (!row) {
    return undefined;
  }
  const membership = await getFirstAlbumMembershipForMedia("note", row.id, userId);
  return withMembership(mapNoteRow(row), membership);
}

export async function getMedia(kind: MediaKind, id: string): Promise<MediaEntry | undefined> {
  if (kind === "image") {
    const [row] = await db.select().from(images).where(eq(images.id, id)).limit(1);
    if (!row) {
      return undefined;
    }
    const membership = await getFirstAlbumMembershipForMedia("image", row.id);
    return withMembership(mapImageRow(row), membership);
  }
  if (kind === "video") {
    const [row] = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
    if (!row) {
      return undefined;
    }
    const membership = await getFirstAlbumMembershipForMedia("video", row.id);
    return withMembership(mapVideoRow(row), membership);
  }
  if (kind === "document") {
    const [row] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!row) {
      return undefined;
    }
    const membership = await getFirstAlbumMembershipForMedia("document", row.id);
    return withMembership(mapDocumentRow(row), membership);
  }
  if (kind === "other") {
    const [row] = await db.select().from(files).where(eq(files.id, id)).limit(1);
    if (!row) {
      return undefined;
    }
    const membership = await getFirstAlbumMembershipForMedia("other", row.id);
    return withMembership(mapFileRow(row), membership);
  }
  const [row] = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
  if (!row) {
    return undefined;
  }
  const membership = await getFirstAlbumMembershipForMedia("note", row.id);
  return withMembership(mapNoteRow(row), membership);
}

export async function getMediaWithOwner(
  kind: Exclude<BlobMediaKind, "image">,
  id: string,
): Promise<(MediaEntry & { userId: string }) | undefined> {
  if (kind === "video") {
    const [row] = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
    return row ? { ...mapVideoRow(row), userId: row.userId } : undefined;
  }
  if (kind === "document") {
    const [row] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    return row ? { ...mapDocumentRow(row), userId: row.userId } : undefined;
  }
  if (kind === "other") {
    const [row] = await db.select().from(files).where(eq(files.id, id)).limit(1);
    return row ? { ...mapFileRow(row), userId: row.userId } : undefined;
  }
  const [row] = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
  return row ? { ...mapNoteRow(row), userId: row.userId } : undefined;
}

export async function getShareForUserByMedia(
  kind: MediaKind,
  mediaId: string,
  userId: string,
): Promise<{ id: string; code?: string | null } | undefined> {
  if (kind === "image") {
    const [row] = await db
      .select({ id: shares.id, code: shares.code })
      .from(shares)
      .where(and(eq(shares.imageId, mediaId), eq(shares.userId, userId)))
      .limit(1);
    return row;
  }
  if (kind === "video") {
    const [row] = await db
      .select({ id: videoShares.id, code: videoShares.code })
      .from(videoShares)
      .where(and(eq(videoShares.videoId, mediaId), eq(videoShares.userId, userId)))
      .limit(1);
    return row;
  }
  if (kind === "document") {
    const [row] = await db
      .select({ id: documentShares.id, code: documentShares.code })
      .from(documentShares)
      .where(and(eq(documentShares.documentId, mediaId), eq(documentShares.userId, userId)))
      .limit(1);
    return row;
  }
  if (kind === "other") {
    const [row] = await db
      .select({ id: fileShares.id, code: fileShares.code })
      .from(fileShares)
      .where(and(eq(fileShares.fileId, mediaId), eq(fileShares.userId, userId)))
      .limit(1);
    return row;
  }
  const [row] = await db
    .select({ id: noteShares.id, code: noteShares.code })
    .from(noteShares)
    .where(and(eq(noteShares.noteId, mediaId), eq(noteShares.userId, userId)))
    .limit(1);
  return row;
}

export async function getShareByCode(
  kind: MediaKind,
  code: string,
): Promise<{ id: string; mediaId: string; code?: string | null } | undefined> {
  if (kind === "image") {
    const [row] = await db
      .select({ id: shares.id, mediaId: shares.imageId, code: shares.code })
      .from(shares)
      .where(eq(shares.code, code))
      .limit(1);
    return row;
  }
  if (kind === "video") {
    const [row] = await db
      .select({ id: videoShares.id, mediaId: videoShares.videoId, code: videoShares.code })
      .from(videoShares)
      .where(eq(videoShares.code, code))
      .limit(1);
    return row;
  }
  if (kind === "document") {
    const [row] = await db
      .select({ id: documentShares.id, mediaId: documentShares.documentId, code: documentShares.code })
      .from(documentShares)
      .where(eq(documentShares.code, code))
      .limit(1);
    return row;
  }
  if (kind === "other") {
    const [row] = await db
      .select({ id: fileShares.id, mediaId: fileShares.fileId, code: fileShares.code })
      .from(fileShares)
      .where(eq(fileShares.code, code))
      .limit(1);
    return row;
  }
  const [row] = await db
    .select({ id: noteShares.id, mediaId: noteShares.noteId, code: noteShares.code })
    .from(noteShares)
    .where(eq(noteShares.code, code))
    .limit(1);
  return row;
}

export async function getSharedMediaByCodeAndExt(code: string, ext: string): Promise<MediaEntry | undefined> {
  const loweredExt = ext.toLowerCase();

  const [imageShare] = await db
    .select({ mediaId: shares.imageId })
    .from(shares)
    .innerJoin(images, eq(images.id, shares.imageId))
    .where(and(eq(shares.code, code), eq(images.ext, loweredExt)))
    .limit(1);
  if (imageShare?.mediaId) {
    return getMedia("image", imageShare.mediaId);
  }

  const [videoShare] = await db
    .select({ mediaId: videoShares.videoId })
    .from(videoShares)
    .innerJoin(videos, eq(videos.id, videoShares.videoId))
    .where(and(eq(videoShares.code, code), eq(videos.ext, loweredExt)))
    .limit(1);
  if (videoShare?.mediaId) {
    return getMedia("video", videoShare.mediaId);
  }

  const [documentShare] = await db
    .select({ mediaId: documentShares.documentId })
    .from(documentShares)
    .innerJoin(documents, eq(documents.id, documentShares.documentId))
    .where(and(eq(documentShares.code, code), eq(documents.ext, loweredExt)))
    .limit(1);
  if (documentShare?.mediaId) {
    return getMedia("document", documentShare.mediaId);
  }

  const [fileShare] = await db
    .select({ mediaId: fileShares.fileId })
    .from(fileShares)
    .innerJoin(files, eq(files.id, fileShares.fileId))
    .where(and(eq(fileShares.code, code), eq(files.ext, loweredExt)))
    .limit(1);
  if (fileShare?.mediaId) {
    return getMedia("other", fileShare.mediaId);
  }

  if (loweredExt === "md") {
    const [noteShare] = await db
      .select({ mediaId: noteShares.noteId })
      .from(noteShares)
      .where(eq(noteShares.code, code))
      .limit(1);
    if (noteShare?.mediaId) {
      return getMedia("note", noteShare.mediaId);
    }
  }

  return undefined;
}

export async function getSharedMediaByCode(code: string): Promise<MediaEntry | undefined> {
  const [imageShare] = await db
    .select({ mediaId: shares.imageId })
    .from(shares)
    .where(eq(shares.code, code))
    .limit(1);
  if (imageShare?.mediaId) {
    return getMedia("image", imageShare.mediaId);
  }

  const [videoShare] = await db
    .select({ mediaId: videoShares.videoId })
    .from(videoShares)
    .where(eq(videoShares.code, code))
    .limit(1);
  if (videoShare?.mediaId) {
    return getMedia("video", videoShare.mediaId);
  }

  const [documentShare] = await db
    .select({ mediaId: documentShares.documentId })
    .from(documentShares)
    .where(eq(documentShares.code, code))
    .limit(1);
  if (documentShare?.mediaId) {
    return getMedia("document", documentShare.mediaId);
  }

  const [fileShare] = await db
    .select({ mediaId: fileShares.fileId })
    .from(fileShares)
    .where(eq(fileShares.code, code))
    .limit(1);
  if (fileShare?.mediaId) {
    return getMedia("other", fileShare.mediaId);
  }

  const [noteShare] = await db
    .select({ mediaId: noteShares.noteId })
    .from(noteShares)
    .where(eq(noteShares.code, code))
    .limit(1);
  if (noteShare?.mediaId) {
    return getMedia("note", noteShare.mediaId);
  }

  return undefined;
}

export async function createShareForMedia(
  kind: MediaKind,
  mediaId: string,
  userId: string,
): Promise<{ id: string; code: string } | undefined> {
  const media = await getMediaForUser(kind, mediaId, userId);
  if (!media) {
    return undefined;
  }
  const existing = await getShareForUserByMedia(kind, mediaId, userId);
  if (existing?.code) {
    return { id: existing.id, code: existing.code };
  }
  const code = await generateShareCode(kind);
  if (kind === "image") {
    if (existing) {
      const [row] = await db
        .update(shares)
        .set({ code })
        .where(eq(shares.id, existing.id))
        .returning({ id: shares.id, code: shares.code });
      return row ? { id: row.id, code: row.code ?? code } : undefined;
    }
    const id = randomUUID();
    await db.insert(shares).values({
      id,
      userId,
      imageId: mediaId,
      code,
      createdAt: new Date(),
    });
    return { id, code };
  }
  if (kind === "video") {
    if (existing) {
      const [row] = await db
        .update(videoShares)
        .set({ code })
        .where(eq(videoShares.id, existing.id))
        .returning({ id: videoShares.id, code: videoShares.code });
      return row ? { id: row.id, code: row.code ?? code } : undefined;
    }
    const id = randomUUID();
    await db.insert(videoShares).values({
      id,
      userId,
      videoId: mediaId,
      code,
      createdAt: new Date(),
    });
    return { id, code };
  }
  if (kind === "document") {
    if (existing) {
      const [row] = await db
        .update(documentShares)
        .set({ code })
        .where(eq(documentShares.id, existing.id))
        .returning({ id: documentShares.id, code: documentShares.code });
      return row ? { id: row.id, code: row.code ?? code } : undefined;
    }
    const id = randomUUID();
    await db.insert(documentShares).values({
      id,
      userId,
      documentId: mediaId,
      code,
      createdAt: new Date(),
    });
    return { id, code };
  }
  if (kind === "other") {
    if (existing) {
      const [row] = await db
        .update(fileShares)
        .set({ code })
        .where(eq(fileShares.id, existing.id))
        .returning({ id: fileShares.id, code: fileShares.code });
      return row ? { id: row.id, code: row.code ?? code } : undefined;
    }
    const id = randomUUID();
    await db.insert(fileShares).values({
      id,
      userId,
      fileId: mediaId,
      code,
      createdAt: new Date(),
    });
    return { id, code };
  }
  if (existing) {
    const [row] = await db
      .update(noteShares)
      .set({ code })
      .where(eq(noteShares.id, existing.id))
      .returning({ id: noteShares.id, code: noteShares.code });
    return row ? { id: row.id, code: row.code ?? code } : undefined;
  }
  const id = randomUUID();
  await db.insert(noteShares).values({
    id,
    userId,
    noteId: mediaId,
    code,
    createdAt: new Date(),
  });
  return { id, code };
}

export async function deleteShareForMedia(
  kind: MediaKind,
  mediaId: string,
  userId: string,
): Promise<boolean> {
  if (kind === "image") {
    const rows = await db
      .delete(shares)
      .where(and(eq(shares.userId, userId), eq(shares.imageId, mediaId)))
      .returning({ id: shares.id });
    return rows.length > 0;
  }
  if (kind === "video") {
    const rows = await db
      .delete(videoShares)
      .where(and(eq(videoShares.userId, userId), eq(videoShares.videoId, mediaId)))
      .returning({ id: videoShares.id });
    return rows.length > 0;
  }
  if (kind === "document") {
    const rows = await db
      .delete(documentShares)
      .where(and(eq(documentShares.userId, userId), eq(documentShares.documentId, mediaId)))
      .returning({ id: documentShares.id });
    return rows.length > 0;
  }
  if (kind === "other") {
    const rows = await db
      .delete(fileShares)
      .where(and(eq(fileShares.userId, userId), eq(fileShares.fileId, mediaId)))
      .returning({ id: fileShares.id });
    return rows.length > 0;
  }
  const rows = await db
    .delete(noteShares)
    .where(and(eq(noteShares.userId, userId), eq(noteShares.noteId, mediaId)))
    .returning({ id: noteShares.id });
  return rows.length > 0;
}

export async function getMediaPreviewStatusForUser(
  userId: string,
  kind: MediaKind,
  mediaId: string,
): Promise<{ previewStatus: PreviewStatus; previewError?: string } | undefined> {
  const media = await getMediaForUser(kind, mediaId, userId);
  if (!media) {
    return undefined;
  }
  return {
    previewStatus: media.previewStatus,
    previewError: media.previewError,
  };
}

export async function updateVideoPreviewForUser(input: {
  userId: string;
  mediaId: string;
  previewStatus: PreviewStatus;
  previewError?: string | null;
  sizeSm?: number;
  sizeLg?: number;
  width?: number;
  height?: number;
}): Promise<MediaEntry | undefined> {
  const [row] = await db
    .update(videos)
    .set({
      previewStatus: input.previewStatus,
      previewError: input.previewError ?? null,
      sizeSm: input.sizeSm,
      sizeLg: input.sizeLg,
      width: input.width,
      height: input.height,
    })
    .where(and(eq(videos.userId, input.userId), eq(videos.id, input.mediaId)))
    .returning();

  if (!row) {
    return undefined;
  }
  return mapVideoRow(row);
}

export async function updateMediaPreviewForUser(input: {
  userId: string;
  kind: Exclude<MediaKind, "image" | "note">;
  mediaId: string;
  previewStatus: PreviewStatus;
  previewError?: string | null;
  sizeSm?: number;
  sizeLg?: number;
  width?: number;
  height?: number;
}): Promise<MediaEntry | undefined> {
  if (input.kind === "video") {
    return updateVideoPreviewForUser(input);
  }

  if (input.kind === "document") {
    const [row] = await db
      .update(documents)
      .set({
        previewStatus: input.previewStatus,
        previewError: input.previewError ?? null,
        sizeSm: input.sizeSm,
        sizeLg: input.sizeLg,
      })
      .where(and(eq(documents.userId, input.userId), eq(documents.id, input.mediaId)))
      .returning();
    return row ? mapDocumentRow(row) : undefined;
  }

  const [row] = await db
    .update(files)
    .set({
      previewStatus: input.previewStatus,
      previewError: input.previewError ?? null,
      sizeSm: input.sizeSm,
      sizeLg: input.sizeLg,
    })
    .where(and(eq(files.userId, input.userId), eq(files.id, input.mediaId)))
    .returning();
  return row ? mapFileRow(row) : undefined;
}

export function sortMediaForAlbum(media: MediaEntry[]): MediaEntry[] {
  return media.sort((a, b) => {
    if ((a.albumOrder ?? 0) !== (b.albumOrder ?? 0)) {
      return (a.albumOrder ?? 0) - (b.albumOrder ?? 0);
    }
    return descDate(a.uploadedAt, b.uploadedAt);
  });
}

function descDate(a: string, b: string): number {
  return new Date(b).getTime() - new Date(a).getTime();
}

export async function updateMediaAlbum(
  userId: string,
  mediaItems: Array<{ id: string; kind: MediaKind }>,
  albumId: string | null,
): Promise<void> {
  if (albumId) {
    await addMediaItemsToAlbum(userId, albumId, mediaItems);
    return;
  }
  await removeMediaItemsFromAlbum(userId, mediaItems);
}

export async function removeMediaFromAlbum(
  userId: string,
  mediaItems: MediaRef[],
  albumId: string,
): Promise<void> {
  await removeMediaItemsFromAlbum(userId, mediaItems, albumId);
}

export async function reorderAlbumMedia(
  userId: string,
  albumId: string,
  orderedMediaItems: MediaRef[],
): Promise<boolean> {
  return reorderAlbumMediaForUser(userId, albumId, orderedMediaItems);
}

export async function updateAlbumMediaCaption(
  userId: string,
  albumId: string,
  mediaItem: MediaRef,
  caption: string,
): Promise<MediaEntry | undefined> {
  const membership = await updateAlbumMembershipCaptionForUser(
    userId,
    albumId,
    mediaItem,
    caption,
  );
  if (!membership) {
    return undefined;
  }
  const media = await getMediaForUser(mediaItem.kind, mediaItem.id, userId);
  return media ? withMembership(media, membership) : undefined;
}

export async function mediaIsInAlbum(
  albumId: string,
  mediaItem: MediaRef,
): Promise<boolean> {
  return isMediaInAlbum(albumId, mediaItem);
}

export async function deleteMediaForUser(
  userId: string,
  mediaItems: Array<{ id: string; kind: MediaKind }>,
): Promise<void> {
  await removeMediaItemsFromAlbum(userId, mediaItems);
  for (const item of mediaItems) {
    const media = await getMediaForUser(item.kind, item.id, userId);
    if (!media) {
      continue;
    }
    await deleteShareForMedia(item.kind, item.id, userId);
    if (item.kind === "image") {
      await deleteImageFiles(media.baseName, media.ext, new Date(media.uploadedAt));
      await db.delete(images).where(and(eq(images.userId, userId), eq(images.id, item.id)));
    } else if (item.kind === "video") {
      await db.delete(videos).where(and(eq(videos.userId, userId), eq(videos.id, item.id)));
    } else if (item.kind === "document") {
      await db.delete(documents).where(and(eq(documents.userId, userId), eq(documents.id, item.id)));
    } else if (item.kind === "other") {
      await db.delete(files).where(and(eq(files.userId, userId), eq(files.id, item.id)));
    } else {
      await db.delete(notes).where(and(eq(notes.userId, userId), eq(notes.id, item.id)));
    }
  }
}

