import { listYoutubeIngestsForUser } from "@/lib/youtube-ingests";
import { withApiV1Route } from "@/lib/api-v1/handler";
import { apiV1Error, apiV1Json } from "@/lib/api-v1/errors";
import { createYoutubeAudioIngestBodySchema } from "@/lib/api-v1/schemas";
import {
  startYoutubeIngestForApi,
  toYoutubeIngestResource,
} from "@/lib/api-v1/youtube";

export const runtime = "nodejs";

export const GET = withApiV1Route(async (_request, auth) => {
  const ingests = await listYoutubeIngestsForUser(auth.userId);
  return apiV1Json({
    ingests: ingests
      .filter((ingest) => ingest.outputType === "audio")
      .map(toYoutubeIngestResource),
  });
});

/**
 * Start an MP3 ingest from a YouTube URL only.
 * No metadata/quality step — highest-quality audio is selected automatically.
 * Body: { url }
 */
export const POST = withApiV1Route(async (request, auth) => {
  const json = await request.json().catch(() => null);
  const parsed = createYoutubeAudioIngestBodySchema.safeParse(json);
  if (!parsed.success) {
    return apiV1Error(
      400,
      "invalid_request",
      "url is required.",
      parsed.error.flatten(),
    );
  }

  const started = await startYoutubeIngestForApi({
    request,
    userId: auth.userId,
    youtubeUrl: parsed.data.url.trim(),
    outputType: "audio",
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
