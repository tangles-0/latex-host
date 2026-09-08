import { NextResponse } from "next/server"
import { z } from "zod"

import { getSessionUserId } from "@/lib/auth"
import {
  buildWatchPartyPublicView,
  getWatchPartyByHash,
  normalizeWatchPartyTitle,
  updateWatchPartyTitleForUser,
  WATCH_PARTY_TITLE_MAX
} from "@/lib/watch-parties"

export const runtime = "nodejs"

const titleSchema = z.object({
  title: z.string().max(WATCH_PARTY_TITLE_MAX)
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hash: string }> },
): Promise<NextResponse> {
  const { hash } = await params
  const party = await getWatchPartyByHash(hash.trim())
  if (!party || party.status === "ended") {
    return NextResponse.json({ error: "Watch party not found." }, { status: 404 })
  }

  const viewerUserId = await getSessionUserId()
  return NextResponse.json({
    party: await buildWatchPartyPublicView({ party, viewerUserId })
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hash: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { hash } = await params
  const parsed = titleSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success || !normalizeWatchPartyTitle(parsed.data.title)) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 })
  }

  try {
    const party = await updateWatchPartyTitleForUser({
      hash: hash.trim(),
      userId,
      title: parsed.data.title
    })
    if (!party) {
      return NextResponse.json({ error: "Watch party not found." }, { status: 404 })
    }
    return NextResponse.json({
      party: await buildWatchPartyPublicView({ party, viewerUserId: userId })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update title."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
