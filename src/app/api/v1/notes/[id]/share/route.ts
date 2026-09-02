import { deleteShareForMedia, getNoteForUser } from "@/lib/media-store";
import { withApiV1ParamsRoute } from "@/lib/api-v1/handler";
import { apiV1Error, apiV1Json } from "@/lib/api-v1/errors";
import { ensureShareForVisibility } from "@/lib/api-v1/media-register";
import { sharePrefixFromRequest } from "@/lib/api-v1/resources";
import { createShareBodySchema } from "@/lib/api-v1/schemas";

export const runtime = "nodejs";

export const POST = withApiV1ParamsRoute(async (request, auth, context) => {
  const params = await context.params;
  const id = params.id?.trim() ?? "";
  if (!id) {
    return apiV1Error(400, "invalid_request", "id is required.");
  }
  const note = await getNoteForUser(id, auth.userId);
  if (!note) {
    return apiV1Error(404, "not_found", "Note not found.");
  }

  const json: unknown = await request.json().catch(() => ({}));
  const parsed = createShareBodySchema.safeParse(json);
  if (!parsed.success) {
    return apiV1Error(
      400,
      "invalid_request",
      "Invalid share payload.",
      parsed.error.flatten(),
    );
  }

  const share = await ensureShareForVisibility({
    kind: "note",
    mediaId: note.id,
    userId: auth.userId,
    visibility: "public",
    password: parsed.data.password,
  });
  if (!share.code) {
    return apiV1Error(500, "internal_error", "Unable to create share.");
  }
  const shareUrl = `${await sharePrefixFromRequest(request)}/${share.code}`;
  return apiV1Json({
    share: { code: share.code },
    shareUrl,
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
  await deleteShareForMedia("note", note.id, auth.userId);
  return new Response(null, { status: 204 });
});

export const OPTIONS = POST;
