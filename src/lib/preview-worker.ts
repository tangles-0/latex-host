import type { MediaKind } from "@/lib/media-store";

export type AsyncPreviewKind = Exclude<MediaKind, "image">;

type PreviewRequestPayload = {
  mediaId: string;
  kind: AsyncPreviewKind;
};

export function isAsyncPreviewKind(value: string): value is AsyncPreviewKind {
  return value === "video" || value === "document" || value === "other";
}

export async function requestPreviewGeneration(payload: PreviewRequestPayload): Promise<{ ok: true } | { ok: false; error: string }> {
  const webhookUrl = process.env.PREVIEW_WORKER_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return { ok: false, error: "PREVIEW_WORKER_WEBHOOK_URL is not configured." };
  }

  const webhookSecret = process.env.PREVIEW_WORKER_WEBHOOK_SECRET?.trim();
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookSecret ? { Authorization: `Bearer ${webhookSecret}` } : {}),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, error: `Worker webhook failed with status ${response.status}.` };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach worker webhook.";
    return { ok: false, error: message };
  }
}

export function isWorkerIngestAuthorized(request: Request): boolean {
  const configuredSecret = process.env.PREVIEW_WORKER_INGEST_SECRET?.trim();
  if (!configuredSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization")?.trim();
  if (authHeader === `Bearer ${configuredSecret}`) {
    return true;
  }

  const tokenHeader = request.headers.get("x-worker-ingest-token")?.trim();
  return tokenHeader === configuredSecret;
}
