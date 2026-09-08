import { NextResponse } from "next/server"
import { z } from "zod"

import { getWatchPartyByHash } from "@/lib/watch-parties"
import { verifyWatchPartyHostToken } from "@/lib/watch-party-tokens"

export const runtime = "nodejs"

const bodySchema = z.object({
  token: z.string().trim().min(1)
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ hash: string }> },
): Promise<NextResponse> {
  const { hash } = await params
  const party = await getWatchPartyByHash(hash.trim())
  if (!party || party.status === "ended") {
    return NextResponse.json({ error: "Watch party not found." }, { status: 404 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "token is required." }, { status: 400 })
  }

  const payload = verifyWatchPartyHostToken(parsed.data.token, party.hash)
  if (!payload) {
    return NextResponse.json({ error: "Invalid host token." }, { status: 401 })
  }

  return NextResponse.json({ ok: true, hash: party.hash })
}
