import { del as blobDelete, put as blobPut } from "@vercel/blob"

export const WATCH_PARTY_ENCODE_PROFILE = "h264-aac-1080p-v1"

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

export const watchPartyObjectKey = (
  videoId: string,
  profile = WATCH_PARTY_ENCODE_PROFILE,
): string => `watch-parties/${videoId}/${profile}.mp4`

export const putWatchPartyMp4 = async (input: {
  videoId: string
  body: Parameters<typeof blobPut>[1]
  profile?: string
}): Promise<{ key: string; url: string }> => {
  const key = watchPartyObjectKey(input.videoId, input.profile)
  const result = await blobPut(key, input.body, {
    access: "public",
    token: getPublicBlobToken(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "video/mp4",
    multipart: true
  })
  return { key, url: result.url }
}

export const deleteWatchPartyObject = async (urlOrKey: string): Promise<void> => {
  if (!urlOrKey.trim()) {
    return
  }
  await blobDelete(urlOrKey, { token: getPublicBlobToken() })
}
