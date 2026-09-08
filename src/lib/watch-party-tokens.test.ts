import { afterEach, describe, expect, it } from "vitest"

import { mintWatchPartyHostToken, verifyWatchPartyHostToken } from "@/lib/watch-party-tokens"

describe("watch party host tokens", () => {
  afterEach(() => {
    delete process.env.PRESENCE_HMAC_SECRET
    delete process.env.NEXTAUTH_SECRET
  })

  it("mints a token that verifies for the same hash", () => {
    process.env.PRESENCE_HMAC_SECRET = "presence-secret"
    const token = mintWatchPartyHostToken("abc12345", 60)
    expect(verifyWatchPartyHostToken(token, "abc12345")).toMatchObject({
      hash: "abc12345",
      role: "host"
    })
  })

  it("rejects a token for a different room hash", () => {
    process.env.PRESENCE_HMAC_SECRET = "presence-secret"
    const token = mintWatchPartyHostToken("abc12345", 60)
    expect(verifyWatchPartyHostToken(token, "otherhash")).toBeNull()
  })

  it("rejects a tampered token", () => {
    process.env.PRESENCE_HMAC_SECRET = "presence-secret"
    const token = mintWatchPartyHostToken("abc12345", 60)
    expect(verifyWatchPartyHostToken(`${token}x`, "abc12345")).toBeNull()
  })

  it("rejects an expired token", () => {
    process.env.PRESENCE_HMAC_SECRET = "presence-secret"
    const token = mintWatchPartyHostToken("abc12345", 60)
    const now = Math.floor(Date.now() / 1000) + 120
    expect(verifyWatchPartyHostToken(token, "abc12345", now)).toBeNull()
  })
})
