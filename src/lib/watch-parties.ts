import { randomUUID } from "node:crypto"

import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { videos, watchParties, watchPartyDerivatives } from "@/db/schema"
import { generateUniqueShareCode } from "@/lib/share-code"
import { WATCH_PARTY_ENCODE_PROFILE } from "@/lib/watch-party-storage"
import { mintWatchPartyHostToken } from "@/lib/watch-party-tokens"
import {
  WATCH_PARTY_ENCODE_STEPS,
  WATCH_PARTY_STATUSES,
  WATCH_PARTY_TITLE_MAX,
  type WatchPartyEncodeStep,
  type WatchPartyPublicView,
  type WatchPartyStatus
} from "@/lib/watch-party-types"

export type { WatchPartyEncodeStep, WatchPartyPublicView, WatchPartyStatus }
export { WATCH_PARTY_ENCODE_STEPS, WATCH_PARTY_STATUSES, WATCH_PARTY_TITLE_MAX }

export type WatchPartyRecord = {
  id: string
  hash: string
  hostUserId: string
  videoId: string
  status: WatchPartyStatus
  title: string
  publicBlobUrl: string | null
  encodeError: string | null
  encodeStep: WatchPartyEncodeStep | null
  encodePercent: number
  createdAt: Date
  endedAt: Date | null
}

const normalizeStatus = (value: string): WatchPartyStatus =>
  WATCH_PARTY_STATUSES.includes(value as WatchPartyStatus)
    ? (value as WatchPartyStatus)
    : "encoding"

const normalizeEncodeStep = (value: string | null): WatchPartyEncodeStep | null =>
  WATCH_PARTY_ENCODE_STEPS.includes(value as WatchPartyEncodeStep)
    ? (value as WatchPartyEncodeStep)
    : null

export const defaultWatchPartyTitle = (input: {
  originalFileName?: string | null
  baseName?: string | null
}): string => {
  const title = (input.originalFileName || input.baseName || "Watch party").replace(/\s+/g, " ").trim()
  return title.slice(0, WATCH_PARTY_TITLE_MAX) || "Watch party"
}

export const normalizeWatchPartyTitle = (value: string): string | null => {
  const title = value.replace(/\s+/g, " ").trim()
  if (!title || title.length > WATCH_PARTY_TITLE_MAX) {
    return null
  }
  return title
}

const mapParty = (row: typeof watchParties.$inferSelect): WatchPartyRecord => ({
  id: row.id,
  hash: row.hash,
  hostUserId: row.hostUserId,
  videoId: row.videoId,
  status: normalizeStatus(row.status),
  title: row.title?.trim() || "Watch party",
  publicBlobUrl: row.publicBlobUrl,
  encodeError: row.encodeError,
  encodeStep: normalizeEncodeStep(row.encodeStep),
  encodePercent: Math.max(0, Math.min(100, row.encodePercent ?? 0)),
  createdAt: row.createdAt,
  endedAt: row.endedAt
})

export const getPresenceUrl = (): string =>
  process.env.PRESENCE_URL?.trim() || "https://presence.latex.gg"

export const getWatchPartyDerivative = async (
  videoId: string,
  profile = WATCH_PARTY_ENCODE_PROFILE,
) => {
  const [row] = await db
    .select()
    .from(watchPartyDerivatives)
    .where(
      and(
        eq(watchPartyDerivatives.videoId, videoId),
        eq(watchPartyDerivatives.profile, profile),
      ),
    )
    .limit(1)
  return row ?? null
}

export const getWatchPartyByHash = async (hash: string): Promise<WatchPartyRecord | null> => {
  const [row] = await db
    .select()
    .from(watchParties)
    .where(eq(watchParties.hash, hash))
    .limit(1)
  return row ? mapParty(row) : null
}

export const createWatchPartyForUser = async (input: {
  userId: string
  videoId: string
}): Promise<{ party: WatchPartyRecord; shouldEnqueueEncode: boolean }> => {
  const [video] = await db
    .select({
      id: videos.id,
      userId: videos.userId,
      originalFileName: videos.originalFileName,
      baseName: videos.baseName
    })
    .from(videos)
    .where(and(eq(videos.id, input.videoId), eq(videos.userId, input.userId)))
    .limit(1)
  if (!video) {
    throw new Error("Video not found.")
  }

  const derivative = await getWatchPartyDerivative(input.videoId)
  const hash = await generateUniqueShareCode()
  const now = new Date()
  const [created] = await db
    .insert(watchParties)
    .values({
      id: randomUUID(),
      hash,
      hostUserId: input.userId,
      videoId: input.videoId,
      status: derivative ? "ready" : "encoding",
      title: defaultWatchPartyTitle(video),
      publicBlobUrl: derivative?.publicBlobUrl ?? null,
      encodeError: null,
      encodeStep: derivative ? null : "download",
      encodePercent: derivative ? 100 : 0,
      createdAt: now,
      endedAt: null
    })
    .returning()

  if (!created) {
    throw new Error("Unable to create watch party.")
  }

  return {
    party: mapParty(created),
    shouldEnqueueEncode: !derivative
  }
}

