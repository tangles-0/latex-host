import { NextResponse } from "next/server"

import { getSessionUserId } from "@/lib/auth"
import { buildWatchPartyPublicView, getWatchPartyByHash } from "@/lib/watch-parties"

export const runtime = "nodejs"

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
