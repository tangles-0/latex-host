export const WATCH_PARTY_STATUSES = ["encoding", "ready", "ended", "error"] as const
export type WatchPartyStatus = (typeof WATCH_PARTY_STATUSES)[number]

export type WatchPartyPublicView = {
  hash: string
  roomId: string
  status: WatchPartyStatus
  title: string
  publicBlobUrl: string | null
  presenceUrl: string
  encodeError: string | null
  isHost: boolean
  hostToken: string | null
}
