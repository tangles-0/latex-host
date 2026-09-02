import {
  getAlbumForUser,
  getGroupLimits,
  getUserGroupInfo,
} from "@/lib/metadata-store";
import { createNoteForUser } from "@/lib/media-store";
import { withApiV1Route } from "@/lib/api-v1/handler";
import { apiV1Error, apiV1Json } from "@/lib/api-v1/errors";
import { listNotesPageForUser } from "@/lib/api-v1/list";
import {
  ensureShareForVisibility,
  resolveVisibilityForMedia,
} from "@/lib/api-v1/media-register";
import { sharePrefixFromRequest, toNoteResource } from "@/lib/api-v1/resources";
import {
  createNoteBodySchema,
  notesListQuerySchema,
} from "@/lib/api-v1/schemas";

export const runtime = "nodejs";

export const GET = withApiV1Route(async (request, auth) => {
  const url = new URL(request.url);
  const parsed = notesListQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
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
  const page = await listNotesPageForUser({
    userId: auth.userId,
    limit: parsed.data.limit,
    cursor: parsed.data.cursor,
    albumId: parsed.data.albumId,
  });
  const sharePrefix = await sharePrefixFromRequest(request);
  const notes = await Promise.all(
    page.items.map(async (note) => {
      const share = await resolveVisibilityForMedia({
        kind: "note",
        mediaId: note.id,
        userId: auth.userId,
      });
      return toNoteResource({
        note,
        sharePrefix,
        visibility: share.visibility,
        shareCode: share.shareCode,
        includeContent: false,
      });
    }),
  );
  return apiV1Json({ notes, nextCursor: page.nextCursor });
});

export const POST = withApiV1Route(async (request, auth) => {
  const json: unknown = await request.json().catch(() => null);
  const parsed = createNoteBodySchema.safeParse(json);
  if (!parsed.success) {
    return apiV1Error(
      400,
      "invalid_request",
      "Invalid note payload.",
      parsed.error.flatten(),
    );
  }

  const albumId = parsed.data.albumId?.trim() || undefined;
  if (albumId) {
    const album = await getAlbumForUser(albumId, auth.userId);
    if (!album) {
      return apiV1Error(404, "not_found", "Album not found.");
    }
  }

  const groupInfo = await getUserGroupInfo(auth.userId);
  const groupLimits = await getGroupLimits(groupInfo.groupId);
  if (
    Buffer.byteLength(parsed.data.content, "utf8") > groupLimits.maxDocumentSize
  ) {
    return apiV1Error(413, "payload_too_large", "Note exceeds size limit.");
  }

  const note = await createNoteForUser({
    userId: auth.userId,
    albumId,
    originalFileName: (parsed.data.originalFileName ?? "Untitled note").slice(
      0,
      255,
    ),
    content: parsed.data.content,
  });

  const share = await ensureShareForVisibility({
    kind: "note",
    mediaId: note.id,
    userId: auth.userId,
    visibility: parsed.data.visibility,
  });

  const resource = toNoteResource({
    note,
    sharePrefix: await sharePrefixFromRequest(request),
    visibility: share.visibility,
    shareCode: share.code,
    includeContent: true,
  });

  return apiV1Json(
    { note: resource },
    { status: 201, location: resource.links.self },
  );
});

export const OPTIONS = GET;
