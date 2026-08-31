import { isEditableTextDocument } from "@/lib/media-types";
import type { MediaKind } from "@/lib/media-types";

export type AlbumShareMediaItem = {
  id: string;
  kind: MediaKind;
  baseName: string;
  originalFileName?: string;
  ext: string;
  mimeType: string;
  previewStatus?: "pending" | "started" | "complete" | "error";
  content?: string;
};

export const albumShareMediaUrls = (
  shareId: string,
  item: AlbumShareMediaItem,
) => {
  const previewExt = item.kind === "image" ? item.ext : "png";
  return {
    fullUrl: `/share/album/${shareId}/media/${item.kind}/${item.id}/${item.baseName}.${item.ext}`,
    previewUrl: `/share/album/${shareId}/media/${item.kind}/${item.id}/${item.baseName}-lg.${previewExt}`,
  };
};

export const isAlbumShareLightboxTextItem = (item: AlbumShareMediaItem) =>
  item.kind === "note" ||
  (item.kind === "document" && isEditableTextDocument(item.mimeType, item.ext));
