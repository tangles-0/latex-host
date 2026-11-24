const MAX_ALBUM_THUMBNAIL_URL_LENGTH = 2048;

export function parseAlbumThumbnailUrl(input: unknown): {
  url: string | null;
  error?: string;
} {
  if (input === null || input === "") {
    return { url: null };
  }
  if (typeof input !== "string") {
    return { url: null, error: "Thumbnail URL must be a URL." };
  }
  const value = input.trim();
  if (!value) {
    return { url: null };
  }
  if (value.length > MAX_ALBUM_THUMBNAIL_URL_LENGTH) {
    return { url: null, error: "Thumbnail URL is too long." };
  }
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password
    ) {
      return { url: null, error: "Thumbnail URL must use HTTP or HTTPS." };
    }
    return { url: url.toString() };
  } catch {
    return { url: null, error: "Thumbnail URL is invalid." };
  }
}
