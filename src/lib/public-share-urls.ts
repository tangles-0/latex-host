import type { MediaKind } from "@/lib/media-types";
import {
  getOrCreateNodeInstanceSettings,
  isNodeMode,
} from "@/lib/self-hosted-nodes";
import type { NodeShareContext } from "@/lib/share-link-format";

export const getNodeShareContext =
  async (): Promise<NodeShareContext | null> => {
    if (!isNodeMode()) {
      return null;
    }
    const settings = await getOrCreateNodeInstanceSettings();
    if (!settings.nodeHash || !settings.publicHttpsUrl) {
      return null;
    }
    return {
      cloudBaseUrl: settings.cloudBaseUrl,
      nodeHash: settings.nodeHash,
      publicHttpsUrl: settings.publicHttpsUrl,
    };
  };

export const getPublicSharePrefix = async (): Promise<string> => {
  if (!isNodeMode()) {
    return "/share";
  }
  const settings = await getOrCreateNodeInstanceSettings();
  if (!settings.nodeHash) {
    throw new Error(
      "Link this node to latex.gg before creating public shares.",
    );
  }
  return `${settings.cloudBaseUrl}/share/${settings.nodeHash}`;
};

export const buildPublicShareUrls = async (
  kind: MediaKind,
  code: string,
  ext: string,
): Promise<{ original: string; sm: string; lg: string; x512?: string }> => {
  const prefix = await getPublicSharePrefix();
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
    ...(kind === "image" && ext.toLowerCase() !== "svg"
      ? { x512: `${prefix}/${code}-512.${ext}` }
      : {}),
  };
};

export const buildPublicAlbumShareUrl = async (
  code: string,
): Promise<string> => {
  return `${await getPublicSharePrefix()}/${code}`;
};
