import type { NextRequest } from "next/server";
import { getAlbumShareByCode, getAppSettings, getImage, getShareByCode } from "@/lib/metadata-store";
import {
  getMediaBufferSize,
  getMediaSignedUrl,
  getMediaRangeStream,
  getMediaStream,
  usesS3StorageBackend,
} from "@/lib/media-storage";
import {
  getNote,
  getShareByCode as getMediaShareByCode,
  getSharedMediaByCode,
  getSharedMediaByCodeAndExt,
} from "@/lib/media-store";
import { contentTypeForExt, isBlobMediaKind } from "@/lib/media-types";
import { consumeRequestRateLimit } from "@/lib/request-rate-limit";
import { unavailableImageResponse } from "@/lib/unavailable-image";
import { parseByteRange, parseShareFileName } from "@/app/share/share-route-utils";

export const runtime = "nodejs";
const PUBLIC_SHARE_CACHE_SECONDS = Math.max(
  5,
  Number.parseInt(process.env.PUBLIC_SHARE_CACHE_SECONDS ?? "15", 10) || 15,
);

function withPublicImageCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function getInternalAppOrigin(): string {
  const configured = process.env.INTERNAL_APP_ORIGIN?.trim();
  if (configured) {
    return configured;
  }
  return `${process.env.NEXTAUTH_URL ?? ""}`;
}

function publicCacheHeaders(ext: string): Headers {
  return new Headers({
    "Content-Type": contentTypeForExt(ext),
    "Cache-Control": `public, max-age=${PUBLIC_SHARE_CACHE_SECONDS}, s-maxage=${PUBLIC_SHARE_CACHE_SECONDS}, stale-while-revalidate=${PUBLIC_SHARE_CACHE_SECONDS}, must-revalidate`,
    Vary: "Accept-Encoding",
  });
}

function isDownloadRequested(request: NextRequest): boolean {
  return request.nextUrl.searchParams.get("download") === "true";
}

function sanitizeDownloadFileName(fileName: string): string {
  const sanitized = fileName.replace(/[/\\]/g, "-").replace(/[\r\n]+/g, " ").trim();
  return sanitized || "download";
}

function ensureFileExtension(fileName: string, ext: string): string {
  const normalizedExt = ext.toLowerCase();
  return fileName.toLowerCase().endsWith(`.${normalizedExt}`) ? fileName : `${fileName}.${normalizedExt}`;
}

