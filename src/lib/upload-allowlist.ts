type UploadTypeInput = {
  allowed: string[];
  mimeType?: string | null;
  ext?: string | null;
};

function normalizeExt(ext: string | null | undefined): string {
  return (ext ?? "").trim().toLowerCase().replace(/^\.+/, "");
}

function isExtensionEntry(entry: string): boolean {
  return entry.startsWith(".") || entry.startsWith("*.");
}

export function isAllowedUploadType({ allowed, mimeType, ext }: UploadTypeInput): boolean {
  if (allowed.length === 0) {
    return true;
  }

  const normalizedMime = (mimeType ?? "").trim().toLowerCase();
  const normalizedExt = normalizeExt(ext);

  return allowed.some(value => {
    const entry = value.trim().toLowerCase();
    if (!entry) {
      return false;
    }

    if (isExtensionEntry(entry)) {
      return normalizedExt === normalizeExt(entry.replace(/^\*\./, "."));
    }

    if (entry.includes("/")) {
      if (entry.endsWith("/*")) {
        return normalizedMime.startsWith(entry.replace("/*", "/"));
      }
      return normalizedMime === entry;
    }

    return normalizedExt === normalizeExt(entry);
  });
}
