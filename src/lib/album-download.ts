import type { MediaKind } from "@/lib/media-types";

export type AlbumDownloadMedia = {
  id: string;
  kind: MediaKind;
  baseName: string;
  ext: string;
};

export const albumMediaDownloadHref = (
  item: AlbumDownloadMedia,
  shareId?: string,
): string | null => {
  if (item.kind === "note") {
    return null;
  }
  if (shareId) {
    return `/share/album/${shareId}/media/${item.kind}/${item.id}/${item.baseName}.${item.ext}?download=true`;
  }
  return `/media/${item.kind}/${item.id}/${item.baseName}.${item.ext}?download=true`;
};

export const triggerBlobDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
