import { listYoutubeIngestsForUser } from "@/lib/youtube-ingests";
import { withApiV1Route } from "@/lib/api-v1/handler";
import { apiV1Error, apiV1Json } from "@/lib/api-v1/errors";
import { createYoutubeVideoIngestBodySchema } from "@/lib/api-v1/schemas";
import {
  startYoutubeIngestForApi,
  toYoutubeIngestResource,
} from "@/lib/api-v1/youtube";

export const runtime = "nodejs";

export const GET = withApiV1Route(async (_request, auth) => {
  const ingests = await listYoutubeIngestsForUser(auth.userId);
  return apiV1Json({
    ingests: ingests
      .filter((ingest) => ingest.outputType === "video")
      .map(toYoutubeIngestResource),
  });
});

/**
 * Start a video ingest. Call POST /api/v1/youtube/video/metadata first and pass qualityId.
 * Body: { url, qualityId }
 */
export const POST = withApiV1Route(async (request, auth) => {
  const json = await request.json().catch(() => null);
  const parsed = createYoutubeVideoIngestBodySchema.safeParse(json);
  if (!parsed.success) {
    return apiV1Error(
      400,
      "invalid_request",
      "url and qualityId are required.",
      parsed.error.flatten(),
    );
  }

  const started = await startYoutubeIngestForApi({
    request,
    userId: auth.userId,
    youtubeUrl: parsed.data.url.trim(),
    outputType: "video",
    qualityId: parsed.data.qualityId.trim(),
  });
  if (!started.ok) {
    return started.response;
  }

  const resource = toYoutubeIngestResource(started.ingest);
  return apiV1Json(
    { ingest: resource },
    { status: 201, location: resource.links.self },
  );
});

export const OPTIONS = GET;
