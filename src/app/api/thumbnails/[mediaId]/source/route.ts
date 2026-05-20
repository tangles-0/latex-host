import type { NextRequest } from "next/server";
import { getBlobMediaWithOwnerById } from "@/lib/media-store";
import { contentTypeForExt } from "@/lib/media-types";
import { getMediaStream } from "@/lib/media-storage";
import { isWorkerIngestAuthorized } from "@/lib/preview-worker";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> },
): Promise<Response> {
  if (!isWorkerIngestAuthorized(request)) {
    console.error("Unauthorized request to /api/thumbnails/[mediaId]/source");
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { mediaId } = await params;
  const media = await getBlobMediaWithOwnerById(mediaId.trim());
  if (!media) {
    return Response.json({ error: "Media not found." }, { status: 404 });
  }

  const stream = await getMediaStream({
    kind: media.kind,
    baseName: media.baseName,
    ext: media.ext,
    size: "original",
    uploadedAt: new Date(media.uploadedAt),
  });

  return new Response(stream, {
    headers: {
      "Content-Type": media.mimeType || contentTypeForExt(media.ext),
      "Cache-Control": "no-store",
    },
  });
}
