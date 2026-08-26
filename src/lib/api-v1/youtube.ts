import {
  getGroupLimits,
  getMaxAllowedBytesForKind,
  getUserGroupInfo,
} from "@/lib/metadata-store";
import {
  createYoutubeIngestForUser,
  deleteYoutubeIngestForUser,
  type YoutubeIngestEntry,
  type YoutubeOutputType,
  type YoutubeQualityOption,
} from "@/lib/youtube-ingests";
import {
  buildAppUrl,
  requestYoutubeDownload,
  requestYoutubeMetadata,
  type YoutubeMetadataPayload,
} from "@/lib/preview-worker";
import { apiV1Error } from "@/lib/api-v1/errors";
import type { YoutubeIngestResource } from "@/lib/api-v1/schemas";
import { NextResponse } from "next/server";

export function toYoutubeIngestResource(
  ingest: YoutubeIngestEntry,
): YoutubeIngestResource {
  const kind = ingest.outputType === "audio" ? "audio" : "video";
  return {
    id: ingest.id,
    youtubeId: ingest.youtubeId,
    youtubeUrl: ingest.youtubeUrl,
    title: ingest.title,
    channelName: ingest.channelName ?? null,
    durationSeconds: ingest.durationSeconds ?? null,
    qualityLabel: ingest.qualityLabel ?? null,
    outputType: kind,
    status: ingest.status,
    progress: ingest.progress,
    error: ingest.error ?? null,
    mediaId: ingest.mediaId ?? null,
    createdAt: ingest.createdAt,
    updatedAt: ingest.updatedAt,
    links: {
      self: `/api/v1/youtube/${kind}/ingests/${ingest.id}`,
      media: ingest.mediaId ? `/api/v1/files/${ingest.mediaId}` : null,
    },
  };
}

export async function fetchYoutubeMetadataForUser(input: {
  userId: string;
  url: string;
}): Promise<
  | {
      ok: true;
      metadata: YoutubeMetadataPayload;
      maxVideoSizeBytes: number;
      maxAudioSizeBytes: number;
    }
  | { ok: false; response: NextResponse }
> {
  const [metadata, groupInfo] = await Promise.all([
    requestYoutubeMetadata(input.url),
    getUserGroupInfo(input.userId),
  ]);
  if (!metadata.ok) {
    return {
      ok: false,
      response: apiV1Error(502, "internal_error", metadata.error),
    };
  }
  const limits = await getGroupLimits(groupInfo.groupId);
  return {
    ok: true,
    metadata: metadata.metadata,
    maxVideoSizeBytes: getMaxAllowedBytesForKind(limits, "video"),
    maxAudioSizeBytes: getMaxAllowedBytesForKind(limits, "other"),
  };
}

function findQuality(
  qualities: YoutubeQualityOption[],
  qualityId: string,
): YoutubeQualityOption | undefined {
  return qualities.find((quality) => quality.id === qualityId);
}

export async function startYoutubeIngestForApi(input: {
  request: Request;
  userId: string;
  youtubeUrl: string;
  outputType: YoutubeOutputType;
  qualityId?: string;
}): Promise<
  | { ok: true; ingest: YoutubeIngestEntry }
  | { ok: false; response: NextResponse }
> {
  const resolved = await fetchYoutubeMetadataForUser({
    userId: input.userId,
    url: input.youtubeUrl,
  });
  if (!resolved.ok) {
    return resolved;
  }

  const { metadata, maxVideoSizeBytes, maxAudioSizeBytes } = resolved;
  const maxUploadSizeBytes =
    input.outputType === "audio" ? maxAudioSizeBytes : maxVideoSizeBytes;

  let qualityId = "";
  let qualityLabel =
    input.outputType === "audio" ? "MP3 (highest quality)" : "";
  let filesizeBytes = 0;

  if (input.outputType === "video") {
    qualityId = input.qualityId?.trim() ?? "";
    if (!qualityId) {
      return {
        ok: false,
        response: apiV1Error(
          400,
          "invalid_request",
          "qualityId is required. Call POST /api/v1/youtube/video/metadata first and choose a quality.",
        ),
      };
    }
    const quality = findQuality(metadata.qualities ?? [], qualityId);
    if (!quality) {
      return {
        ok: false,
        response: apiV1Error(
          400,
          "invalid_request",
          "qualityId was not found for this video. Refresh metadata and pick again.",
          { qualityId },
        ),
      };
    }
    qualityLabel = quality.label || qualityId;
    filesizeBytes = Number(quality.filesizeBytes ?? 0);
  }

  if (Number.isFinite(filesizeBytes) && filesizeBytes > maxUploadSizeBytes) {
    return {
      ok: false,
      response: apiV1Error(
        413,
        "payload_too_large",
        "Selected YouTube format exceeds your upload size limit.",
        { maxUploadSizeBytes, filesizeBytes },
      ),
    };
  }

  const ingest = await createYoutubeIngestForUser({
    userId: input.userId,
    youtubeId: metadata.youtubeId,
    youtubeUrl: input.youtubeUrl,
    title: metadata.title,
    channelName: metadata.channelName,
    durationSeconds: metadata.durationSeconds,
    qualityLabel,
    outputType: input.outputType,
  });

  const started = await requestYoutubeDownload({
    ingestId: ingest.id,
    userId: input.userId,
    youtubeId: metadata.youtubeId,
    outputType: input.outputType,
    ...(input.outputType === "video" ? { qualityId } : {}),
    statusUrl: buildAppUrl(input.request, `/api/youtube/ingests/${ingest.id}/status`),
    uploadInitUrl: buildAppUrl(input.request, "/api/uploads/init"),
    uploadPartUrl: buildAppUrl(input.request, "/api/uploads/part"),
    uploadCompleteUrl: buildAppUrl(input.request, "/api/uploads/complete"),
  });
  if (!started.ok) {
    await deleteYoutubeIngestForUser(input.userId, ingest.id);
    return {
      ok: false,
      response: apiV1Error(502, "internal_error", started.error),
    };
  }

  return { ok: true, ingest };
}
