import { put as blobPut } from "@vercel/blob"
import {
  deletePublicBlob,
  getPublicBlobToken,
  getPublicBlobStoreId,
  getPublicBlobWebhookPublicKey,
  isPublicBlobConfigured,
} from "@/lib/public-blob"

export const WATCH_PARTY_ENCODE_PROFILE = "h264-aac-1080p-v1"

export {
  getPublicBlobToken,
  getPublicBlobStoreId,
  getPublicBlobWebhookPublicKey,
  isPublicBlobConfigured,
}

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
  await deletePublicBlob(urlOrKey)
}
