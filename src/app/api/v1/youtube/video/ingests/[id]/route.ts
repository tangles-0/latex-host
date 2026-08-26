import {
  deleteYoutubeIngestForUser,
  getYoutubeIngestForUser,
} from "@/lib/youtube-ingests";
import { withApiV1ParamsRoute } from "@/lib/api-v1/handler";
import { apiV1Error, apiV1Json } from "@/lib/api-v1/errors";
import { toYoutubeIngestResource } from "@/lib/api-v1/youtube";

export const runtime = "nodejs";

export const GET = withApiV1ParamsRoute<{ id: string }>(
  async (_request, auth, context) => {
    const { id } = await context.params;
    const ingestId = id?.trim() ?? "";
    if (!ingestId) {
      return apiV1Error(400, "invalid_request", "id is required.");
    }
    const ingest = await getYoutubeIngestForUser(auth.userId, ingestId);
    if (!ingest || ingest.outputType !== "video") {
      return apiV1Error(404, "not_found", "YouTube video ingest not found.");
    }
    return apiV1Json({ ingest: toYoutubeIngestResource(ingest) });
  },
);

export const DELETE = withApiV1ParamsRoute<{ id: string }>(
  async (_request, auth, context) => {
    const { id } = await context.params;
    const ingestId = id?.trim() ?? "";
    if (!ingestId) {
      return apiV1Error(400, "invalid_request", "id is required.");
    }
    const existing = await getYoutubeIngestForUser(auth.userId, ingestId);
    if (!existing || existing.outputType !== "video") {
      return apiV1Error(404, "not_found", "YouTube video ingest not found.");
    }
    await deleteYoutubeIngestForUser(auth.userId, ingestId);
    return new Response(null, { status: 204 });
  },
);

export const OPTIONS = GET;
