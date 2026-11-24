import {
  ensureFileExtension,
  sanitizeDownloadFileName,
} from "@/lib/download-file-name";
import { splitFileName, type BlobMediaKind } from "@/lib/media-types";

export type FileSharePathSize = "original" | "sm" | "lg" | "x640" | "x512";

export type FileSharePathEntry = {
  path: string;
  size: FileSharePathSize;
};

const MAX_PUBLIC_FILE_NAME_LENGTH = 240;

export function normalizePublicShareFileName(input: {
  originalFileName?: string;
  baseName: string;
  ext: string;
}): string {
  const preferred =
    input.originalFileName?.trim() || `${input.baseName}.${input.ext}`;
  const fileName = ensureFileExtension(
    sanitizeDownloadFileName(preferred).normalize("NFC"),
    input.ext,
  );
  if (fileName.length > MAX_PUBLIC_FILE_NAME_LENGTH) {
    throw new Error(
      `File name must be ${MAX_PUBLIC_FILE_NAME_LENGTH} characters or fewer.`,
    );
  }
  return fileName;
}

export function buildFileSharePathEntries(
  kind: BlobMediaKind,
  fileName: string,
): FileSharePathEntry[] {
  const split = splitFileName(fileName);
  if (!split) {
    throw new Error("A file extension is required for filename sharing.");
  }
  const previewExt = kind === "image" ? split.ext : "png";
  const entries: FileSharePathEntry[] = [
    { path: fileName, size: "original" },
    { path: `${split.stem}-sm.${previewExt}`, size: "sm" },
    { path: `${split.stem}-lg.${previewExt}`, size: "lg" },
  ];
  if (kind === "image" && split.ext.toLowerCase() !== "svg") {
    entries.push(
      { path: `${split.stem}-640.${split.ext}`, size: "x640" },
      { path: `${split.stem}-512.${split.ext}`, size: "x512" },
    );
  }
  return entries;
}

export function buildFileShareUrls(
  prefix: string,
  kind: BlobMediaKind,
  fileName: string,
): { original: string; sm: string; lg: string; x512?: string } {
  const entries = buildFileSharePathEntries(kind, fileName);
  const bySize = new Map(entries.map((entry) => [entry.size, entry.path]));
  const url = (size: FileSharePathSize): string =>
    `${prefix}/${encodeURIComponent(bySize.get(size) ?? fileName)}`;
  return {
    original: url("original"),
    sm: url("sm"),
    lg: url("lg"),
    ...(bySize.has("x512") ? { x512: url("x512") } : {}),
  };
}
