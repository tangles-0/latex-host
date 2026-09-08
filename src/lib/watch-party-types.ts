export const WATCH_PARTY_TITLE_MAX = 200

export const WATCH_PARTY_STATUSES = ["encoding", "ready", "ended", "error"] as const
export type WatchPartyStatus = (typeof WATCH_PARTY_STATUSES)[number]

export const WATCH_PARTY_ENCODE_STEPS = ["download", "transcode", "upload"] as const
export type WatchPartyEncodeStep = (typeof WATCH_PARTY_ENCODE_STEPS)[number]

export type WatchPartyPublicView = {
  hash: string
  roomId: string
  status: WatchPartyStatus
  title: string
  publicBlobUrl: string | null
  presenceUrl: string
  encodeError: string | null
  encodeStep: WatchPartyEncodeStep | null
  encodePercent: number
  isHost: boolean
  hostToken: string | null
}
