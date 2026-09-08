import { NextResponse } from "next/server"
import { z } from "zod"

import { isWorkerIngestAuthorized } from "@/lib/preview-worker"
import { reportWatchPartyEncodeProgress } from "@/lib/watch-parties"
import { WATCH_PARTY_ENCODE_STEPS } from "@/lib/watch-party-types"

export const runtime = "nodejs"

const progressSchema = z.object({
  videoId: z.string().trim().min(1),
  step: z.enum(WATCH_PARTY_ENCODE_STEPS),
  percent: z.number().min(0).max(100)
})

export async function POST(request: Request): Promise<NextResponse> {
  if (!isWorkerIngestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const parsed = progressSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid watch party progress payload." }, { status: 400 })
  }

  await reportWatchPartyEncodeProgress(parsed.data)
  return NextResponse.json({ ok: true })
}
