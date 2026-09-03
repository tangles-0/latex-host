export const SHARE_LINK_FORMAT_STORAGE_KEY = "latex-share-link-format";
export const SHARE_LINK_FORMAT_CHANGE_EVENT = "latex-share-link-format-change";

export type ShareLinkFormat = "cloud" | "direct";

export type NodeShareContext = {
  cloudBaseUrl: string;
  nodeHash: string;
  publicHttpsUrl: string;
};

const absoluteUrl = (value: string, fallbackOrigin: string): URL | null => {
  try {
    return new URL(value, fallbackOrigin);
  } catch {
    return null;
  }
};

export const formatShareUrl = (
  value: string,
  format: ShareLinkFormat,
  node: NodeShareContext | null | undefined,
  fallbackOrigin: string,
): string => {
  const parsed = absoluteUrl(
    value,
    fallbackOrigin || node?.cloudBaseUrl || "http://localhost",
  );
  if (!parsed) {
    return value;
  }
  if (!node) {
    return parsed.toString();
  }

  const cloudOrigin = new URL(node.cloudBaseUrl).origin;
  const publicOrigin = new URL(node.publicHttpsUrl).origin;
  const cloudPrefix = `/share/${node.nodeHash}/`;
  const directPrefix = "/share/";

  if (
    format === "direct" &&
    parsed.origin === cloudOrigin &&
    parsed.pathname.startsWith(cloudPrefix)
  ) {
    const suffix = parsed.pathname.slice(cloudPrefix.length);
    return `${publicOrigin}${directPrefix}${suffix}${parsed.search}${parsed.hash}`;
  }

  if (
    format === "cloud" &&
    parsed.origin === publicOrigin &&
    parsed.pathname.startsWith(directPrefix)
  ) {
    const suffix = parsed.pathname.slice(directPrefix.length);
    return `${cloudOrigin}${cloudPrefix}${suffix}${parsed.search}${parsed.hash}`;
  }

  return parsed.toString();
};
