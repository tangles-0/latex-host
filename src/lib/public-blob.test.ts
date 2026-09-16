import { describe, expect, it } from "vitest"
import {
  canDisableMediaShare,
  isPublicStoreMedia,
  PUBLIC_STORE_SHARE_LOCKED_MESSAGE,
} from "@/lib/public-blob"
import { parsePublicSessionMetadata } from "@/lib/upload-sessions"
import {
  buildMediaBaseName,
  buildMediaOriginalStorageKey,
} from "@/lib/media-storage"

describe("isPublicStoreMedia", () => {
  it("treats public blob fields as public-store media", () => {
    expect(isPublicStoreMedia({ publicBlobKey: "uploads/a.mp4" })).toBe(true)
    expect(isPublicStoreMedia({ publicBlobUrl: "https://example.com/a.mp4" })).toBe(
      true,
    )
    expect(isPublicStoreMedia({ publicStore: true })).toBe(true)
  })

  it("treats empty fields as private media", () => {
    expect(isPublicStoreMedia({})).toBe(false)
    expect(isPublicStoreMedia({ publicBlobKey: " ", publicBlobUrl: "" })).toBe(
      false,
    )
  })
})

describe("canDisableMediaShare", () => {
  it("locks share removal for public-store media", () => {
    expect(canDisableMediaShare({ publicStore: true })).toBe(false)
    expect(canDisableMediaShare({ publicBlobKey: "uploads/a.mp4" })).toBe(false)
    expect(canDisableMediaShare({})).toBe(true)
    expect(PUBLIC_STORE_SHARE_LOCKED_MESSAGE).toMatch(/always public|stay public/i)
  })
})

describe("parsePublicSessionMetadata", () => {
  it("reads reserved public upload metadata", () => {
    expect(
      parsePublicSessionMetadata(
        JSON.stringify({ store: "public", baseName: "2026-09-16T01-00-00-000Z-abc123" }),
      ),
    ).toEqual({
      store: "public",
      baseName: "2026-09-16T01-00-00-000Z-abc123",
    })
  })

  it("ignores private multipart metadata", () => {
    expect(
      parsePublicSessionMetadata(JSON.stringify({ key: "abc", uploadId: "xyz" })),
    ).toBeUndefined()
  })
})

describe("buildMediaOriginalStorageKey", () => {
  it("uses the dated kind/original path", () => {
    const uploadedAt = new Date("2026-09-16T01:02:03.000Z")
    const baseName = buildMediaBaseName(uploadedAt)
    expect(
      buildMediaOriginalStorageKey("video", baseName, "mp4", uploadedAt),
    ).toBe(`uploads/2026/09/16/video/original/${baseName}.mp4`)
  })
})
