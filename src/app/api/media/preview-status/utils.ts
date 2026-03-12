import { isBlobMediaKind, type BlobMediaKind } from "@/lib/media-types";

export function parsePreviewStatusKind(kind: string | null): BlobMediaKind | null {
  return isBlobMediaKind(kind) ? kind : null;
}
