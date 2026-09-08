import { NextResponse } from "next/server"

import { getSessionUserId } from "@/lib/auth"
import { buildWatchPartyPublicView, endWatchPartyForUser } from "@/lib/watch-parties"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ hash: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { hash } = await params
  const party = await endWatchPartyForUser({ hash: hash.trim(), userId })
  if (!party) {
    return NextResponse.json({ error: "Watch party not found." }, { status: 404 })
  }

  return NextResponse.json({
    party: await buildWatchPartyPublicView({ party, viewerUserId: userId })
  })
}
