"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { WatchPartyEncodeProgress } from "@/components/watch-party-encode-progress"
import {
  expectedPositionMs,
  presenceSocketUrl,
  type PartyCommand
} from "@/lib/watch-party-protocol"
import type { WatchPartyPublicView } from "@/lib/watch-party-types"

const DRIFT_THRESHOLD_MS = 400
const STATE_INTERVAL_MS = 2000
const STATUS_POLL_MS = 1000
const HOST_JOIN_RETRIES = 3

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00"
  }
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const remainder = total % 60
  return `${minutes}:${String(remainder).padStart(2, "0")}`
}

export const WatchPartyPlayer = ({
  initialParty
}: {
  initialParty: WatchPartyPublicView
}) => {
  const [party, setParty] = useState(initialParty)
  const [error, setError] = useState<string | null>(null)
  const [presenceStatus, setPresenceStatus] = useState<
    "idle" | "connecting" | "connected" | "failed"
  >("idle")
  const [presenceAttempt, setPresenceAttempt] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [positionSeconds, setPositionSeconds] = useState(0)
  const [durationSeconds, setDurationSeconds] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const seqRef = useRef(0)
  const isApplyingRemoteRef = useRef(false)
  const isPlayingRef = useRef(false)

  const refreshParty = useCallback(async () => {
    const response = await fetch(`/api/watch-parties/${encodeURIComponent(initialParty.hash)}`, {
      cache: "no-store"
    })
    const payload = (await response.json().catch(() => ({}))) as {
      party?: WatchPartyPublicView
      error?: string
    }
    if (!response.ok || !payload.party) {
      throw new Error(payload.error ?? "Watch party is unavailable.")
    }
    setParty(payload.party)
    return payload.party
  }, [initialParty.hash])

  useEffect(() => {
    if (party.status !== "encoding") {
      return
    }
    void refreshParty().catch(refreshError => {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh party.")
    })
    const interval = window.setInterval(() => {
      void refreshParty().catch(refreshError => {
        setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh party.")
      })
    }, STATUS_POLL_MS)
    return () => window.clearInterval(interval)
  }, [party.status, refreshParty])

  const sendCommand = useCallback(
    (type: PartyCommand["type"], positionMs: number) => {
      const socket = socketRef.current
      if (!party.isHost || !socket || socket.readyState !== WebSocket.OPEN) {
        return
      }
      seqRef.current += 1
      const command: PartyCommand = {
        v: 1,
        type,
        positionMs,
        rate: 1,
        hostTime: Date.now(),
        seq: seqRef.current
      }
      socket.send(JSON.stringify(command))
    },
    [party.isHost],
  )

  const applyRemoteCommand = useCallback((command: PartyCommand) => {
    const video = videoRef.current
    if (!video) {
      return
    }
    const expectedSeconds = expectedPositionMs(command) / 1000
    const driftMs = Math.abs(video.currentTime - expectedSeconds) * 1000
    isApplyingRemoteRef.current = true
    if (command.type === "seek" || driftMs > DRIFT_THRESHOLD_MS) {
      video.currentTime = Math.max(0, expectedSeconds)
    }
    if (command.type === "pause") {
      video.pause()
      isPlayingRef.current = false
      setIsPlaying(false)
    } else if (command.type === "play" || command.type === "state") {
      void video.play().catch(() => undefined)
      isPlayingRef.current = true
      setIsPlaying(true)
    }
    window.setTimeout(() => {
      isApplyingRemoteRef.current = false
    }, 50)
  }, [])

  useEffect(() => {
    if (party.status !== "ready" || !party.publicBlobUrl) {
      return
    }
    if (party.isHost && !party.hostToken) {
      setPresenceStatus("failed")
      return
    }
    const url = presenceSocketUrl(party.presenceUrl, party.roomId, {
      isHost: party.isHost,
      hostToken: party.hostToken
    })
    const socket = new WebSocket(url)
    socketRef.current = socket
    let didOpen = false
    let isCancelled = false
    let retryTimer: number | undefined
    setPresenceStatus("connecting")
    socket.addEventListener("open", () => {
      didOpen = true
      setPresenceStatus("connected")
    })
    socket.addEventListener("close", () => {
      if (isCancelled) {
        return
      }
      setPresenceStatus(didOpen ? "connecting" : "failed")
      if (didOpen || presenceAttempt < HOST_JOIN_RETRIES) {
        retryTimer = window.setTimeout(() => {
          setPresenceAttempt(current => current + 1)
        }, didOpen ? 1500 : 1000)
      }
    })
    socket.addEventListener("message", event => {
      try {
        applyRemoteCommand(JSON.parse(String(event.data)) as PartyCommand)
      } catch {
        setError("Received an invalid room command.")
      }
    })
    return () => {
      isCancelled = true
      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer)
      }
      socket.close()
      socketRef.current = null
    }
  }, [
    applyRemoteCommand,
    party.hostToken,
    party.isHost,
    party.presenceUrl,
    party.publicBlobUrl,
    party.roomId,
    party.status,
    presenceAttempt
  ])

  useEffect(() => {
    if (!party.isHost || !isPlaying) {
      return
    }
    const interval = window.setInterval(() => {
      const video = videoRef.current
      if (!video) {
        return
      }
      sendCommand("state", Math.floor(video.currentTime * 1000))
    }, STATE_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [isPlaying, party.isHost, sendCommand])

  const handleHostPlay = () => {
    const video = videoRef.current
    if (!video) {
      return
    }
    void video.play()
    isPlayingRef.current = true
    setIsPlaying(true)
    sendCommand("play", Math.floor(video.currentTime * 1000))
  }

  const handleHostPause = () => {
    const video = videoRef.current
    if (!video) {
      return
    }
    video.pause()
    isPlayingRef.current = false
    setIsPlaying(false)
    sendCommand("pause", Math.floor(video.currentTime * 1000))
  }

  const handleHostSeek = (nextSeconds: number) => {
    const video = videoRef.current
    if (!video) {
      return
    }
    video.currentTime = nextSeconds
    setPositionSeconds(nextSeconds)
    sendCommand("seek", Math.floor(nextSeconds * 1000))
    if (isPlayingRef.current) {
      sendCommand("play", Math.floor(nextSeconds * 1000))
    } else {
      sendCommand("pause", Math.floor(nextSeconds * 1000))
    }
  }

  const handleEndParty = async () => {
    const response = await fetch(`/api/watch-parties/${encodeURIComponent(party.hash)}/end`, {
      method: "POST"
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      setError(payload.error ?? "Unable to end watch party.")
      return
    }
    window.location.assign("/")
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">{party.title}</h1>
          <p className="text-xs text-neutral-500">
            Room {party.roomId}
            {presenceStatus === "connected"
              ? " · connected"
              : presenceStatus === "failed"
                ? party.isHost
                  ? " · host join failed"
                  : " · disconnected"
                : " · connecting"}
            {party.isHost ? " · host" : " · watcher"}
          </p>
        </div>
        {party.isHost ? (
          <button
            type="button"
            onClick={() => void handleEndParty()}
            className="rounded border border-neutral-200 px-3 py-1 text-xs"
          >
            End party
          </button>
        ) : null}
      </div>

      {party.status === "encoding" ? (
        <WatchPartyEncodeProgress
          step={party.encodeStep}
          percent={party.encodePercent}
        />
      ) : null}

      {presenceStatus === "failed" && party.status === "ready" ? (
        <div className="flex flex-wrap items-center gap-3 rounded border border-neutral-200 px-3 py-3 text-sm text-neutral-600">
          <p>{party.isHost ? "Could not join the room as host." : "Could not connect to the room."}</p>
          <button
            type="button"
            onClick={() => setPresenceAttempt(current => current + 1)}
            className="rounded border border-neutral-200 px-3 py-1 text-xs"
          >
            Retry
          </button>
        </div>
      ) : null}

      {party.status === "error" ? (
        <p className="text-sm text-red-600">{party.encodeError || "Unable to prepare this video."}</p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {party.status === "ready" && party.publicBlobUrl ? (
        <div className="space-y-3">
          <video
            ref={videoRef}
            src={party.publicBlobUrl}
            playsInline
            className="w-full rounded border border-neutral-200 bg-black"
            onTimeUpdate={event => setPositionSeconds(event.currentTarget.currentTime)}
            onDurationChange={event => setDurationSeconds(event.currentTarget.duration || 0)}
            onPlay={() => {
              if (party.isHost && !isApplyingRemoteRef.current) {
                handleHostPlay()
              }
            }}
            onPause={() => {
              if (party.isHost && !isApplyingRemoteRef.current) {
                handleHostPause()
              }
            }}
          />
          {party.isHost ? (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <button
                type="button"
                onClick={isPlaying ? handleHostPause : handleHostPlay}
                className="rounded bg-black px-3 py-1 text-white"
              >
                {isPlaying ? "Pause" : "Play"}
              </button>
              <span className="tabular-nums text-neutral-600">
                {formatTime(positionSeconds)} / {formatTime(durationSeconds)}
              </span>
              <input
                type="range"
                min={0}
                max={durationSeconds || 0}
                step={0.1}
                value={Number.isFinite(positionSeconds) ? positionSeconds : 0}
                onChange={event => handleHostSeek(Number(event.target.value))}
                className="min-w-48 flex-1"
                aria-label="Seek"
              />
            </div>
          ) : (
            <p className="text-xs text-neutral-500">Playback follows the host.</p>
          )}
        </div>
      ) : null}
    </main>
  )
}
