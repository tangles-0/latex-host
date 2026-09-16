import {
  del as blobDelete,
  get as blobGet,
  head as blobHead,
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

export const getPublicBlob = async (
  keyOrUrl: string,
  options?: { useCache?: boolean; headers?: Record<string, string> },
) =>
  blobGet(keyOrUrl, {
    access: "public",
    token: getPublicBlobToken(),
    useCache: options?.useCache,
    headers: options?.headers,
  })

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
