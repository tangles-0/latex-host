export type PartyCommandType = "play" | "pause" | "seek" | "state"

export type PartyCommand = {
  v: 1
  type: PartyCommandType
  positionMs: number
  rate: number
  hostTime: number
  seq: number
}

export const presenceSocketUrl = (
  presenceUrl: string,
  hash: string,
  input?: { isHost?: boolean; hostToken?: string | null },
): string => {
  const url = new URL(presenceUrl)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = `/rooms/${encodeURIComponent(hash)}`
  url.search = ""
  if (input?.isHost && input.hostToken) {
    url.searchParams.set("role", "host")
    url.searchParams.set("token", input.hostToken)
  } else {
    url.searchParams.set("role", "watcher")
  }
  return url.toString()
}

export const expectedPositionMs = (command: PartyCommand, now = Date.now()): number => {
  if (command.type === "pause") {
    return command.positionMs
  }
  return command.positionMs + (now - command.hostTime) * command.rate
}
