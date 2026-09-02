import { getPublicAppOrigin } from "@/lib/device-auth";
import type { MediaEntry, MediaKind } from "@/lib/media-store";
import type { BlobMediaKind } from "@/lib/media-types";
import type {
  FileResource,
  NoteResource,
  Visibility,
} from "@/lib/api-v1/schemas";
import { getPublicSharePrefix } from "@/lib/public-share-urls";

export type ShareUrlSet = {
  original: string;
  sm: string;
  lg: string;
  x512?: string;
};

function includeConstrainedShareUrl(kind: MediaKind, ext: string): boolean {
  return kind === "image" && ext.toLowerCase() !== "svg";
}

export function buildSharePaths(
  kind: MediaKind,
  code: string,
  ext: string,
): ShareUrlSet {
  const base = kind === "note" ? `/share/${code}` : `/share/${code}.${ext}`;
  const paths: ShareUrlSet = {
    original: base,
    sm:
      kind === "note"
        ? base
        : `/share/${code}-sm.${kind === "image" ? ext : "png"}`,
    lg:
      kind === "note"
        ? base
        : `/share/${code}-lg.${kind === "image" ? ext : "png"}`,
  };
  if (includeConstrainedShareUrl(kind, ext)) {
    paths.x512 = `/share/${code}-512.${ext}`;
  }
  return paths;
}

export function absoluteUrl(origin: string, path: string): string {
  const base = origin.replace(/\/$/, "");
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

export function buildAbsoluteShareUrls(
  origin: string,
  kind: MediaKind,
  code: string,
  ext: string,
): ShareUrlSet {
  const paths = buildSharePaths(kind, code, ext);
  const urls: ShareUrlSet = {
    original: absoluteUrl(origin, paths.original),
    sm: absoluteUrl(origin, paths.sm),
    lg: absoluteUrl(origin, paths.lg),
  };
  if (paths.x512) {
    urls.x512 = absoluteUrl(origin, paths.x512);
  }
  return urls;
}

export function buildShareUrlsFromPrefix(
  sharePrefix: string,
  kind: MediaKind,
  code: string,
  ext: string,
): ShareUrlSet {
  const suffixes = buildSharePaths(kind, code, ext);
  const stripSharePrefix = (value: string): string =>
    value.startsWith("/share/") ? value.slice("/share".length) : value;
  const urls: ShareUrlSet = {
    original: `${sharePrefix}${stripSharePrefix(suffixes.original)}`,
    sm: `${sharePrefix}${stripSharePrefix(suffixes.sm)}`,
    lg: `${sharePrefix}${stripSharePrefix(suffixes.lg)}`,
  };
  if (suffixes.x512) {
    urls.x512 = `${sharePrefix}${stripSharePrefix(suffixes.x512)}`;
  }
  return urls;
}

export async function sharePrefixFromRequest(
  request: Request,
): Promise<string> {
  const prefix = await getPublicSharePrefix();
  return prefix.startsWith("http")
    ? prefix
    : absoluteUrl(getPublicAppOrigin(request), prefix);
}

export function originFromRequest(request: Request): string {
  return getPublicAppOrigin(request);
}

export function fileNameForMedia(media: MediaEntry): string {
  if (media.originalFileName?.trim()) {
    return media.originalFileName;
  }
  if (media.kind === "note") {
    return media.originalFileName ?? "Untitled note";
  }
  return `${media.baseName}.${media.ext}`;
}

export function toFileResource(input: {
  media: MediaEntry;
  sharePrefix: string;
  visibility: Visibility;
  shareCode?: string | null;
}): FileResource {
  const { media, sharePrefix, visibility, shareCode } = input;
  const kind = media.kind as BlobMediaKind;
  const shareUrls =
    visibility === "public" && shareCode
      ? buildShareUrlsFromPrefix(sharePrefix, kind, shareCode, media.ext)
      : null;
  return {
    id: media.id,
    kind,
    fileName: fileNameForMedia(media),
    mimeType: media.mimeType ?? "application/octet-stream",
    size: media.sizeOriginal,
    albumId: media.albumId ?? media.albumIds?.[0] ?? null,
    visibility,
    previewStatus: media.previewStatus,
    previewError: media.previewError ?? null,
    createdAt: media.uploadedAt,
    shareUrl: shareUrls?.original ?? null,
    shareUrls,
    links: {
      self: `/api/v1/files/${media.id}`,
      content: `/api/v1/files/${media.id}/content`,
    },
  };
}

export function toNoteResource(input: {
  note: MediaEntry;
  sharePrefix: string;
  visibility: Visibility;
  shareCode?: string | null;
  includeContent?: boolean;
}): NoteResource {
  const { note, sharePrefix, visibility, shareCode, includeContent } = input;
  const shareUrl =
    visibility === "public" && shareCode ? `${sharePrefix}/${shareCode}` : null;
  return {
    id: note.id,
    kind: "note",
    fileName: note.originalFileName ?? "Untitled note",
    ...(includeContent ? { content: note.content ?? "" } : {}),
    size: note.sizeOriginal,
    albumId: note.albumId ?? note.albumIds?.[0] ?? null,
    visibility,
    createdAt: note.uploadedAt,
    updatedAt: note.updatedAt,
    shareUrl,
    links: {
      self: `/api/v1/notes/${note.id}`,
    },
  };
}
