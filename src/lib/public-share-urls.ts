import type { MediaKind } from "@/lib/media-types";
import {
  getOrCreateNodeInstanceSettings,
  isNodeMode,
} from "@/lib/self-hosted-nodes";

export const buildPublicShareUrls = async (
  kind: MediaKind,
  code: string,
  ext: string,
): Promise<{ original: string; sm: string; lg: string }> => {
  let prefix = "/share";
  if (isNodeMode()) {
    const settings = await getOrCreateNodeInstanceSettings();
    if (!settings.nodeHash) {
      throw new Error(
        "Link this node to latex.gg before creating public shares.",
      );
    }
    prefix = `${settings.cloudBaseUrl}/share/${settings.nodeHash}`;
  }
  const base =
    kind === "note" ? `${prefix}/${code}` : `${prefix}/${code}.${ext}`;
  return {
    original: base,
    sm:
      kind === "note"
        ? base
        : `${prefix}/${code}-sm.${kind === "image" ? ext : "png"}`,
    lg:
      kind === "note"
        ? base
        : `${prefix}/${code}-lg.${kind === "image" ? ext : "png"}`,
  };
};

export const buildPublicAlbumShareUrl = async (
  code: string,
): Promise<string> => {
  if (!isNodeMode()) {
    return `/share/${code}`;
  }
  const settings = await getOrCreateNodeInstanceSettings();
  if (!settings.nodeHash) {
    throw new Error(
      "Link this node to latex.gg before creating public shares.",
    );
  }
  return `${settings.cloudBaseUrl}/share/${settings.nodeHash}/${code}`;
};
