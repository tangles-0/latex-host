import {
  ARCHIVE_EXTENSIONS,
  AUDIO_EXTENSIONS,
  isOfficeOrPdfDocument,
  isTextPreviewDocument,
  type MediaKind,
} from "@/lib/media-types";

export const GALLERY_FILE_TYPE_FILTERS = [
  "all",
  "image",
  "video",
  "text",
  "document",
  "audio",
  "archive",
  "binary",
] as const;

export type GalleryFileTypeFilter = (typeof GALLERY_FILE_TYPE_FILTERS)[number];
export type GalleryFileType = Exclude<GalleryFileTypeFilter, "all">;
export type GalleryShareFilter = "all" | "shared" | "private";
export type GallerySortKey = "newest" | "oldest" | "name" | "size";

export const GALLERY_FILE_TYPE_OPTIONS: {
  label: string;
  value: GalleryFileTypeFilter;
}[] = [
  { label: "all", value: "all" },
  { label: "imgs", value: "image" },
  { label: "vids", value: "video" },
  { label: "text", value: "text" },
  { label: "docs", value: "document" },
  { label: "audio", value: "audio" },
  { label: "zips", value: "archive" },
  { label: "bins", value: "binary" },
];

export const GALLERY_SHARE_FILTERS: GalleryShareFilter[] = [
  "all",
  "shared",
  "private",
];

export const GALLERY_SORT_OPTIONS: { label: string; value: GallerySortKey }[] = [
  { label: "newest first", value: "newest" },
  { label: "oldest first", value: "oldest" },
  { label: "name a→z", value: "name" },
  { label: "size ↓", value: "size" },
];

type GalleryFilterItem = {
  kind: MediaKind | string;
  ext: string;
  mimeType?: string;
  originalFileName?: string;
  baseName?: string;
  uploadedAt: string;
  sizeOriginal?: number;
  shared?: boolean;
};

function isArchiveMime(mimeType: string): boolean {
  return (
    mimeType.includes("zip") ||
    mimeType.includes("tar") ||
    mimeType.includes("gzip") ||
    mimeType.includes("compress") ||
    mimeType.includes("archive") ||
    mimeType.includes("x-7z") ||
    mimeType.includes("x-rar") ||
    mimeType.includes("x-bzip") ||
    mimeType.includes("x-xz") ||
    mimeType.includes("zstd") ||
    mimeType.includes("x-lzip") ||
    mimeType.includes("x-lzma")
  );
}

export function galleryFileTypeFor(item: {
  kind: MediaKind | string;
  ext: string;
  mimeType?: string;
}): GalleryFileType {
  if (item.kind === "image") {
    return "image";
  }
  if (item.kind === "video") {
    return "video";
  }
  if (item.kind === "note") {
    return "text";
  }

  const ext = item.ext.toLowerCase();
  const mimeType = (item.mimeType ?? "").toLowerCase();

  if (mimeType.startsWith("audio/") || AUDIO_EXTENSIONS.has(ext)) {
    return "audio";
  }
  if (ARCHIVE_EXTENSIONS.has(ext) || isArchiveMime(mimeType)) {
    return "archive";
  }

  if (item.kind === "document") {
    if (isOfficeOrPdfDocument(mimeType, ext)) {
      return "document";
    }
    if (isTextPreviewDocument(mimeType, ext) || mimeType.startsWith("text/")) {
      return "text";
    }
    return "document";
  }

  return "binary";
}

export function galleryItemSortName(item: {
  originalFileName?: string;
  baseName?: string;
  ext?: string;
}): string {
  if (item.originalFileName?.trim()) {
    return item.originalFileName;
  }
  if (item.baseName && item.ext) {
    return `${item.baseName}.${item.ext}`;
  }
  return item.baseName ?? "";
}

export function matchesGalleryFileType(
  item: { kind: MediaKind | string; ext: string; mimeType?: string },
  filter: GalleryFileTypeFilter,
): boolean {
  return filter === "all" || galleryFileTypeFor(item) === filter;
}

export function matchesGalleryShareFilter(
  item: { shared?: boolean },
  filter: GalleryShareFilter,
): boolean {
  if (filter === "shared") {
    return Boolean(item.shared);
  }
  if (filter === "private") {
    return !item.shared;
  }
  return true;
}

export function compareGalleryItems(
  left: GalleryFilterItem,
  right: GalleryFilterItem,
  sort: GallerySortKey,
): number {
  switch (sort) {
    case "oldest":
      return Date.parse(left.uploadedAt) - Date.parse(right.uploadedAt);
    case "name":
      return galleryItemSortName(left).localeCompare(
        galleryItemSortName(right),
        undefined,
        { sensitivity: "base" },
      );
    case "size":
      return (right.sizeOriginal ?? 0) - (left.sizeOriginal ?? 0);
    case "newest":
    default:
      return Date.parse(right.uploadedAt) - Date.parse(left.uploadedAt);
  }
}

export function applyGalleryFileFilters<T extends GalleryFilterItem>(
  items: T[],
  options: {
    typeFilter: GalleryFileTypeFilter;
    shareFilter: GalleryShareFilter;
    sort: GallerySortKey;
  },
): T[] {
  const next = items.filter(
    (item) =>
      matchesGalleryFileType(item, options.typeFilter) &&
      matchesGalleryShareFilter(item, options.shareFilter),
  );
  next.sort((left, right) => compareGalleryItems(left, right, options.sort));
  return next;
}
