"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { WatchPartyConnecting } from "@/components/watch-party-connecting"
import { WatchPartyEncodeProgress } from "@/components/watch-party-encode-progress"
import { WatchPartyJoin } from "@/components/watch-party-join"
import { WatchPartyTitle } from "@/components/watch-party-title"
import { WatchPartyVideoDownload } from "@/components/watch-party-video-download"
import { WatchPartyVolumeControls } from "@/components/watch-party-volume-controls"
import { PageScaffold } from "@/components/ui/page-scaffold"
import { TermButton } from "@/components/ui/term-button"
import {
  expectedPositionMs,
  PERIODIC_SYNC_INTERVAL_MS,
  presenceSocketUrl,
  shouldCorrectPosition,
  type PartyCommand
} from "@/lib/watch-party-protocol"
import type { WatchPartyPublicView } from "@/lib/watch-party-types"

const ENCODE_POLL_MS = 1000
const TITLE_POLL_MS = 5000
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

const readVideoDuration = (video: HTMLVideoElement): number => {
  const duration = video.duration
  return Number.isFinite(duration) && duration > 0 ? duration : 0
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
  const [hasJoined, setHasJoined] = useState(false)
  const [needsPlaybackUnlock, setNeedsPlaybackUnlock] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [positionSeconds, setPositionSeconds] = useState(0)
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const seqRef = useRef(0)
  const isPlayingRef = useRef(false)
  const lastCommandRef = useRef<PartyCommand | null>(null)
  const hasAppliedCommandRef = useRef(false)
  const volumeRef = useRef(volume)
  const isMutedRef = useRef(isMuted)
  volumeRef.current = volume
  isMutedRef.current = isMuted

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
    const nextParty = payload.party
    setParty(current => ({
      ...nextParty,
      hostToken: current.hostToken ?? nextParty.hostToken
    }))
    return nextParty
  }, [initialParty.hash])

  useEffect(() => {
    if (party.status === "ended") {
      return
    }
    const pollMs = party.status === "encoding" ? ENCODE_POLL_MS : TITLE_POLL_MS
    const refresh = () => {
      void refreshParty().catch(refreshError => {
        setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh party.")
      })
    }
    if (party.status === "encoding") {
      refresh()
    }
    const interval = window.setInterval(refresh, pollMs)
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
    if (party.isHost) {
      return
    }
    lastCommandRef.current = command
    const video = videoRef.current
    if (!video) {
      return
    }
    const expectedSeconds = expectedPositionMs(command) / 1000
    const driftMs = Math.abs(video.currentTime - expectedSeconds) * 1000
    const isInitial = !hasAppliedCommandRef.current
    hasAppliedCommandRef.current = true
    if (
      shouldCorrectPosition({
        commandType: command.type,
        driftMs,
        isInitial
      })
    ) {
      video.currentTime = Math.max(0, expectedSeconds)
    }
    if (command.type === "pause") {
      video.pause()
      isPlayingRef.current = false
      setIsPlaying(false)
      return
    }
    if (command.type === "play") {
      video.volume = volumeRef.current
      video.muted = isMutedRef.current
      void video
        .play()
        .then(() => setNeedsPlaybackUnlock(false))
        .catch(() => setNeedsPlaybackUnlock(true))
      isPlayingRef.current = true
      setIsPlaying(true)
    }
  }, [party.isHost])

  useEffect(() => {
    if (!hasJoined || party.status !== "ready") {
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
    let hasOpened = false
    let isCancelled = false
    let retryTimer: number | undefined
    setPresenceStatus("connecting")
    socket.addEventListener("open", () => {
      hasOpened = true
      setPresenceStatus("connected")
    })
    socket.addEventListener("close", () => {
      if (isCancelled) {
        return
      }
      setPresenceStatus(hasOpened ? "connecting" : "failed")
      if (hasOpened || presenceAttempt < HOST_JOIN_RETRIES) {
        retryTimer = window.setTimeout(() => {
          setPresenceAttempt(current => current + 1)
        }, hasOpened ? 1500 : 1000)
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
    party.roomId,
    party.status,
    presenceAttempt,
    hasJoined
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
    }, PERIODIC_SYNC_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [isPlaying, party.isHost, sendCommand])

  useEffect(() => {
    const video = videoRef.current
    if (!video) {
      return
    }
    video.volume = volume
    video.muted = isMuted
  }, [isMuted, volume, presenceStatus])

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

  const handleSaveTitle = async (title: string) => {
    const response = await fetch(`/api/watch-parties/${encodeURIComponent(party.hash)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title })
    })
    const payload = (await response.json().catch(() => ({}))) as {
      party?: WatchPartyPublicView
      error?: string
    }
    if (!response.ok || !payload.party) {
      setError(payload.error ?? "Unable to update title.")
      throw new Error(payload.error ?? "Unable to update title.")
    }
    const nextParty = payload.party
    setParty(current => ({
      ...nextParty,
      hostToken: current.hostToken ?? nextParty.hostToken
    }))
  }

  const handleUnlockPlayback = () => {
    const video = videoRef.current
    if (!video) {
      return
    }
    void video
      .play()
      .then(() => setNeedsPlaybackUnlock(false))
      .catch(() => setNeedsPlaybackUnlock(true))
  }

  const isPresenceConnected = presenceStatus === "connected"
  const isReady = party.status === "ready" && Boolean(party.publicBlobUrl)
  const canShowVideo = hasJoined && isReady && isPresenceConnected

  useEffect(() => {
    if (!canShowVideo) {
      hasAppliedCommandRef.current = false
    }
  }, [canShowVideo])

  return (
    <PageScaffold>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <WatchPartyTitle
            title={party.title}
            isHost={party.isHost}
            onSave={handleSaveTitle}
          />
          <p className="text-xs text-neutral-500">
            Room {party.roomId}
            {presenceStatus === "connected"
              ? " · connected"
              : presenceStatus === "failed"
                ? party.isHost
                  ? " · host join failed"
                  : " · disconnected"
                : hasJoined && party.status === "ready"
                  ? " · connecting"
                  : ""}
            {party.isHost ? " · host" : " · watcher"}
          </p>
        </div>
        {party.isHost ? (
          <TermButton
            variant="danger"
            onClick={() => void handleEndParty()}
          >
            End party
          </TermButton>
        ) : null}
      </div>

      {party.status === "encoding" ? (
        <WatchPartyEncodeProgress
          step={party.encodeStep}
          percent={party.encodePercent}
        />
      ) : null}

      {party.status === "error" ? (
        <p className="text-sm text-red-600">{party.encodeError || "Unable to prepare this video."}</p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!hasJoined ? (
        <WatchPartyJoin
          isReady={isReady}
          onJoin={() => setHasJoined(true)}
        />
      ) : null}

      {hasJoined && isReady && !canShowVideo ? (
        <WatchPartyConnecting
          isFailed={presenceStatus === "failed"}
          isHost={party.isHost}
          onRetry={() => setPresenceAttempt(current => current + 1)}
        />
      ) : null}

      {canShowVideo ? (
        <div className="space-y-3">
          <div className="relative">
            <video
              ref={videoRef}
              src={party.publicBlobUrl ?? undefined}
              playsInline
              preload="metadata"
              muted={isMuted}
              className="w-full rounded border border-neutral-200 bg-black"
              onLoadedMetadata={event => {
                const video = event.currentTarget
                video.volume = volume
                video.muted = isMuted
                setDurationSeconds(readVideoDuration(video))
                const pending = lastCommandRef.current
                if (pending) {
                  applyRemoteCommand(pending)
                }
              }}
              onDurationChange={event => setDurationSeconds(readVideoDuration(event.currentTarget))}
              onTimeUpdate={event => setPositionSeconds(event.currentTarget.currentTime)}
            />
            {party.publicBlobUrl ? (
              <WatchPartyVideoDownload
                url={party.publicBlobUrl}
                title={party.title}
              />
            ) : null}
            {needsPlaybackUnlock ? (
              <TermButton
                variant="primary"
                onClick={handleUnlockPlayback}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              >
                Click to start playback
              </TermButton>
            ) : null}
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {party.isHost ? (
                <>
                  <TermButton
                    variant="primary"
                    onClick={isPlaying ? handleHostPause : handleHostPlay}
                  >
                    {isPlaying ? "Pause" : "Play"}
                  </TermButton>
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
                    className="min-w-24 flex-1"
                    aria-label="Seek"
                  />
                </>
              ) : (
                <>
                  <span className="tabular-nums text-neutral-600">
                    {formatTime(positionSeconds)} / {formatTime(durationSeconds)}
                  </span>
                  <p className="text-neutral-500">Playback follows the host.</p>
                </>
              )}
            </div>
            <WatchPartyVolumeControls
              volume={volume}
              isMuted={isMuted}
              onVolumeChange={setVolume}
              onMutedChange={setIsMuted}
            />
          </div>
        </div>
      ) : null}
    </PageScaffold>
  )
}
