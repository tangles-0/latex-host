import { describe, expect, it } from "vitest"

import { expectedPositionMs, presenceSocketUrl } from "@/lib/watch-party-protocol"

describe("presenceSocketUrl", () => {
  it("builds a watcher websocket url", () => {
    expect(presenceSocketUrl("https://presence.latex.gg", "abc123")).toBe(
      "wss://presence.latex.gg/rooms/abc123?role=watcher",
    )
  })

  it("includes a host token", () => {
    expect(
      presenceSocketUrl("http://localhost:3100", "abc123", {
        isHost: true,
        hostToken: "v1.token"
      }),
    ).toBe("ws://localhost:3100/rooms/abc123?role=host&token=v1.token")
  })
})

describe("expectedPositionMs", () => {
  it("holds still while paused", () => {
    expect(
      expectedPositionMs(
        { v: 1, type: "pause", positionMs: 5000, rate: 1, hostTime: 1, seq: 1 },
        10_000,
      ),
    ).toBe(5000)
  })

  it("advances while playing", () => {
    expect(
      expectedPositionMs(
        { v: 1, type: "play", positionMs: 1000, rate: 1, hostTime: 0, seq: 1 },
        400,
      ),
    ).toBe(1400)
  })
})
