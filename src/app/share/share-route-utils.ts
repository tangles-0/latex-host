export type ParsedShareFileName = {
  code: string;
  size: "original" | "sm" | "lg" | "x640";
  ext: string;
};

export function parseShareFileName(fileName: string): ParsedShareFileName | null {
  const match = /^([A-Za-z0-9]+)(-sm|-lg|-640)?\.([a-zA-Z0-9]+)$/.exec(fileName);
  if (!match) {
    return null;
  }

  const suffix = match[2];
  const size =
    suffix === "-sm" ? "sm" : suffix === "-lg" ? "lg" : suffix === "-640" ? "x640" : "original";

  return { code: match[1], size, ext: match[3].toLowerCase() };
}

export function parseByteRange(rangeHeader: string, total: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }

  const startRaw = match[1];
  const endRaw = match[2];
  if (!startRaw && !endRaw) {
    return null;
  }

  if (!startRaw && endRaw) {
    const suffixLength = Number(endRaw);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }
    const length = Math.min(total, suffixLength);
    return { start: total - length, end: total - 1 };
  }

  const start = Number(startRaw);
  let end = endRaw ? Number(endRaw) : total - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= total) {
    return null;
  }

  end = Math.min(end, total - 1);
  return { start, end };
}
