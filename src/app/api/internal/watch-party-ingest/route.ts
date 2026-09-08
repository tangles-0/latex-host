import { NextResponse } from "next/server"
import { z } from "zod"

import { isWorkerIngestAuthorized } from "@/lib/preview-worker"
import { markWatchPartyEncodeComplete, markWatchPartyEncodeFailed } from "@/lib/watch-parties"
import { WATCH_PARTY_ENCODE_PROFILE } from "@/lib/watch-party-storage"

export const runtime = "nodejs"

const ingestSchema = z.object({
  videoId: z.string().trim().min(1),
  profile: z.string().trim().min(1).optional(),
  publicBlobKey: z.string().trim().min(1).optional(),
  publicBlobUrl: z.string().url().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  error: z.string().trim().min(1).optional()
})

export async function POST(request: Request): Promise<NextResponse> {
  if (!isWorkerIngestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const parsed = ingestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid watch party ingest payload." }, { status: 400 })
  }

  const payload = parsed.data
  if (payload.error) {
    await markWatchPartyEncodeFailed({
      videoId: payload.videoId,
      error: payload.error
    })
    return NextResponse.json({ ok: true, status: "error" })
  }

  if (!payload.publicBlobKey || !payload.publicBlobUrl || payload.sizeBytes === undefined) {
    return NextResponse.json(
      { error: "publicBlobKey, publicBlobUrl, and sizeBytes are required." },
      { status: 400 },
    )
  }

  await markWatchPartyEncodeComplete({
    videoId: payload.videoId,
    profile: payload.profile ?? WATCH_PARTY_ENCODE_PROFILE,
    publicBlobKey: payload.publicBlobKey,
    publicBlobUrl: payload.publicBlobUrl,
    sizeBytes: payload.sizeBytes
  })
  return NextResponse.json({ ok: true, status: "ready" })
}
