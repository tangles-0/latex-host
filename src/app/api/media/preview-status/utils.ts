import type { MediaKind } from "@/lib/media-store";

export function parsePreviewStatusKind(kind: string | null): MediaKind | null {
  if (kind === "image" || kind === "video" || kind === "document" || kind === "other") {
    return kind;
  }
  return null;
}
