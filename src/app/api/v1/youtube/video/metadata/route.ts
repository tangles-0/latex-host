import { withApiV1Route } from "@/lib/api-v1/handler";
import { apiV1Error, apiV1Json } from "@/lib/api-v1/errors";
import { youtubeUrlBodySchema } from "@/lib/api-v1/schemas";
import { fetchYoutubeMetadataForUser } from "@/lib/api-v1/youtube";

export const runtime = "nodejs";

/**
 * Step 1 for video imports: resolve a URL to metadata + quality options.
 * Then POST /api/v1/youtube/video/ingests with { url, qualityId }.
 */
export const POST = withApiV1Route(async (request, auth) => {
  const json = await request.json().catch(() => null);
  const parsed = youtubeUrlBodySchema.safeParse(json);
  if (!parsed.success) {
    return apiV1Error(
      400,
      "invalid_request",
      "url is required.",
      parsed.error.flatten(),
    );
  }

  const resolved = await fetchYoutubeMetadataForUser({
    userId: auth.userId,
    url: parsed.data.url.trim(),
  });
  if (!resolved.ok) {
    return resolved.response;
  }

  return apiV1Json({
    metadata: {
      youtubeId: resolved.metadata.youtubeId,
      title: resolved.metadata.title,
      channelName: resolved.metadata.channelName ?? null,
      durationSeconds: resolved.metadata.durationSeconds ?? null,
      qualities: resolved.metadata.qualities ?? [],
    },
    limits: {
      maxVideoSizeBytes: resolved.maxVideoSizeBytes,
    },
    next: {
      method: "POST",
      path: "/api/v1/youtube/video/ingests",
      body: { url: parsed.data.url.trim(), qualityId: "<id from metadata.qualities>" },
    },
  });
});

export const OPTIONS = POST;
