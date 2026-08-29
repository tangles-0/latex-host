import { describe, expect, it } from "vitest"

import { areEditableLimitsEqual, copyEditableLimits, normalizeTypes, type GroupLimits } from "./limit-options"

const createLimits = (overrides: Partial<GroupLimits> = {}): GroupLimits => ({
  id: "limits-1",
  groupId: null,
  maxFileSize: 100,
  maxImageSize: 100,
  maxVideoSize: 100,
  maxDocumentSize: 100,
  maxOtherSize: 100,
  imageGenerationEnabled: false,
  allowedTypes: ["image/png"],
  rateLimitPerMinute: 10,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
})

describe("normalizeTypes", () => {
  it("trims, lowercases, de-duplicates, and sorts values", () => {
    expect(normalizeTypes([" Text/Plain ", ".TS", "text/plain", ""])).toEqual([".ts", "text/plain"])
  })
})

describe("copyEditableLimits", () => {
  it("copies policy fields without replacing target identity", () => {
    const source = createLimits({
      id: "source",
      maxImageSize: 200,
      maxVideoSize: 400,
      imageGenerationEnabled: true,
      allowedTypes: [".TS", "text/plain"],
      rateLimitPerMinute: 25
    })
    const target = createLimits({ id: "target", groupId: "group-1" })

    expect(copyEditableLimits(source, target)).toMatchObject({
      id: "target",
      groupId: "group-1",
      maxFileSize: 400,
      maxImageSize: 200,
      maxVideoSize: 400,
      imageGenerationEnabled: true,
      allowedTypes: [".ts", "text/plain"],
      rateLimitPerMinute: 25
    })
  })
})

describe("areEditableLimitsEqual", () => {
  it("ignores identity and allowlist order", () => {
    const left = createLimits({ allowedTypes: [".ts", "text/plain"] })
    const right = createLimits({
      id: "different",
      groupId: "group-1",
      allowedTypes: ["text/plain", ".TS"]
    })

    expect(areEditableLimitsEqual(left, right)).toBe(true)
  })

  it("detects changed policy fields", () => {
    expect(areEditableLimitsEqual(createLimits(), createLimits({ rateLimitPerMinute: 11 }))).toBe(false)
    expect(areEditableLimitsEqual(createLimits(), createLimits({ imageGenerationEnabled: true }))).toBe(false)
  })
})
