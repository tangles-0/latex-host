import {
  isThumbnailServiceSupported,
  type AsyncPreviewKind,
  type BlobMediaKind,
} from "@/lib/media-types";
export { isAsyncPreviewKind } from "@/lib/media-types";

type PreviewRequestPayload = {
  mediaId: string;
  kind: AsyncPreviewKind;
  ext: string;
  mimeType: string;
  fileSizeBytes: number;
  downloadUrl: string;
  youtubeId?: string;
};

export type ThumbnailServiceContentType = "image" | "video" | "doc";

export type ThumbnailServiceRequestPayload = {
  mediaId: string;
  downloadUrl: string;
  contentType: ThumbnailServiceContentType;
  fileSizeBytes: number;
  mimeType: string;
  youtubeId?: string;
};

export type YoutubeMetadataPayload = {
  youtubeId: string;
  title: string;
  channelName?: string;
  durationSeconds?: number;
  qualities: Array<{
    id: string;
    label: string;
    height?: number;
    fps?: number;
    ext?: string;
    filesizeBytes?: number;
  }>;
};

function configuredWorkerWebhookUrl(): string {
  return process.env.THUMBNAIL_SERVICE_WEBHOOK_URL?.trim() || "";
}

function outgoingSecret(): string {
  return (
    process.env.THUMBNAIL_SERVICE_WEBHOOK_SECRET?.trim() ||
    process.env.LATEX_OUTGOING_API_SECRET_KEY?.trim() ||
    process.env.PREVIEW_WORKER_WEBHOOK_SECRET?.trim() ||
    ""
  );
}

function incomingSecret(): string {
  return (
    process.env.THUMBNAIL_SERVICE_INGEST_SECRET?.trim() ||
    process.env.LATEX_INCOMING_API_SECRET_KEY?.trim() ||
    process.env.PREVIEW_WORKER_INGEST_SECRET?.trim() ||
    ""
  );
}

function workerUrl(path: string): string {
  const base = configuredWorkerWebhookUrl();
  if (!base) {
    return "";
  }
  return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
}

export function thumbnailContentTypeForKind(
  kind: AsyncPreviewKind,
): ThumbnailServiceContentType {
  return kind === "document" ? "doc" : kind;
}

export function buildAppUrl(request: Request, path: string): string {
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (configured) {
    return new URL(path, configured).toString();
  }
  return new URL(path, request.url).toString();
}

export async function requestPreviewGeneration(
  payload: PreviewRequestPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (
    !isThumbnailServiceSupported({
      kind: payload.kind as BlobMediaKind,
      mimeType: payload.mimeType,
      ext: payload.ext,
      fileSizeBytes: payload.fileSizeBytes,
    })
  ) {
    return {
      ok: false,
      error: "Thumbnail service does not support this media type.",
    };
  }

  const webhookUrl = configuredWorkerWebhookUrl();
  if (!webhookUrl) {
    return {
      ok: false,
      error: "Thumbnail service webhook URL is not configured.",
    };
  }

  const webhookSecret = outgoingSecret();
  const workerPayload: ThumbnailServiceRequestPayload = {
    mediaId: payload.mediaId,
    downloadUrl: payload.downloadUrl,
    contentType: thumbnailContentTypeForKind(payload.kind),
    fileSizeBytes: payload.fileSizeBytes,
    mimeType: payload.mimeType,
    youtubeId: payload.youtubeId,
  };
  try {
    const response = await fetch(
      new URL(
        "thumbnail-jobs",
        webhookUrl.endsWith("/") ? webhookUrl : `${webhookUrl}/`,
      ),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(webhookSecret ? { Authorization: webhookSecret } : {}),
        },
        body: JSON.stringify(workerPayload),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        error: `Worker webhook failed with status ${response.status}.`,
      };
    }
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to reach worker webhook.";
    return { ok: false, error: message };
  }
}

export async function requestYoutubeMetadata(
  youtubeUrl: string,
): Promise<
  { ok: true; metadata: YoutubeMetadataPayload } | { ok: false; error: string }
> {
  const url = workerUrl("youtube/metadata");
  if (!url) {
    return {
      ok: false,
      error: "Thumbnail service webhook URL is not configured.",
    };
  }
  const webhookSecret = outgoingSecret();
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookSecret ? { Authorization: webhookSecret } : {}),
      },
      body: JSON.stringify({ url: youtubeUrl }),
      cache: "no-store",
    });
    const payload = (await response
      .json()
      .catch(() => ({}))) as Partial<YoutubeMetadataPayload> & {
      error?: string;
    };
    if (!response.ok) {
      return {
        ok: false,
        error:
          payload.error ??
          `YouTube metadata request failed with status ${response.status}.`,
      };
    }
    if (
      !payload.youtubeId ||
      !payload.title ||
      !Array.isArray(payload.qualities)
    ) {
      return { ok: false, error: "YouTube metadata response was invalid." };
    }
    return {
      ok: true,
      metadata: {
        youtubeId: payload.youtubeId,
        title: payload.title,
        channelName: payload.channelName,
        durationSeconds: payload.durationSeconds,
        qualities: payload.qualities,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to reach YouTube metadata worker.";
    return { ok: false, error: message };
  }
}

export async function requestYoutubeDownload(input: {
  ingestId: string;
  userId: string;
  youtubeId: string;
  qualityId: string;
  statusUrl: string;
  uploadInitUrl: string;
  uploadPartUrl: string;
  uploadCompleteUrl: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = workerUrl("youtube/download");
  if (!url) {
    return {
      ok: false,
      error: "Thumbnail service webhook URL is not configured.",
    };
  }
  const webhookSecret = outgoingSecret();
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookSecret ? { Authorization: webhookSecret } : {}),
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      return {
        ok: false,
        error:
          payload.error ??
          `YouTube download request failed with status ${response.status}.`,
      };
    }
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to reach YouTube download worker.";
    return { ok: false, error: message };
  }
}

export function isWorkerIngestAuthorized(request: Request): boolean {
  const configuredSecret = incomingSecret();
  if (!configuredSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization")?.trim();
  if (authHeader === configuredSecret) {
    return true;
  }
  if (authHeader === `Bearer ${configuredSecret}`) {
    return true;
  }

  const tokenHeader = request.headers.get("x-worker-ingest-token")?.trim();
  return tokenHeader === configuredSecret;
}
