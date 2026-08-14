import { withApiV1ParamsRoute } from "@/lib/api-v1/handler";
import { apiV1Error } from "@/lib/api-v1/errors";
import {
  abortUploadSession,
  getUploadSessionForUser,
} from "@/lib/upload-sessions";

export const runtime = "nodejs";

export const POST = withApiV1ParamsRoute(async (_request, auth, context) => {
  const params = await context.params;
  const id = params.id?.trim() ?? "";
  if (!id) {
    return apiV1Error(400, "invalid_request", "id is required.");
  }
  const session = await getUploadSessionForUser(id, auth.userId);
  if (!session) {
    return apiV1Error(404, "not_found", "Upload session not found.");
  }
  await abortUploadSession(session);
  return new Response(null, { status: 204 });
});

export const OPTIONS = POST;
