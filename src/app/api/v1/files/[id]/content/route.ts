import { NextResponse } from "next/server";
import { withApiV1ParamsRoute } from "@/lib/api-v1/handler";
import { apiV1Error } from "@/lib/api-v1/errors";
import { getBlobFileForUser } from "@/lib/api-v1/list";
import {
  contentTypeForExt,
  type BlobMediaKind,
} from "@/lib/media-types";
import {
  getMediaSignedUrl,
  getMediaStream,
  type MediaSize,
  usesS3StorageBackend,
} from "@/lib/media-storage";
import {
  applyAttachmentDisposition,
  resolveDownloadFileName,
} from "@/lib/download-file-name";

export const runtime = "nodejs";

export const GET = withApiV1ParamsRoute(async (request, auth, context) => {
  const params = await context.params;
  const id = params.id?.trim() ?? "";
  if (!id) {
    return apiV1Error(400, "invalid_request", "id is required.");
  }
  const media = await getBlobFileForUser(auth.userId, id);
  if (!media) {
    return apiV1Error(404, "not_found", "File not found.");
  }

  const url = new URL(request.url);
  const variantRaw = url.searchParams.get("variant")?.trim() || "original";
  if (variantRaw !== "original" && variantRaw !== "sm" && variantRaw !== "lg") {
    return apiV1Error(
      400,
      "invalid_request",
      "variant must be original, sm, or lg.",
    );
  }
  const size = variantRaw as MediaSize;
  if (size !== "original" && media.previewStatus !== "complete") {
    return apiV1Error(409, "conflict", "Preview is not ready yet.", {
      previewStatus: media.previewStatus,
    });
  }

  const kind = media.kind as BlobMediaKind;
  const ext =
    size === "original" ? media.ext : kind === "image" ? media.ext : "png";
  const contentType =
    size === "original"
      ? media.mimeType || contentTypeForExt(ext)
      : contentTypeForExt(ext);
  const downloadName = resolveDownloadFileName({
    requestedFileName: `${media.baseName}${size === "original" ? "" : `-${size}`}.${ext}`,
    preferredFileName: size === "original" ? media.originalFileName : undefined,
    requestedSize: size,
    responseExt: ext,
  });

  if (usesS3StorageBackend()) {
    try {
      const signed = await getMediaSignedUrl({
        kind,
        baseName: media.baseName,
        ext,
        size,
        uploadedAt: new Date(media.uploadedAt),
        responseContentType: contentType,
      });
      return NextResponse.redirect(signed, 302);
    } catch {
      // fall through to stream
    }
  }

  const stream = await getMediaStream({
    kind,
    baseName: media.baseName,
    ext,
    size,
    uploadedAt: new Date(media.uploadedAt),
  });

  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=60",
  });
  if (url.searchParams.get("download") === "true") {
    applyAttachmentDisposition(headers, downloadName);
  }

  return new NextResponse(stream, {
    status: 200,
    headers,
  });
});

export const OPTIONS = GET;
