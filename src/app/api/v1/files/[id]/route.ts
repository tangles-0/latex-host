import { deleteMediaForUser } from "@/lib/media-store";
import { withApiV1Route } from "@/lib/api-v1/handler";
import { apiV1Error, apiV1Json } from "@/lib/api-v1/errors";
import { getBlobFileForUser } from "@/lib/api-v1/list";
import { resolveVisibilityForMedia } from "@/lib/api-v1/media-register";
import { originFromRequest, toFileResource } from "@/lib/api-v1/resources";

export const runtime = "nodejs";

export const GET = withApiV1Route(async (request, auth, context) => {
  const params = context ? await context.params : {};
  const id = params.id?.trim() ?? "";
  if (!id) {
    return apiV1Error(400, "invalid_request", "id is required.");
  }
  const media = await getBlobFileForUser(auth.userId, id);
  if (!media) {
    return apiV1Error(404, "not_found", "File not found.");
  }
  const share = await resolveVisibilityForMedia({
    kind: media.kind,
    mediaId: media.id,
    userId: auth.userId,
  });
  return apiV1Json({
    file: toFileResource({
      media,
      origin: originFromRequest(request),
      visibility: share.visibility,
      shareCode: share.shareCode,
    }),
  });
});

export const DELETE = withApiV1Route(async (_request, auth, context) => {
  const params = context ? await context.params : {};
  const id = params.id?.trim() ?? "";
  if (!id) {
    return apiV1Error(400, "invalid_request", "id is required.");
  }
  const media = await getBlobFileForUser(auth.userId, id);
  if (!media) {
    return apiV1Error(404, "not_found", "File not found.");
  }
  await deleteMediaForUser(auth.userId, [{ id: media.id, kind: media.kind }]);
  return new Response(null, { status: 204 });
});

export const OPTIONS = GET;
