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
};

export type ThumbnailServiceContentType = "image" | "video" | "doc";

export type ThumbnailServiceRequestPayload = {
  mediaId: string;
  downloadUrl: string;
  contentType: ThumbnailServiceContentType;
  fileSizeBytes: number;
  mimeType: string;
};

function configuredWorkerWebhookUrl(): string {
  return (
    process.env.THUMBNAIL_SERVICE_WEBHOOK_URL?.trim() ||
    ""
  );
}

function outgoingSecret(): string {
  return (
    process.env.THUMBNAIL_SERVICE_WEBHOOK_SECRET?.trim() ||
    ""
  );
}

function incomingSecret(): string {
  return (
    process.env.THUMBNAIL_SERVICE_INGEST_SECRET?.trim() ||
    ""
  );
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
  };
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookSecret ? { Authorization: webhookSecret } : {}),
      },
      body: JSON.stringify(workerPayload),
      cache: "no-store",
    });
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
