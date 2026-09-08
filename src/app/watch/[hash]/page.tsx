import { notFound } from "next/navigation"

import { WatchPartyPlayer } from "@/components/watch-party-player"
import { getSessionUserId } from "@/lib/auth"
import { buildWatchPartyPublicView, getWatchPartyByHash } from "@/lib/watch-parties"

export const dynamic = "force-dynamic"
export const revalidate = 0

const WatchPartyPage = async ({
  params
}: {
  params: Promise<{ hash: string }>
}) => {
  const { hash } = await params
  const party = await getWatchPartyByHash(hash.trim())
  if (!party || party.status === "ended") {
    notFound()
  }

  const viewerUserId = await getSessionUserId()
  const view = await buildWatchPartyPublicView({ party, viewerUserId })

  return <WatchPartyPlayer initialParty={view} />
}

export default WatchPartyPage