export const buildWatchPartyPublicView = async (input: {
  party: WatchPartyRecord
  viewerUserId: string | null
}): Promise<WatchPartyPublicView> => {
  const isHost = input.viewerUserId === input.party.hostUserId
  return {
    hash: input.party.hash,
    roomId: input.party.hash,
    status: input.party.status,
    title: input.party.title,
    publicBlobUrl: input.party.status === "ready" ? input.party.publicBlobUrl : null,
    presenceUrl: getPresenceUrl(),
    encodeError: input.party.encodeError,
    encodeStep: input.party.encodeStep,
    encodePercent: input.party.encodePercent,
    isHost,
    hostToken:
      isHost && input.party.status !== "ended"
        ? mintWatchPartyHostToken(input.party.hash)
        : null
  }
}

export const markWatchPartyEncodeComplete = async (input: {
  videoId: string
  profile?: string
  publicBlobKey: string
  publicBlobUrl: string
  sizeBytes: number
}): Promise<void> => {
  const profile = input.profile ?? WATCH_PARTY_ENCODE_PROFILE
  const now = new Date()
  const existing = await getWatchPartyDerivative(input.videoId, profile)
  if (existing) {
    await db
      .update(watchPartyDerivatives)
      .set({
        publicBlobKey: input.publicBlobKey,
        publicBlobUrl: input.publicBlobUrl,
        sizeBytes: input.sizeBytes,
        updatedAt: now
      })
      .where(eq(watchPartyDerivatives.id, existing.id))
  } else {
    await db.insert(watchPartyDerivatives).values({
      id: randomUUID(),
      videoId: input.videoId,
      profile,
      publicBlobKey: input.publicBlobKey,
      publicBlobUrl: input.publicBlobUrl,
      sizeBytes: input.sizeBytes,
      createdAt: now,
      updatedAt: now
    })
  }

  await db
    .update(watchParties)
    .set({
      status: "ready",
      publicBlobUrl: input.publicBlobUrl,
      encodeError: null,
      encodeStep: "upload",
      encodePercent: 100
    })
    .where(and(eq(watchParties.videoId, input.videoId), eq(watchParties.status, "encoding")))
}

export const reportWatchPartyEncodeProgress = async (input: {
  videoId: string
  step: WatchPartyEncodeStep
  percent: number
}): Promise<void> => {
  const percent = Math.max(0, Math.min(100, Math.round(input.percent)))
  await db
    .update(watchParties)
    .set({
      encodeStep: input.step,
      encodePercent: percent
    })
    .where(and(eq(watchParties.videoId, input.videoId), eq(watchParties.status, "encoding")))
}

export const markWatchPartyEncodeFailed = async (input: {
  videoId: string
  error: string
}): Promise<void> => {
  await db
    .update(watchParties)
    .set({
      status: "error",
      encodeError: input.error.slice(0, 500)
    })
    .where(and(eq(watchParties.videoId, input.videoId), eq(watchParties.status, "encoding")))
}

export const updateWatchPartyTitleForUser = async (input: {
  hash: string
  userId: string
  title: string
}): Promise<WatchPartyRecord | null> => {
  const party = await getWatchPartyByHash(input.hash)
  if (!party || party.hostUserId !== input.userId || party.status === "ended") {
    return null
  }
  const title = normalizeWatchPartyTitle(input.title)
  if (!title) {
    throw new Error("Title is required.")
  }
  const [updated] = await db
    .update(watchParties)
    .set({ title })
    .where(eq(watchParties.id, party.id))
    .returning()
  return updated ? mapParty(updated) : party
}

export const endWatchPartyForUser = async (input: {
  hash: string
  userId: string
}): Promise<WatchPartyRecord | null> => {
  const party = await getWatchPartyByHash(input.hash)
  if (!party || party.hostUserId !== input.userId) {
    return null
  }
  if (party.status === "ended") {
    return party
  }

  const [updated] = await db
    .update(watchParties)
    .set({
      status: "ended",
      endedAt: new Date()
    })
    .where(eq(watchParties.id, party.id))
    .returning()

  return updated ? mapParty(updated) : party
}
