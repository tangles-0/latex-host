import {
  del as blobDelete,
  head as blobHead,
  put as blobPut,
} from "@vercel/blob"

export const getPublicBlobToken = (): string => {
  const token = process.env.BLOB_PUBLIC_READ_WRITE_TOKEN?.trim()
  if (!token) {
    throw new Error("BLOB_PUBLIC_READ_WRITE_TOKEN is not set.")
  }
  return token
}

export const getPublicBlobStoreId = (): string =>
  process.env.BLOB_PUBLIC_STORE_ID?.trim() ?? ""

export const getPublicBlobWebhookPublicKey = (): string =>
  process.env.BLOB_PUBLIC_WEBHOOK_PUBLIC_KEY?.trim() ?? ""

export const isPublicBlobConfigured = (): boolean =>
  Boolean(process.env.BLOB_PUBLIC_READ_WRITE_TOKEN?.trim())

export const headPublicBlob = async (keyOrUrl: string) =>
  blobHead(keyOrUrl, { token: getPublicBlobToken() })

export const publicBlobUrlForKey = (key: string): string | undefined => {
  const storeId = getPublicBlobStoreId()
  const pathname = key.trim().replace(/^\/+/, "")
  if (!storeId || !pathname || pathname.startsWith("http://") || pathname.startsWith("https://")) {
    return undefined
  }
  return `https://${storeId}.public.blob.vercel-storage.com/${pathname}`
}

export const resolvePublicBlobLocator = (
  keyOrUrl: string,
  url?: string | null,
): string => {
  const candidates = [url, keyOrUrl]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
  for (const candidate of candidates) {
    if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
      return candidate
    }
  }
  for (const candidate of candidates) {
    const built = publicBlobUrlForKey(candidate)
    if (built) {
      return built
    }
  }
  return candidates[0] ?? keyOrUrl
}

export const putPublicBlob = async (
  key: string,
  body: Parameters<typeof blobPut>[1],
  options?: { contentType?: string },
) =>
  blobPut(key, body, {
    access: "public",
    token: getPublicBlobToken(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: options?.contentType,
  })

const isHttpUrl = (value: string): boolean =>
  value.startsWith("http://") || value.startsWith("https://")

const resolvePublicBlobFetchUrl = async (
  keyOrUrl: string,
  url?: string | null,
): Promise<string> => {
  const locator = resolvePublicBlobLocator(keyOrUrl, url)
  if (isHttpUrl(locator)) {
    return locator
  }
  const head = await headPublicBlob(locator)
  if (!head.url) {
    throw new Error("Public blob head did not return a URL.")
  }
  return head.url
}

export const getPublicBlob = async (
  keyOrUrl: string,
  options?: {
    useCache?: boolean
    headers?: Record<string, string>
    url?: string | null
  },
) => {
  // Public CDN rejects the ?cache=0 query that @vercel/blob get() adds for
  // useCache: false. Fetch the public URL directly and ignore that flag.
  void options?.useCache
  const fetchUrl = await resolvePublicBlobFetchUrl(keyOrUrl, options?.url)
  const response = await fetch(fetchUrl, {
    headers: options?.headers,
  })
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(
      `Failed to fetch public blob: ${response.status} ${response.statusText}`,
    )
  }
  if (!response.body) {
    throw new Error("Public blob response body is null.")
  }
  return {
    statusCode: response.status,
    stream: response.body,
    blob: { url: fetchUrl },
  }
}

export const deletePublicBlob = async (urlOrKey: string): Promise<void> => {
  if (!urlOrKey.trim()) {
    return
  }
  await blobDelete(urlOrKey, { token: getPublicBlobToken() })
}

export const isPublicStoreMedia = (media: {
  publicStore?: boolean
  publicBlobKey?: string | null
  publicBlobUrl?: string | null
}): boolean =>
  Boolean(
    media.publicStore ||
      media.publicBlobKey?.trim() ||
      media.publicBlobUrl?.trim(),
  )

export const PUBLIC_STORE_SHARE_LOCKED_MESSAGE =
  "Public-store uploads stay public and cannot have their share link removed."

export const canDisableMediaShare = (media: {
  publicStore?: boolean
  publicBlobKey?: string | null
  publicBlobUrl?: string | null
}): boolean => !isPublicStoreMedia(media)
