import { describe, expect, it } from "vitest"
import { formatBytes, formatIsoDate, formatShortBytes } from "./format"

describe("format helpers", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B")
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(2048)).toBe("2.0 KB")
  })

  it("formats short bytes", () => {
    expect(formatShortBytes(0)).toBe("0B")
    expect(formatShortBytes(2048)).toBe("2.0K")
  })

  it("formats iso dates", () => {
    expect(formatIsoDate("2026-09-16T12:00:00.000Z")).toBe("2026-09-16")
  })
})
