import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getImageBuffer } from "@/lib/storage";
import { getImageForUser } from "@/lib/metadata-store";

export const runtime = "nodejs";
const PRIVATE_MEDIA_CACHE_SECONDS = Math.max(
  60,
  Number.parseInt(process.env.PRIVATE_MEDIA_CACHE_SECONDS ?? "300", 10) || 300,
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
  baseName: string;
  size: "original" | "sm" | "lg" | "x640";
  ext: string;
} | null {
  const match = /^(.*?)(-sm|-lg|-640)?\.([a-zA-Z0-9]+)$/.exec(fileName);
  if (!match) {
    return null;
  }
  const suffix = match[2];
  const size =
    suffix === "-sm" ? "sm" : suffix === "-lg" ? "lg" : suffix === "-640" ? "x640" : "original";
  return { baseName: match[1], size, ext: match[3].toLowerCase() };
}

function sizeBytesForVariant(
  image: { sizeOriginal: number; sizeSm: number; sizeLg: number },
  size: "original" | "sm" | "lg" | "x640",
): number {
  if (size === "original") {
    return image.sizeOriginal;
  }
  if (size === "sm") {
    return image.sizeSm;
  }
  return image.sizeLg;
}

function buildVariantEtag(input: {
  imageId: string;
  uploadedAt: string;
  size: "original" | "sm" | "lg" | "x640";
  sizeBytes: number;
}): string {
  return `W/"i:${input.imageId}:${input.size}:${input.uploadedAt}:${input.sizeBytes}"`;
}

function requestHasEtag(request: NextRequest, etag: string): boolean {
  const header = request.headers.get("if-none-match");
  if (!header) {
    return false;
  }
  return header
    .split(",")
    .map((value) => value.trim())
    .some((value) => value === "*" || value === etag);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string; fileName: string }> },
): Promise<Response> {
  const { imageId, fileName } = await params;
  const parsed = parseFileName(fileName);
  if (!parsed) {
    return new Response("Not found", { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const image = await getImageForUser(imageId, userId);
  if (!image) {
    return new Response("Not found", { status: 404 });
  }

  if (parsed.baseName !== image.baseName || parsed.ext !== image.ext) {
    return new Response("Not found", { status: 404 });
  }

  const sizeBytes = sizeBytesForVariant(image, parsed.size);
  const etag = buildVariantEtag({
    imageId: image.id,
    uploadedAt: image.uploadedAt,
    size: parsed.size,
    sizeBytes,
  });
  const cacheHeaders = {
    "Cache-Control": `private, max-age=${PRIVATE_MEDIA_CACHE_SECONDS}, stale-while-revalidate=60`,
    ETag: etag,
    "Last-Modified": new Date(image.uploadedAt).toUTCString(),
    Vary: "Cookie, Authorization, Accept-Encoding",
  };
  if (requestHasEtag(request, etag)) {
    return new Response(null, {
      status: 304,
      headers: cacheHeaders,
    });
  }

  try {
    const data = await getImageBuffer(
      image.baseName,
      image.ext,
      parsed.size,
      new Date(image.uploadedAt),
    );
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentTypeForExt(image.ext),
        ...cacheHeaders,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

