import { deleteShareForMedia } from "@/lib/media-store";
import { withApiV1ParamsRoute } from "@/lib/api-v1/handler";
import { apiV1Error, apiV1Json } from "@/lib/api-v1/errors";
import { getBlobFileForUser } from "@/lib/api-v1/list";
import { ensureShareForVisibility } from "@/lib/api-v1/media-register";
import {
  buildAbsoluteShareUrls,
  originFromRequest,
} from "@/lib/api-v1/resources";

export const runtime = "nodejs";

export const POST = withApiV1ParamsRoute(async (request, auth, context) => {
  const params = await context.params;
  const id = params.id?.trim() ?? "";
  if (!id) {
    return apiV1Error(400, "invalid_request", "id is required.");
  }
  const media = await getBlobFileForUser(auth.userId, id);
  if (!media) {
    return apiV1Error(404, "not_found", "File not found.");
  }
  const share = await ensureShareForVisibility({
    kind: media.kind,
    mediaId: media.id,
    userId: auth.userId,
    visibility: "public",
  });
  if (!share.code) {
    return apiV1Error(500, "internal_error", "Unable to create share.");
  }
  const origin = originFromRequest(request);
  const urls = buildAbsoluteShareUrls(origin, media.kind, share.code, media.ext);
  return apiV1Json({
    share: { code: share.code },
    shareUrl: urls.original,
    shareUrls: urls,
  });
});

export const DELETE = withApiV1ParamsRoute(async (_request, auth, context) => {
  const params = await context.params;
  const id = params.id?.trim() ?? "";
  if (!id) {
    return apiV1Error(400, "invalid_request", "id is required.");
  }
  const media = await getBlobFileForUser(auth.userId, id);
  if (!media) {
    return apiV1Error(404, "not_found", "File not found.");
  }
  await deleteShareForMedia(media.kind, media.id, auth.userId);
  return new Response(null, { status: 204 });
});

export const OPTIONS = POST;
