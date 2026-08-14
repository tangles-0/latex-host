import {
  getGroupLimits,
  getUserGroupInfo,
} from "@/lib/metadata-store";
import {
  deleteMediaForUser,
  getNoteForUser,
  updateNoteForUser,
} from "@/lib/media-store";
import { withApiV1ParamsRoute } from "@/lib/api-v1/handler";
import { apiV1Error, apiV1Json } from "@/lib/api-v1/errors";
import { resolveVisibilityForMedia } from "@/lib/api-v1/media-register";
import { originFromRequest, toNoteResource } from "@/lib/api-v1/resources";
import { patchNoteBodySchema } from "@/lib/api-v1/schemas";

export const runtime = "nodejs";

export const GET = withApiV1ParamsRoute(async (request, auth, context) => {
  const params = await context.params;
  const id = params.id?.trim() ?? "";
  if (!id) {
    return apiV1Error(400, "invalid_request", "id is required.");
  }
  const note = await getNoteForUser(id, auth.userId);
  if (!note) {
    return apiV1Error(404, "not_found", "Note not found.");
  }
  const share = await resolveVisibilityForMedia({
    kind: "note",
    mediaId: note.id,
    userId: auth.userId,
  });
  return apiV1Json({
    note: toNoteResource({
      note,
      origin: originFromRequest(request),
      visibility: share.visibility,
      shareCode: share.shareCode,
      includeContent: true,
    }),
  });
});

export const PATCH = withApiV1ParamsRoute(async (request, auth, context) => {
  const params = await context.params;
  const id = params.id?.trim() ?? "";
  if (!id) {
    return apiV1Error(400, "invalid_request", "id is required.");
  }
  const json = await request.json().catch(() => null);
  const parsed = patchNoteBodySchema.safeParse(json);
  if (!parsed.success) {
    return apiV1Error(
      400,
      "invalid_request",
      "Invalid note payload.",
      parsed.error.flatten(),
    );
  }

  const existing = await getNoteForUser(id, auth.userId);
  if (!existing) {
    return apiV1Error(404, "not_found", "Note not found.");
  }

  const groupInfo = await getUserGroupInfo(auth.userId);
  const groupLimits = await getGroupLimits(groupInfo.groupId);
  if (Buffer.byteLength(parsed.data.content, "utf8") > groupLimits.maxDocumentSize) {
    return apiV1Error(413, "payload_too_large", "Note exceeds size limit.");
  }

  const note = await updateNoteForUser({
    noteId: id,
    userId: auth.userId,
    content: parsed.data.content,
  });
  if (!note) {
    return apiV1Error(404, "not_found", "Note not found.");
  }

  const share = await resolveVisibilityForMedia({
    kind: "note",
    mediaId: note.id,
    userId: auth.userId,
  });
  return apiV1Json({
    note: toNoteResource({
      note,
      origin: originFromRequest(request),
      visibility: share.visibility,
      shareCode: share.shareCode,
      includeContent: true,
    }),
  });
});

export const DELETE = withApiV1ParamsRoute(async (_request, auth, context) => {
  const params = await context.params;
  const id = params.id?.trim() ?? "";
  if (!id) {
    return apiV1Error(400, "invalid_request", "id is required.");
  }
  const note = await getNoteForUser(id, auth.userId);
  if (!note) {
    return apiV1Error(404, "not_found", "Note not found.");
  }
  await deleteMediaForUser(auth.userId, [{ id: note.id, kind: "note" }]);
  return new Response(null, { status: 204 });
});

export const OPTIONS = GET;
