import type { NextRequest } from "next/server";
import { getAlbumShareById } from "@/lib/metadata-store";
import { getMedia, mediaIsInAlbum } from "@/lib/media-store";
import { contentTypeForExt, isBlobMediaKind, type BlobMediaKind } from "@/lib/media-types";
import {
  getMediaBufferSize,
  getMediaSignedUrl,
  getMediaRangeStream,
  getMediaStream,
  usesS3StorageBackend,
} from "@/lib/media-storage";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";
import { unavailableImageResponse } from "@/lib/unavailable-image";

export const runtime = "nodejs";
const PUBLIC_SHARE_CACHE_SECONDS = Math.max(
  5,
  Number.parseInt(process.env.PUBLIC_SHARE_CACHE_SECONDS ?? "15", 10) || 15,
);

function parseKind(kind: string): BlobMediaKind | null {
  return isBlobMediaKind(kind) ? kind : null;
}

function parseFileName(fileName: string): { baseName: string; size: "original" | "sm" | "lg"; ext: string } | null {
  const match = /^(.*?)(-sm|-lg)?\.([a-zA-Z0-9]+)$/.exec(fileName);
  if (!match) {
    return null;
  }
  const suffix = match[2];
  const size = suffix === "-sm" ? "sm" : suffix === "-lg" ? "lg" : "original";
  return { baseName: match[1], size, ext: match[3].toLowerCase() };
}

function parseByteRange(rangeHeader: string, total: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }
  const startRaw = match[1];
  const endRaw = match[2];
  if (!startRaw && !endRaw) {
    return null;
  }
  if (!startRaw && endRaw) {
    const suffixLength = Number(endRaw);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }
    const length = Math.min(total, suffixLength);
    return { start: total - length, end: total - 1 };
  }
  const start = Number(startRaw);
  let end = endRaw ? Number(endRaw) : total - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= total) {
    return null;
  }
  end = Math.min(end, total - 1);
  return { start, end };
}

function withPublicCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Range");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function publicCacheHeaders(ext: string): Headers {
  return new Headers({
    "Content-Type": contentTypeForExt(ext),
    "Cache-Control": `public, max-age=${PUBLIC_SHARE_CACHE_SECONDS}, s-maxage=${PUBLIC_SHARE_CACHE_SECONDS}, stale-while-revalidate=${PUBLIC_SHARE_CACHE_SECONDS}, must-revalidate`,
    Vary: "Accept-Encoding",
  });
}

export async function GET(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ shareId: string; kind: string; mediaId: string; fileName: string }> },
): Promise<Response> {
  const { shareId, kind, mediaId, fileName } = await params;
  const rate = await consumeRequestRateLimit({
    namespace: "public-share-album-media",
    key: `${shareId}:${mediaId}`,
    limit: Number(process.env.PUBLIC_SHARE_RATE_LIMIT_PER_MINUTE ?? 240),
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return withPublicCors(
      new Response("Too many requests.", {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds),
        },
      }),
    );
  }
  const parsedKind = parseKind(kind);
  const parsed = parseFileName(fileName);
  if (!parsedKind || !parsed) {
    return withPublicCors(await unavailableImageResponse("png"));
  }

  try {
    const share = await getAlbumShareById(shareId);
    if (!share) {
      return withPublicCors(await unavailableImageResponse(parsed.ext));
    }

    const media = await getMedia(parsedKind, mediaId);
    const inAlbum = media
      ? await mediaIsInAlbum(share.albumId, { id: mediaId, kind: parsedKind })
      : false;
    if (!media || !inAlbum || media.baseName !== parsed.baseName) {
      return withPublicCors(await unavailableImageResponse(parsed.ext));
    }

    if (parsedKind === "video" && media.previewStatus !== "ready" && parsed.size !== "original") {
      return withPublicCors(new Response("Not found", { status: 404 }));
    }

    const requestedSize =
      parsedKind === "image" && media.ext.toLowerCase() === "svg" && parsed.size !== "original"
        ? "original"
        : parsed.size;

    const isRangeStreamableOriginal =
      requestedSize === "original" &&
      (parsedKind === "video" ||
        (parsedKind === "other" && (media.mimeType ?? "").toLowerCase().startsWith("audio/")));
    if (usesS3StorageBackend()) {
      const responseExt =
        requestedSize === "original" ? media.ext : parsedKind === "image" ? media.ext : "png";
      const signedUrl = await getMediaSignedUrl({
        kind: parsedKind,
        baseName: media.baseName,
        ext: media.ext,
        size: requestedSize,
        uploadedAt: new Date(media.uploadedAt),
        responseContentType: contentTypeForExt(responseExt),
      });
      return withPublicCors(
        new Response(null, {
          status: 307,
          headers: {
            Location: signedUrl,
            "Cache-Control": "no-store",
          },
        }),
      );
    }

    if (isRangeStreamableOriginal) {
      const uploadedAt = new Date(media.uploadedAt);
      const total = await getMediaBufferSize({
        kind: parsedKind,
        baseName: media.baseName,
        ext: media.ext,
        size: requestedSize,
        uploadedAt,
      });
      const rangeHeader = request.headers.get("range");
      if (rangeHeader) {
        const byteRange = parseByteRange(rangeHeader, total);
        if (!byteRange) {
          return withPublicCors(
            new Response("Requested Range Not Satisfiable", {
              status: 416,
              headers: {
                "Content-Range": `bytes */${total}`,
                "Accept-Ranges": "bytes",
              },
            }),
          );
        }
        const stream = await getMediaRangeStream({
          kind: parsedKind,
          baseName: media.baseName,
          ext: media.ext,
          size: requestedSize,
          uploadedAt,
          start: byteRange.start,
          end: byteRange.end,
        });
        const headers = publicCacheHeaders(media.ext);
        headers.set("Content-Range", `bytes ${byteRange.start}-${byteRange.end}/${total}`);
        headers.set("Content-Length", String(byteRange.end - byteRange.start + 1));
        headers.set("Accept-Ranges", "bytes");
        return withPublicCors(new Response(stream, { status: 206, headers }));
      }
    }

    const stream = await getMediaStream({
      kind: parsedKind,
      baseName: media.baseName,
      ext: media.ext,
      size: requestedSize,
      uploadedAt: new Date(media.uploadedAt),
    });
    const responseExt =
      requestedSize === "original" ? media.ext : parsedKind === "image" ? media.ext : "png";
    const headers = publicCacheHeaders(responseExt);
    if (isRangeStreamableOriginal) {
      headers.set("Accept-Ranges", "bytes");
    }
    return withPublicCors(new Response(stream, { headers }));
  } catch {
    return withPublicCors(await unavailableImageResponse(parsed.ext));
  }
}
