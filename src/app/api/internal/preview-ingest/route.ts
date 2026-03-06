import { NextResponse } from "next/server";
import { getMediaWithOwner, updateMediaPreviewForUser } from "@/lib/media-store";
import { storeGeneratedPreviewForMedia } from "@/lib/media-storage";
import { isAsyncPreviewKind, isWorkerIngestAuthorized } from "@/lib/preview-worker";

export const runtime = "nodejs";

type PreviewIngestPayload = {
  kind?: string;
  mediaId?: string;
  previewBase64?: string;
  error?: string;
};

function decodeBase64Image(input: string): Buffer {
  const value = input.trim();
  const withoutDataPrefix = value.startsWith("data:") ? value.slice(value.indexOf(",") + 1) : value;
  return Buffer.from(withoutDataPrefix, "base64");
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isWorkerIngestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json()) as PreviewIngestPayload;
  const kindValue = payload.kind?.trim() ?? "";
  const mediaId = payload.mediaId?.trim() ?? "";
  if (!mediaId || !isAsyncPreviewKind(kindValue)) {
    return NextResponse.json({ error: "kind and mediaId are required." }, { status: 400 });
  }

  const media = await getMediaWithOwner(kindValue, mediaId);
  if (!media) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }

  if (payload.error?.trim()) {
    const updated = await updateMediaPreviewForUser({
      userId: media.userId,
      kind: kindValue,
      mediaId,
      previewStatus: "failed",
      previewError: payload.error.trim().slice(0, 500),
    });
    return NextResponse.json({ ok: true, previewStatus: updated?.previewStatus ?? "failed" });
  }

  const previewBase64 = payload.previewBase64?.trim() ?? "";
  if (!previewBase64) {
    return NextResponse.json({ error: "previewBase64 is required when error is not provided." }, { status: 400 });
  }

  try {
    const generated = await storeGeneratedPreviewForMedia({
      kind: kindValue,
      baseName: media.baseName,
      uploadedAt: new Date(media.uploadedAt),
      previewImageBuffer: decodeBase64Image(previewBase64),
    });
    const updated = await updateMediaPreviewForUser({
      userId: media.userId,
      kind: kindValue,
      mediaId,
      previewStatus: "ready",
      previewError: null,
      sizeSm: generated.sizeSm,
      sizeLg: generated.sizeLg,
      width: generated.width,
      height: generated.height,
    });
    return NextResponse.json({ ok: true, previewStatus: updated?.previewStatus ?? "ready" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to ingest preview.";
    await updateMediaPreviewForUser({
      userId: media.userId,
      kind: kindValue,
      mediaId,
      previewStatus: "failed",
      previewError: message.slice(0, 500),
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
