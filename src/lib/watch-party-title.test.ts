import { describe, expect, it } from "vitest"

import { defaultWatchPartyTitle, normalizeWatchPartyTitle } from "@/lib/watch-parties"

describe("normalizeWatchPartyTitle", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeWatchPartyTitle("  Friday   movie  ")).toBe("Friday movie")
  })

  it("rejects an empty title", () => {
    expect(normalizeWatchPartyTitle("   ")).toBeNull()
  })
})

describe("defaultWatchPartyTitle", () => {
  it("prefers the original file name", () => {
    expect(
      defaultWatchPartyTitle({
        originalFileName: "clip.mp4",
        baseName: "clip"
      }),
    ).toBe("clip.mp4")
  })
})
