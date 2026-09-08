import { NextResponse } from "next/server"
import { z } from "zod"

import { getSessionUserId } from "@/lib/auth"
import { getMediaForUser } from "@/lib/media-store"
import { buildAppUrl, requestWatchPartyEncode } from "@/lib/preview-worker"
import { consumeRequestRateLimit } from "@/lib/request-rate-limit"
import {
  buildWatchPartyPublicView,
  createWatchPartyForUser,
  markWatchPartyEncodeFailed
} from "@/lib/watch-parties"
import { isPublicBlobConfigured } from "@/lib/watch-party-storage"

export const runtime = "nodejs"

const createSchema = z.object({
  videoId: z.string().trim().min(1)
})

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }
  if (!isPublicBlobConfigured()) {
    return NextResponse.json(
      { error: "Public blob store is not configured." },
      { status: 503 },
    )
  }

  const rate = await consumeRequestRateLimit({
    namespace: "watch-party-create",
    key: userId,
    limit: 10,
    windowSeconds: 60
  })
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many watch party requests." }, { status: 429 })
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "videoId is required." }, { status: 400 })
  }

  const media = await getMediaForUser("video", parsed.data.videoId, userId)
  if (!media) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 })
  }

  try {
    const { party, shouldEnqueueEncode } = await createWatchPartyForUser({
      userId,
      videoId: media.id
    })

    if (shouldEnqueueEncode) {
      const encode = await requestWatchPartyEncode({
        videoId: media.id,
        downloadUrl: buildAppUrl(request, `/api/thumbnails/${media.id}/source`),
        mimeType: media.mimeType,
        ext: media.ext,
        fileSizeBytes: media.sizeOriginal
      })
      if (!encode.ok) {
        await markWatchPartyEncodeFailed({
          videoId: media.id,
          error: encode.error
        })
        return NextResponse.json({ error: encode.error }, { status: 502 })
      }
    }

    return NextResponse.json({
      party: await buildWatchPartyPublicView({ party, viewerUserId: userId })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create watch party."
    const status = message === "Video not found." ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
