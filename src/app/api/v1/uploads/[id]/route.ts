import { withApiV1Route } from "@/lib/api-v1/handler";
import { apiV1Error, apiV1Json } from "@/lib/api-v1/errors";
import {
  getBlobMultipartClientState,
  getUploadSessionForUser,
} from "@/lib/upload-sessions";

export const runtime = "nodejs";

export const GET = withApiV1Route(async (_request, auth, context) => {
  const params = context ? await context.params : {};
  const id = params.id?.trim() ?? "";
  if (!id) {
    return apiV1Error(400, "invalid_request", "id is required.");
  }
  const session = await getUploadSessionForUser(id, auth.userId);
  if (!session) {
    return apiV1Error(404, "not_found", "Upload session not found.");
  }
  const multipart = await getBlobMultipartClientState(session);
  return apiV1Json({
    upload: {
      id: session.id,
      state: session.state,
      fileName: session.fileName,
      fileSize: session.fileSize,
      chunkSize: session.chunkSize,
      totalParts: session.totalParts,
      uploadedParts: session.uploadedParts,
      storageKey: session.storageKey,
      transport: multipart ? "vercel-blob" : "server",
      multipart: multipart ?? null,
      createdAt: session.createdAt,
    },
  });
});

export const OPTIONS = GET;