function buildAttachmentDisposition(fileName: string): string {
  const safeFileName = sanitizeDownloadFileName(fileName);
  const asciiFallback = safeFileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`;
}

function applyAttachmentDisposition(headers: Headers, fileName: string): Headers {
  headers.set("Content-Disposition", buildAttachmentDisposition(fileName));
  return headers;
}

function resolveDownloadFileName(input: {
  requestedFileName: string;
  preferredFileName?: string;
  requestedSize: "original" | "sm" | "lg";
  responseExt: string;
}): string {
  if (input.requestedSize !== "original") {
    return sanitizeDownloadFileName(input.requestedFileName);
  }
  const preferred = input.preferredFileName?.trim();
  if (!preferred) {
    return sanitizeDownloadFileName(input.requestedFileName);
  }
  return sanitizeDownloadFileName(ensureFileExtension(preferred, input.responseExt));
}

function isDocumentNavigation(request: NextRequest): boolean {
  const destination = request.headers.get("sec-fetch-dest");
  const mode = request.headers.get("sec-fetch-mode");
  const accept = request.headers.get("accept") ?? "";
  return destination === "document" || mode === "navigate" || accept.includes("text/html");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function signedMediaViewerHtml(input: { src: string; mimeType: string; fileName: string }): string {
  const safeSrc = escapeHtml(input.src);
  const safeName = escapeHtml(input.fileName);
  const type = input.mimeType.toLowerCase();
  const body = type.startsWith("image/")
    ? `<img src="${safeSrc}" alt="${safeName}" style="max-width:100%;max-height:100%;object-fit:contain" />`
    : type.startsWith("video/")
      ? `<video controls autoplay style="max-width:100%;max-height:100%" src="${safeSrc}"></video>`
      : type.startsWith("audio/")
        ? `<audio controls autoplay style="width:min(720px,100%)" src="${safeSrc}"></audio>`
        : `<p><a href="${safeSrc}" rel="noopener noreferrer">Open file</a></p>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeName}</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0b0b0c;
        color: #e5e7eb;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        padding: 12px;
      }
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> },
): Promise<Response> {
  const { fileName } = await params;
  const parsed = parseShareFileName(fileName);
  const shareLookupKey = parsed?.code ?? fileName;
  const downloadRequested = isDownloadRequested(request);
  const shareRate = await consumeRequestRateLimit({
    namespace: "public-share",
    key: shareLookupKey,
    limit: Number(process.env.PUBLIC_SHARE_RATE_LIMIT_PER_MINUTE ?? 240),
    windowSeconds: 60,
  });
  if (!shareRate.allowed) {
    return withPublicImageCors(
      new Response("Too many requests.", {
        status: 429,
        headers: {
          "Retry-After": String(shareRate.retryAfterSeconds),
        },
      }),
    );
  }
  const allowHtmlNavigationMode = usesS3StorageBackend()
    ? (await getAppSettings()).shareHtmlNavigationEnabled
    : false;
  try {
    if (!parsed && /^[A-Za-z0-9]+$/.test(fileName)) {
      const albumShare = await getAlbumShareByCode(fileName);
      if (albumShare) {
        // Proxy internally so `/share/<code>` stays in the browser URL.
        const upstream = await fetch(new URL(`/share/internal-album/${albumShare.id}`, getInternalAppOrigin()), {
          headers: {
            accept: request.headers.get("accept") ?? "text/html,*/*",
          },
          cache: "no-store",
        });
        const headers = new Headers(upstream.headers);
        headers.delete("content-encoding");
        headers.delete("content-length");
        headers.delete("transfer-encoding");
        return new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers,
        });
      }
      const noteShare = await getMediaShareByCode("note", fileName);
      if (noteShare) {
        if (downloadRequested) {
          const note = await getNote(noteShare.mediaId);
          if (!note) {
            return withPublicImageCors(new Response("Not found", { status: 404 }));
          }
          const headers = new Headers({
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": "no-store",
          });
          applyAttachmentDisposition(
            headers,
            ensureFileExtension(note.originalFileName?.trim() || note.baseName, "md"),
          );
          return withPublicImageCors(new Response(note.content, { headers }));
        }
        const upstream = await fetch(new URL(`/share/internal-note/${noteShare.code ?? fileName}`, getInternalAppOrigin()), {
          headers: {
            accept: request.headers.get("accept") ?? "text/html,*/*",
          },
          cache: "no-store",
        });
        const headers = new Headers(upstream.headers);
        headers.delete("content-encoding");
        headers.delete("content-length");
        headers.delete("transfer-encoding");
        return new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers,
        });
      }
      return withPublicImageCors(new Response("Not found", { status: 404 }));
    }
    if (!parsed) {
      return withPublicImageCors(await unavailableImageResponse("png"));
    }

    const imageShare = await getShareByCode(parsed.code);
    if (imageShare) {
      const image = await getImage(imageShare.imageId);
      if (image && image.ext === parsed.ext) {
        const imageRequestedSize =
          image.ext.toLowerCase() === "svg" && parsed.size !== "original"
            ? "original"
            : parsed.size === "x640"
              ? "lg"
              : parsed.size;
        const imageDownloadFileName = resolveDownloadFileName({
          requestedFileName: fileName,
          requestedSize: imageRequestedSize,
          responseExt: image.ext,
        });
        if (usesS3StorageBackend() && !downloadRequested) {
          const responseExt = imageRequestedSize === "original" ? image.ext : "png";
          const mimeType = contentTypeForExt(responseExt);
          const signedUrl = await getMediaSignedUrl({
            kind: "image",
            baseName: image.baseName,
            ext: image.ext,
            size: imageRequestedSize,
            uploadedAt: new Date(image.uploadedAt),
            responseContentType: mimeType,
          });
          if (allowHtmlNavigationMode && isDocumentNavigation(request)) {
            const html = signedMediaViewerHtml({
              src: signedUrl,
              mimeType,
              fileName,
            });
            return withPublicImageCors(
              new Response(html, {
                headers: {
                  "Content-Type": "text/html; charset=utf-8",
                  "Cache-Control": "no-store",
                },
              }),
            );
          }
          return withPublicImageCors(
            new Response(null, {
              status: 307,
              headers: {
                Location: signedUrl,
                "Cache-Control": "no-store",
              },
            }),
          );
        }
        const stream = await getMediaStream({
          kind: "image",
          baseName: image.baseName,
          ext: image.ext,
          size: imageRequestedSize,
          uploadedAt: new Date(image.uploadedAt),
        });
        const headers = publicCacheHeaders(image.ext);
        if (downloadRequested) {
          applyAttachmentDisposition(headers, imageDownloadFileName);
        }
        return withPublicImageCors(new Response(stream, { headers }));
      }
    }

    let media = await getSharedMediaByCodeAndExt(parsed.code, parsed.ext);
    if (!media && parsed.size !== "original" && parsed.ext === "png") {
      media = await getSharedMediaByCode(parsed.code);
    }
    if (!media) {
      return withPublicImageCors(await unavailableImageResponse(parsed.ext));
    }
    if (!isBlobMediaKind(media.kind)) {
      return withPublicImageCors(new Response("Not found", { status: 404 }));
    }
    if (media.kind === "video" && media.previewStatus !== "ready" && parsed.size !== "original") {
      return withPublicImageCors(new Response("Not found", { status: 404 }));
    }
    const requestedSize =
      media.kind === "image" && media.ext.toLowerCase() === "svg" && parsed.size !== "original"
        ? "original"
        : parsed.size === "x640"
          ? "lg"
          : parsed.size;
    const responseExt =
      requestedSize === "original" ? media.ext : media.kind === "image" ? media.ext : "png";
    const downloadFileName = resolveDownloadFileName({
      requestedFileName: fileName,
      preferredFileName: media.originalFileName,
      requestedSize,
      responseExt,
    });
    const isRangeStreamableOriginal =
      requestedSize === "original" &&
      (media.kind === "video" ||
        (media.kind === "other" && (media.mimeType ?? "").toLowerCase().startsWith("audio/")));
    if (usesS3StorageBackend() && !downloadRequested) {
      const mimeType = contentTypeForExt(responseExt);
      const signedUrl = await getMediaSignedUrl({
        kind: media.kind,
        baseName: media.baseName,
        ext: media.ext,
        size: requestedSize,
        uploadedAt: new Date(media.uploadedAt),
        responseContentType: mimeType,
      });
      if (allowHtmlNavigationMode && isDocumentNavigation(request)) {
        const html = signedMediaViewerHtml({
          src: signedUrl,
          mimeType,
          fileName,
        });
        return withPublicImageCors(
          new Response(html, {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
            },
          }),
        );
      }
      return withPublicImageCors(
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
        kind: media.kind,
        baseName: media.baseName,
        ext: media.ext,
        size: "original",
        uploadedAt,
      });
      const rangeHeader = request.headers.get("range");
      if (rangeHeader) {
        const byteRange = parseByteRange(rangeHeader, total);
        if (!byteRange) {
          return withPublicImageCors(
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
          kind: media.kind,
          baseName: media.baseName,
          ext: media.ext,
          size: "original",
          uploadedAt,
          start: byteRange.start,
          end: byteRange.end,
        });
        const headers = publicCacheHeaders(media.ext);
        headers.set("Content-Range", `bytes ${byteRange.start}-${byteRange.end}/${total}`);
        headers.set("Content-Length", String(byteRange.end - byteRange.start + 1));
        headers.set("Accept-Ranges", "bytes");
        if (downloadRequested) {
          applyAttachmentDisposition(headers, downloadFileName);
        }
        return withPublicImageCors(new Response(stream, { status: 206, headers }));
      }
    }

    const stream = await getMediaStream({
      kind: media.kind,
      baseName: media.baseName,
      ext: media.ext,
      size: requestedSize,
      uploadedAt: new Date(media.uploadedAt),
    });
    const headers = publicCacheHeaders(responseExt);
    if (isRangeStreamableOriginal) {
      headers.set("Accept-Ranges", "bytes");
    }
    if (downloadRequested) {
      applyAttachmentDisposition(headers, downloadFileName);
    }
    return withPublicImageCors(new Response(stream, { headers }));
  } catch {
    if (!parsed) {
      return withPublicImageCors(new Response("Service temporarily unavailable.", { status: 503 }));
    }
    return withPublicImageCors(await unavailableImageResponse(parsed.ext));
  }
}

