export function sanitizeDownloadFileName(fileName: string): string {
  const sanitized = fileName
    .replace(/[/\\]/g, "-")
    .replace(/[\r\n]+/g, " ")
    .trim();
  return sanitized || "download";
}

export function ensureFileExtension(fileName: string, ext: string): string {
  const normalizedExt = ext.toLowerCase();
  return fileName.toLowerCase().endsWith(`.${normalizedExt}`)
    ? fileName
    : `${fileName}.${normalizedExt}`;
}

export function buildAttachmentDisposition(fileName: string): string {
  const safeFileName = sanitizeDownloadFileName(fileName);
  const asciiFallback = safeFileName
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`;
}

export function applyAttachmentDisposition(
  headers: Headers,
  fileName: string,
): Headers {
  headers.set("Content-Disposition", buildAttachmentDisposition(fileName));
  return headers;
}

export function resolveDownloadFileName(input: {
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
  return sanitizeDownloadFileName(
    ensureFileExtension(preferred, input.responseExt),
  );
}

export function downloadFileNameForMedia(input: {
  originalFileName?: string;
  baseName: string;
  ext: string;
}): string {
  return resolveDownloadFileName({
    requestedFileName: `${input.baseName}.${input.ext}`,
    preferredFileName: input.originalFileName,
    requestedSize: "original",
    responseExt: input.ext,
  });
}
