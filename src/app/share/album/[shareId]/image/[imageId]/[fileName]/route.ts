import type { NextRequest } from "next/server";
import { getAlbumShareById, getImage } from "@/lib/metadata-store";
import { getMediaSignedUrl, getMediaStream, usesS3StorageBackend } from "@/lib/media-storage";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";
import { unavailableImageResponse } from "@/lib/unavailable-image";

export const runtime = "nodejs";
const PUBLIC_SHARE_CACHE_SECONDS = Math.max(
  5,
  Number.parseInt(process.env.PUBLIC_SHARE_CACHE_SECONDS ?? "15", 10) || 15,
);

function contentTypeForExt(ext: string): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
}

function parseFileName(fileName: string): {
  size: "original" | "sm" | "lg" | "x640";
  ext: string;
} | null {
  const match = /^(original|sm|lg|x640)\.([a-zA-Z0-9]+)$/.exec(fileName);
  if (!match) {
    return null;
  }
  const size = match[1] as "original" | "sm" | "lg" | "x640";
  return { size, ext: match[2].toLowerCase() };
}

function publicCacheHeaders(ext: string): Headers {
  return new Headers({
    "Content-Type": contentTypeForExt(ext),
    "Cache-Control": `public, max-age=${PUBLIC_SHARE_CACHE_SECONDS}, s-maxage=${PUBLIC_SHARE_CACHE_SECONDS}, stale-while-revalidate=${PUBLIC_SHARE_CACHE_SECONDS}, must-revalidate`,
    Vary: "Accept-Encoding",
  });
}

export async function GET(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ shareId: string; imageId: string; fileName: string }> },
): Promise<Response> {
  const { shareId, imageId, fileName } = await params;
  const rate = await consumeRequestRateLimit({
    namespace: "public-share-album-image",
    key: `${shareId}:${imageId}`,
    limit: Number(process.env.PUBLIC_SHARE_RATE_LIMIT_PER_MINUTE ?? 240),
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return new Response("Too many requests.", {
      status: 429,
      headers: {
        "Retry-After": String(rate.retryAfterSeconds),
      },
    });
  }
  const parsed = parseFileName(fileName);
  try {
    if (!parsed) {
      return unavailableImageResponse("png");
    }

    const share = await getAlbumShareById(shareId);
    if (!share) {
      return unavailableImageResponse(parsed.ext);
    }

    const image = await getImage(imageId);
    if (!image || image.albumId !== share.albumId) {
      return unavailableImageResponse(parsed.ext);
    }

    if (parsed.ext !== image.ext) {
      return unavailableImageResponse(parsed.ext);
    }

    if (usesS3StorageBackend()) {
      const signedUrl = await getMediaSignedUrl({
        kind: "image",
        baseName: image.baseName,
        ext: image.ext,
        size: parsed.size === "x640" ? "lg" : parsed.size,
        uploadedAt: new Date(image.uploadedAt),
        responseContentType: contentTypeForExt(image.ext),
      });
      return new Response(null, {
        status: 307,
        headers: {
          Location: signedUrl,
          "Cache-Control": "no-store",
        },
      });
    }
    const data = await getMediaStream({
      kind: "image",
      baseName: image.baseName,
      ext: image.ext,
      size: parsed.size === "x640" ? "lg" : parsed.size,
      uploadedAt: new Date(image.uploadedAt),
    });
    return new Response(data, {
      headers: publicCacheHeaders(image.ext),
    });
  } catch {
    return unavailableImageResponse(parsed?.ext ?? "png");
  }
}

